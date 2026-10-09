const crypto = require('crypto');
const massIntentionRepository = require('../repositories/massIntentionRepository');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');
const contributionRepository = require('../repositories/contributionRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('../services/auditService');
const { effectiveBranchId } = require('../utils/effectiveScope');

/** `{ churchId, branchId }` for every read below -- churchId is always the
 * requester's own church; branchId is null (unrestricted) for ADMIN, else
 * their own home branch (or, for Master Administrator, whichever branch
 * its switcher currently has selected) -- see utils/effectiveScope.js. */
function scopeFor(req) {
  return { churchId: req.user.churchId, branchId: effectiveBranchId(req) };
}
const { generateReceiptPdf } = require('../reports/receiptPdf');
const { generateReceiptHtml } = require('../reports/receiptHtml');
const { generateBulkReceiptPdf } = require('../reports/bulkReceiptPdf');
const { generateDailyRegisterPdf } = require('../reports/dailyRegisterPdf');
const { findMatch, listUpcoming } = require('../utils/restrictedDates');
const ApiError = require('../utils/ApiError');
const { pool } = require('../config/db');

/**
 * Rejects a booking/payment on a Restricted Date. Enforced here (not just in
 * the frontend warning banner) because the API is the actual trust boundary
 * -- a client-side warning doesn't stop a direct POST to this endpoint.
 */
async function assertNotRestrictedDate(prayerDate, churchId) {
  const restrictedDates = await lookupRepository.getActiveRestrictedDates(churchId);
  const match = findMatch(restrictedDates, prayerDate);
  if (match) {
    throw ApiError.badRequest(
      `Mass Intentions cannot be booked on Restricted Dates. "${match.name}" falls on this date.`
    );
  }
  return match;
}

async function resolveIntentionText(payload) {
  let prayerIntentionMasterId = payload.prayerIntentionMasterId || null;
  let customIntention = null;

  if (prayerIntentionMasterId) {
    const master = await lookupRepository.getPrayerIntentionMasterById(prayerIntentionMasterId);
    if (!master) throw ApiError.badRequest('Selected mass intention is invalid');
    if (master.is_custom) {
      if (!payload.customIntention || !payload.customIntention.trim()) {
        throw ApiError.badRequest('Please describe the mass intention (required when "Others" is selected)');
      }
      customIntention = payload.customIntention.trim();
    } else if (payload.customIntention && payload.customIntention.trim()) {
      customIntention = payload.customIntention.trim();
    }
  } else {
    if (!payload.customIntention || !payload.customIntention.trim()) {
      throw ApiError.badRequest('Select a mass intention or describe a custom one');
    }
    customIntention = payload.customIntention.trim();
  }

  return { prayerIntentionMasterId, customIntention };
}

/**
 * Step 1 of the payment workflow: saving a Mass Intention only ever creates
 * the booking record. No receipt number is withheld and no payment is
 * assumed -- see paymentService.js for the separate, explicit "Receive
 * Payment" step, and buildReceiptPdf() below for the payment-gated receipt.
 */
/** A Mass is a church's own record: booking against another church's Mass would put this
 * church's intention on that church's register. Skipped when no church is selected. */
function assertMassBelongsToChurch(mass, churchId) {
  if (!mass) throw ApiError.badRequest('Selected Mass is invalid');
  if (churchId && mass.church_id !== undefined && Number(mass.church_id) !== Number(churchId)) {
    throw ApiError.badRequest('Selected Mass does not belong to this church. Choose one of the Masses set up for this church.');
  }
}

async function create(payload, req) {
  const mass = await lookupRepository.getMassById(payload.massId);
  assertMassBelongsToChurch(mass, req.user.churchId);

  await assertNotRestrictedDate(payload.prayerDate, req.user.churchId);

  const { prayerIntentionMasterId, customIntention } = await resolveIntentionText(payload);

  if (!payload.allowDuplicate) {
    const duplicate = await massIntentionRepository.findPotentialDuplicate({
      name: payload.name,
      phone: payload.phone || null,
      prayerDate: payload.prayerDate,
      massId: payload.massId,
      prayerIntentionMasterId,
      churchId: req.user.churchId,
    });
    if (duplicate) {
      throw ApiError.conflict(
        `A mass intention for "${payload.name}" on this date and Mass already exists (Receipt ${duplicate.receipt_no}).`,
        {
          id: duplicate.id,
          receiptNo: duplicate.receipt_no,
          name: duplicate.name,
          bookedBy: duplicate.booked_by,
          phone: duplicate.phone,
          prayerDate: duplicate.prayer_date,
          offeringAmount: duplicate.offering_amount,
          createdAt: duplicate.created_at,
        }
      );
    }
  }

  const churchId = req.user.churchId;

  // Claiming the receipt number and inserting the row it belongs to run in
  // ONE transaction -- claimNextReceiptNumberOnConn only reserves the
  // number (it doesn't commit), so if the insert below throws for any
  // reason, the whole thing rolls back and that number is claimable again
  // instead of being permanently skipped (a gap in a legally-relevant
  // sequence) just because this particular save happened to fail.
  const conn = await pool.getConnection();
  let created;
  try {
    await conn.beginTransaction();
    const receiptNo = await receiptSeriesRepository.claimNextReceiptNumberOnConn(conn, churchId);
    created = await massIntentionRepository.create(
      {
        church_id: churchId,
        branch_id: req.user.branchId,
        receipt_no: receiptNo,
        // Unguessable key for the receipt QR code's public calendar page.
        public_token: crypto.randomBytes(16).toString('hex'),
        bulk_batch_id: payload.bulkBatchId || null,
        name: payload.name.trim(),
        booked_by: payload.bookedBy || null,
        phone: payload.phone || null,
        prayer_date: payload.prayerDate,
        mass_id: payload.massId,
        prayer_intention_master_id: prayerIntentionMasterId,
        custom_intention: customIntention,
        offering_amount: payload.offeringAmount,
        payment_method_id: payload.paymentMethodId || null,
        remarks: payload.remarks || null,
      },
      req.user.id,
      conn
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await auditService.fromRequest(req, {
    action: 'CREATE',
    module: 'mass_intentions',
    entityType: 'mass_intentions',
    entityId: created.id,
    newValues: created,
  });

  return created;
}

async function update(id, payload, req) {
  const existing = await massIntentionRepository.getById(id, scopeFor(req));
  if (!existing) throw ApiError.notFound('Mass intention not found');

  const patch = {};
  if (payload.name !== undefined) patch.name = payload.name.trim();
  if (payload.bookedBy !== undefined) patch.booked_by = payload.bookedBy || null;
  if (payload.phone !== undefined) patch.phone = payload.phone || null;
  if (payload.prayerDate !== undefined) {
    // Only re-check when the date is actually moving -- an intention already
    // sitting on a date that was later marked a Restricted Date shouldn't
    // become un-editable for its other fields.
    if (payload.prayerDate !== existing.prayer_date) {
      await assertNotRestrictedDate(payload.prayerDate, req.user.churchId);
    }
    patch.prayer_date = payload.prayerDate;
  }
  if (payload.massId !== undefined) {
    const mass = await lookupRepository.getMassById(payload.massId);
    assertMassBelongsToChurch(mass, req.user.churchId);
    patch.mass_id = payload.massId;
  }
  if (payload.prayerIntentionMasterId !== undefined || payload.customIntention !== undefined) {
    const { prayerIntentionMasterId, customIntention } = await resolveIntentionText({
      prayerIntentionMasterId: payload.prayerIntentionMasterId ?? existing.prayer_intention_master_id,
      customIntention: payload.customIntention ?? existing.custom_intention,
    });
    patch.prayer_intention_master_id = prayerIntentionMasterId;
    patch.custom_intention = customIntention;
  }
  if (payload.offeringAmount !== undefined) patch.offering_amount = payload.offeringAmount;
  if (payload.paymentMethodId !== undefined) patch.payment_method_id = payload.paymentMethodId || null;
  if (payload.remarks !== undefined) patch.remarks = payload.remarks || null;

  const updated = await massIntentionRepository.update(id, patch, req.user.id);

  await auditService.fromRequest(req, {
    action: 'UPDATE',
    module: 'mass_intentions',
    entityType: 'mass_intentions',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}

async function remove(id, req) {
  const existing = await massIntentionRepository.getById(id, scopeFor(req));
  if (!existing) throw ApiError.notFound('Mass intention not found');
  await massIntentionRepository.softDelete(id, req.user.id);
  await auditService.fromRequest(req, {
    action: 'DELETE',
    module: 'mass_intentions',
    entityType: 'mass_intentions',
    entityId: id,
    oldValues: existing,
  });
}

async function refund(id, payload = {}, req) {
  const existing = await massIntentionRepository.getById(id, scopeFor(req));
  if (!existing) throw ApiError.notFound('Mass intention not found');
  const updated = await massIntentionRepository.refund(id, payload, req.user.id);
  await auditService.fromRequest(req, {
    action: 'REFUND',
    module: 'mass_intentions',
    entityType: 'mass_intentions',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });
  return updated;
}

async function unrefund(id, req) {
  const existing = await massIntentionRepository.getById(id, scopeFor(req));
  if (!existing) throw ApiError.notFound('Mass intention not found');
  const updated = await massIntentionRepository.unrefund(id, req.user.id);
  await auditService.fromRequest(req, {
    action: 'UNREFUND',
    module: 'mass_intentions',
    entityType: 'mass_intentions',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });
  return updated;
}

/**
 * Step 3 of the payment workflow: the receipt only becomes generatable once
 * a successful payment exists (see massIntentionRepository's `is_paid`,
 * derived from payment_transactions -- there is no separate manual flag to
 * fall out of sync with it).
 */
/** Everything both buildReceiptPdf and buildReceiptHtml need, gathered
 * once so the PDF and the print-preview HTML (see receiptHtml.js's own
 * doc comment for why that second rendering exists) can never disagree
 * about which record, church, thank-you message or currency they're
 * showing. */
async function loadReceiptContext(id, req) {
  const intention = await massIntentionRepository.getById(id, scopeFor(req));
  if (!intention) throw ApiError.notFound('Mass intention not found');
  if (!intention.is_paid) {
    throw ApiError.badRequest('Payment has not been received for this Mass Intention yet. Use "Receive Payment" first.');
  }

  const church = await lookupRepository.getChurchById(intention.church_id);
  const [settingRows] = await pool.query(
    "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('RECEIPT_THANK_YOU_MESSAGE', 'RECEIPT_QR_MODE')"
  );
  const settings = Object.fromEntries(settingRows.map((r) => [r.setting_key, r.setting_value]));
  const currency = await lookupRepository.getDefaultCurrency();
  const lang = req.query?.lang === 'ta' ? 'ta' : 'en';
  return { intention, church, settings, currency, lang };
}

async function buildReceiptPdf(id, req) {
  const { intention, church, settings, currency, lang } = await loadReceiptContext(id, req);
  const buffer = await generateReceiptPdf(
    intention,
    church,
    settings.RECEIPT_THANK_YOU_MESSAGE,
    settings.RECEIPT_QR_MODE || 'calendar',
    currency.symbol,
    req.user.username,
    lang
  );
  await auditService.fromRequest(req, {
    action: 'PRINT_RECEIPT',
    module: 'mass_intentions',
    entityType: 'mass_intentions',
    entityId: id,
  });
  return { buffer, receiptNo: intention.receipt_no };
}

/**
 * The print-preview HTML version of the same receipt (see receiptHtml.js's
 * own doc comment for why this exists alongside, not instead of, the PDF
 * above) -- same data, same "must be paid" rule, same audit trail.
 */
async function buildReceiptHtml(id, req) {
  const { intention, church, settings, currency, lang } = await loadReceiptContext(id, req);
  const html = await generateReceiptHtml(
    intention,
    church,
    settings.RECEIPT_THANK_YOU_MESSAGE,
    settings.RECEIPT_QR_MODE || 'calendar',
    currency.symbol,
    req.user.username,
    lang
  );
  await auditService.fromRequest(req, {
    action: 'PRINT_RECEIPT',
    module: 'mass_intentions',
    entityType: 'mass_intentions',
    entityId: id,
  });
  return { html, receiptNo: intention.receipt_no };
}

/**
 * One combined receipt for a whole Bulk Mass Intention batch -- see
 * bulkReceiptPdf.js. Only paid intentions are included (same "receipt only
 * once paid" rule as the single receipt above); an id/batch that's unpaid,
 * not found, or belongs to another church is silently dropped rather than
 * failing the whole batch.
 *
 * Two ways to specify which rows: explicit `ids` (right after a Bulk save,
 * when the caller already knows exactly which ones it just created/paid --
 * see bulk-mass-intention-form.ts) or `batchId` (reprinting later from
 * "Show Bulk Mass Intentions" -- see mass-intentions-list.ts -- where all
 * the caller has is the batch, not its individual ids).
 */
async function buildBulkReceiptPdf({ ids, batchId }, req) {
  const branchId = effectiveBranchId(req);
  const rows = batchId
    ? await massIntentionRepository.getByBatchId(batchId, req.user.churchId, branchId)
    : await massIntentionRepository.getByIds(ids, req.user.churchId, branchId);
  const intentions = rows.filter((i) => i.is_paid);
  if (!intentions.length) {
    throw ApiError.badRequest('None of the specified mass intentions could be found with payment received.');
  }

  const church = await lookupRepository.getChurchById(req.user.churchId);
  const currency = await lookupRepository.getDefaultCurrency();
  const lang = req.query?.lang === 'ta' ? 'ta' : 'en';
  const buffer = await generateBulkReceiptPdf(intentions, church, currency.symbol, req.user.username, lang);

  await auditService.fromRequest(req, {
    action: 'PRINT_RECEIPT',
    module: 'mass_intentions',
    entityType: 'mass_intentions_bulk',
    newValues: { ids: intentions.map((i) => i.id), count: intentions.length },
  });
  return buffer;
}

async function buildDailyRegisterPdf(prayerDate, req, { namesOnly = false, reasonsOnly = false, massId = null } = {}) {
  const entries = await massIntentionRepository.getRegisterData(prayerDate, req.user.churchId, effectiveBranchId(req), massId);
  const church = await lookupRepository.getChurchById(req.user.churchId);
  const currency = await lookupRepository.getDefaultCurrency();
  const lang = req.query?.lang === 'ta' ? 'ta' : 'en';
  const buffer = await generateDailyRegisterPdf({
    prayerDate,
    church,
    entries,
    generatedBy: req.user.username,
    currencySymbol: currency.symbol,
    namesOnly,
    reasonsOnly,
    lang,
  });
  await auditService.fromRequest(req, {
    action: 'PRINT_REGISTER',
    module: 'prayer_register',
    entityType: 'prayer_register',
    newValues: { prayerDate, count: entries.length, namesOnly, reasonsOnly, massId },
  });
  return buffer;
}

async function getRegisterPreview(prayerDate, req) {
  return massIntentionRepository.getRegisterData(prayerDate, req.user.churchId, effectiveBranchId(req));
}

/** `next_occurrence` (a JS Date, from utils/restrictedDates.js) rendered as a
 * 'YYYY-MM-DD' string for the API response. */
function listUpcomingRestrictedDates(rows, from, limit) {
  return listUpcoming(rows, from, limit).map((row) => {
    const d = row.next_occurrence;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { id: row.id, name: row.name, date: iso, isRecurringYearly: !!row.is_recurring_yearly };
  });
}

async function getDashboardStats(req) {
  const churchId = req.user.churchId;
  const branchId = effectiveBranchId(req);
  const [stats, contributionTotals, announcements, restrictedDateRows] = await Promise.all([
    massIntentionRepository.getDashboardStats(churchId, branchId),
    contributionRepository.getDashboardTotals(churchId, branchId),
    lookupRepository.getActiveAnnouncements(churchId, { upcomingOnly: true, limit: 5 }),
    lookupRepository.getActiveRestrictedDates(churchId),
  ]);

  const upcomingRestrictedDates = listUpcomingRestrictedDates(restrictedDateRows, new Date(), 5);

  return { ...stats, ...contributionTotals, announcements, upcomingRestrictedDates };
}

module.exports = {
  create,
  update,
  remove,
  refund,
  unrefund,
  buildReceiptPdf,
  buildReceiptHtml,
  buildBulkReceiptPdf,
  buildDailyRegisterPdf,
  getRegisterPreview,
  getDashboardStats,
  assertNotRestrictedDate,
  list: (query, req) => massIntentionRepository.list({ ...query, ...scopeFor(req) }),
  getById: (id, req) => massIntentionRepository.getById(id, scopeFor(req)),
  listBulkBatches: (query, req) => massIntentionRepository.listBulkBatches({ ...query, ...scopeFor(req) }),
};
