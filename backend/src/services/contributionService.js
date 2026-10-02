const contributionRepository = require('../repositories/contributionRepository');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('../services/auditService');
const { generateContributionReceiptPdf } = require('../reports/contributionReceiptPdf');
const { generateContributionReceiptHtml } = require('../reports/contributionReceiptHtml');
const ApiError = require('../utils/ApiError');
const { pool } = require('../config/db');
const { emitToChurch } = require('../realtime/socketServer');
const { effectiveBranchId } = require('../utils/effectiveScope');

/** `{ churchId, branchId }` for every read below -- churchId is always the
 * requester's own church; branchId is null (unrestricted) for ADMIN, else
 * their own home branch (or, for Master Administrator, whichever branch
 * its switcher currently has selected) -- see utils/effectiveScope.js. */
function scopeFor(req) {
  return { churchId: req.user.churchId, branchId: effectiveBranchId(req) };
}

/**
 * Resolves the contribution_type_id/custom_contribution_type pair the same way
 * massIntentionService.resolveIntentionText resolves a Mass Intention's --
 * except contribution_types has no is_custom column (unlike
 * prayer_intention_master), so "Others" is identified by its fixed
 * code ('OTHERS') instead.
 */
async function resolveContributionType(payload) {
  let contributionTypeId = payload.contributionTypeId || null;
  let customContributionType = null;

  if (contributionTypeId) {
    const type = await lookupRepository.getContributionTypeById(contributionTypeId);
    if (!type) throw ApiError.badRequest('Selected contribution type is invalid');
    if (type.code === 'OTHERS') {
      if (!payload.customContributionType) {
        throw ApiError.badRequest('Please describe the contribution purpose (required when "Others" is selected)');
      }
      customContributionType = payload.customContributionType.trim();
    }
  } else {
    if (!payload.customContributionType) {
      throw ApiError.badRequest('Select a contribution type or describe a custom one');
    }
    customContributionType = payload.customContributionType.trim();
  }

  return { contributionTypeId, customContributionType };
}

/**
 * Step 1 of the payment workflow: saving a Contribution only ever creates the
 * record. No payment is assumed -- see contributionPaymentService.js for the
 * separate, explicit "Receive Payment" step, mirroring
 * massIntentionService's create()/paymentService.js split.
 */
async function create(payload, req) {
  const churchId = req.user.churchId;
  const { contributionTypeId, customContributionType } = await resolveContributionType(payload);

  // Claiming the receipt number and inserting the row it belongs to run in
  // ONE transaction -- see massIntentionService.create's identical comment
  // for why (a failed insert would otherwise permanently skip the claimed
  // number instead of rolling it back).
  const conn = await pool.getConnection();
  let created;
  try {
    await conn.beginTransaction();
    const receiptNo = await receiptSeriesRepository.claimNextReceiptNumberOnConn(conn, churchId);
    created = await contributionRepository.create(
      {
        church_id: churchId,
        branch_id: req.user.branchId,
        receipt_no: receiptNo,
        name: payload.name.trim(),
        phone: payload.phone || null,
        contribution_type_id: contributionTypeId,
        custom_contribution_type: customContributionType,
        contribution_amount: payload.contributionAmount,
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
    module: 'contributions',
    entityType: 'contributions',
    entityId: created.id,
    newValues: created,
  });

  emitToChurch(churchId, 'contributions:changed', { action: 'created', id: created.id });

  return created;
}

async function update(id, payload, req) {
  const existing = await contributionRepository.getById(id, scopeFor(req));
  if (!existing) throw ApiError.notFound('Contribution not found');

  const patch = {};
  if (payload.name !== undefined) patch.name = payload.name.trim();
  if (payload.phone !== undefined) patch.phone = payload.phone || null;
  if (payload.contributionTypeId !== undefined || payload.customContributionType !== undefined) {
    const { contributionTypeId, customContributionType } = await resolveContributionType({
      contributionTypeId: payload.contributionTypeId ?? existing.contribution_type_id,
      customContributionType: payload.customContributionType ?? existing.custom_contribution_type,
    });
    patch.contribution_type_id = contributionTypeId;
    patch.custom_contribution_type = customContributionType;
  }
  if (payload.contributionAmount !== undefined) patch.contribution_amount = payload.contributionAmount;
  if (payload.paymentMethodId !== undefined) patch.payment_method_id = payload.paymentMethodId || null;
  if (payload.remarks !== undefined) patch.remarks = payload.remarks || null;

  const updated = await contributionRepository.update(id, patch, req.user.id);

  await auditService.fromRequest(req, {
    action: 'UPDATE',
    module: 'contributions',
    entityType: 'contributions',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  emitToChurch(req.user.churchId, 'contributions:changed', { action: 'updated', id });

  return updated;
}

async function remove(id, req) {
  const existing = await contributionRepository.getById(id, scopeFor(req));
  if (!existing) throw ApiError.notFound('Contribution not found');
  await contributionRepository.softDelete(id, req.user.id);
  await auditService.fromRequest(req, {
    action: 'DELETE',
    module: 'contributions',
    entityType: 'contributions',
    entityId: id,
    oldValues: existing,
  });
  emitToChurch(req.user.churchId, 'contributions:changed', { action: 'deleted', id });
}

/**
 * Step 3 of the payment workflow: the receipt only becomes generatable once
 * a successful payment exists (see contributionRepository's `is_paid`, derived
 * from contribution_payment_transactions).
 */
/** Shared by buildReceiptPdf and buildReceiptHtml -- see
 * massIntentionService.js's identical loadReceiptContext for why. */
async function loadReceiptContext(id, req) {
  const contribution = await contributionRepository.getById(id, scopeFor(req));
  if (!contribution) throw ApiError.notFound('Contribution not found');
  if (!contribution.is_paid) {
    throw ApiError.badRequest('Payment has not been received for this Contribution yet. Use "Receive Payment" first.');
  }

  const church = await lookupRepository.getChurchById(contribution.church_id);
  const [settingRows] = await pool.query(
    "SELECT setting_key, setting_value FROM system_settings WHERE setting_key = 'RECEIPT_THANK_YOU_MESSAGE'"
  );
  const settings = Object.fromEntries(settingRows.map((r) => [r.setting_key, r.setting_value]));
  const currency = await lookupRepository.getDefaultCurrency();
  const lang = req.query?.lang === 'ta' ? 'ta' : 'en';
  return { contribution, church, settings, currency, lang };
}

async function buildReceiptPdf(id, req) {
  const { contribution, church, settings, currency, lang } = await loadReceiptContext(id, req);
  const buffer = await generateContributionReceiptPdf(
    contribution,
    church,
    currency.symbol,
    req.user.username,
    lang,
    settings.RECEIPT_THANK_YOU_MESSAGE
  );

  await auditService.fromRequest(req, {
    action: 'PRINT_RECEIPT',
    module: 'contributions',
    entityType: 'contributions',
    entityId: id,
  });
  return { buffer, receiptNo: contribution.receipt_no };
}

/** The print-preview HTML version of the same receipt -- see
 * receiptHtml.js's doc comment (Mass Intentions' equivalent) for why this
 * exists alongside, not instead of, the PDF above. */
async function buildReceiptHtml(id, req) {
  const { contribution, church, settings, currency, lang } = await loadReceiptContext(id, req);
  const html = await generateContributionReceiptHtml(
    contribution,
    church,
    currency.symbol,
    req.user.username,
    lang,
    settings.RECEIPT_THANK_YOU_MESSAGE
  );

  await auditService.fromRequest(req, {
    action: 'PRINT_RECEIPT',
    module: 'contributions',
    entityType: 'contributions',
    entityId: id,
  });
  return { html, receiptNo: contribution.receipt_no };
}

module.exports = {
  create,
  update,
  remove,
  buildReceiptPdf,
  buildReceiptHtml,
  list: (query, req) => contributionRepository.list({ ...query, ...scopeFor(req) }),
  getById: (id, req) => contributionRepository.getById(id, scopeFor(req)),
};
