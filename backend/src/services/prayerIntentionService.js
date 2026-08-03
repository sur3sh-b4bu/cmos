const prayerIntentionRepository = require('../repositories/prayerIntentionRepository');
const receiptSeriesRepository = require('../repositories/receiptSeriesRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('../services/auditService');
const { generateReceiptPdf } = require('../reports/receiptPdf');
const { generateDailyRegisterPdf } = require('../reports/dailyRegisterPdf');
const ApiError = require('../utils/ApiError');
const { pool } = require('../config/db');

async function resolveIntentionText(payload) {
  let prayerIntentionMasterId = payload.prayerIntentionMasterId || null;
  let customIntention = null;

  if (prayerIntentionMasterId) {
    const master = await lookupRepository.getPrayerIntentionMasterById(prayerIntentionMasterId);
    if (!master) throw ApiError.badRequest('Selected prayer intention is invalid');
    if (master.is_custom) {
      if (!payload.customIntention) {
        throw ApiError.badRequest('Please describe the prayer intention (required when "Others" is selected)');
      }
      customIntention = payload.customIntention.trim();
    }
  } else {
    if (!payload.customIntention) {
      throw ApiError.badRequest('Select a prayer intention or describe a custom one');
    }
    customIntention = payload.customIntention.trim();
  }

  return { prayerIntentionMasterId, customIntention };
}

async function create(payload, req) {
  const mass = await lookupRepository.getMassById(payload.massId);
  if (!mass) throw ApiError.badRequest('Selected Mass is invalid');

  const { prayerIntentionMasterId, customIntention } = await resolveIntentionText(payload);

  if (!payload.allowDuplicate) {
    const duplicate = await prayerIntentionRepository.findPotentialDuplicate({
      name: payload.name,
      phone: payload.phone || null,
      prayerDate: payload.prayerDate,
      massId: payload.massId,
      prayerIntentionMasterId,
    });
    if (duplicate) {
      throw ApiError.conflict(
        `A prayer intention for "${payload.name}" on this date and Mass already exists (Receipt ${duplicate.receipt_no}). Resubmit with allowDuplicate to add it anyway.`
      );
    }
  }

  const churchId = req.user.churchId;
  const statusId = await lookupRepository.getStatusIdByCode('prayer_intention', 'PENDING');
  const receiptNo = await receiptSeriesRepository.claimNextReceiptNumber(churchId);

  const created = await prayerIntentionRepository.create(
    {
      church_id: churchId,
      branch_id: req.user.branchId,
      receipt_no: receiptNo,
      name: payload.name.trim(),
      phone: payload.phone || null,
      prayer_date: payload.prayerDate,
      mass_id: payload.massId,
      prayer_intention_master_id: prayerIntentionMasterId,
      custom_intention: customIntention,
      offering_amount: payload.offeringAmount,
      payment_method_id: payload.paymentMethodId || null,
      remarks: payload.remarks || null,
      status_id: statusId,
    },
    req.user.id
  );

  await auditService.fromRequest(req, {
    action: 'CREATE',
    module: 'prayer_intentions',
    entityType: 'prayer_intentions',
    entityId: created.id,
    newValues: created,
  });

  return created;
}

async function update(id, payload, req) {
  const existing = await prayerIntentionRepository.getById(id);
  if (!existing) throw ApiError.notFound('Prayer intention not found');

  const patch = {};
  if (payload.name !== undefined) patch.name = payload.name.trim();
  if (payload.phone !== undefined) patch.phone = payload.phone || null;
  if (payload.prayerDate !== undefined) patch.prayer_date = payload.prayerDate;
  if (payload.massId !== undefined) {
    const mass = await lookupRepository.getMassById(payload.massId);
    if (!mass) throw ApiError.badRequest('Selected Mass is invalid');
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

  const updated = await prayerIntentionRepository.update(id, patch, req.user.id);

  await auditService.fromRequest(req, {
    action: 'UPDATE',
    module: 'prayer_intentions',
    entityType: 'prayer_intentions',
    entityId: id,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
}

async function remove(id, req) {
  const existing = await prayerIntentionRepository.getById(id);
  if (!existing) throw ApiError.notFound('Prayer intention not found');
  await prayerIntentionRepository.softDelete(id, req.user.id);
  await auditService.fromRequest(req, {
    action: 'DELETE',
    module: 'prayer_intentions',
    entityType: 'prayer_intentions',
    entityId: id,
    oldValues: existing,
  });
}

async function markCompleted(id, req) {
  const existing = await prayerIntentionRepository.getById(id);
  if (!existing) throw ApiError.notFound('Prayer intention not found');
  const statusId = await lookupRepository.getStatusIdByCode('prayer_intention', 'COMPLETED');
  const updated = await prayerIntentionRepository.markCompleted(id, req.user.id, statusId);
  await auditService.fromRequest(req, {
    action: 'MARK_COMPLETED',
    module: 'prayer_intentions',
    entityType: 'prayer_intentions',
    entityId: id,
    oldValues: { status_id: existing.status_id },
    newValues: { status_id: statusId },
  });
  return updated;
}

async function markAllCompletedForDate(prayerDate, req) {
  const statusId = await lookupRepository.getStatusIdByCode('prayer_intention', 'COMPLETED');
  const count = await prayerIntentionRepository.markAllCompletedForDate(
    prayerDate,
    req.user.churchId,
    statusId,
    req.user.id
  );
  await auditService.fromRequest(req, {
    action: 'MARK_ALL_COMPLETED',
    module: 'prayer_intentions',
    entityType: 'prayer_intentions',
    newValues: { prayerDate, count },
  });
  return count;
}

async function buildReceiptPdf(id, req) {
  const intention = await prayerIntentionRepository.getById(id);
  if (!intention) throw ApiError.notFound('Prayer intention not found');
  const church = await lookupRepository.getChurchById(intention.church_id);
  const [[setting]] = await pool.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'RECEIPT_THANK_YOU_MESSAGE' LIMIT 1"
  );
  const buffer = await generateReceiptPdf(intention, church, setting?.setting_value);
  await auditService.fromRequest(req, {
    action: 'PRINT_RECEIPT',
    module: 'prayer_intentions',
    entityType: 'prayer_intentions',
    entityId: id,
  });
  return { buffer, receiptNo: intention.receipt_no };
}

async function buildDailyRegisterPdf(prayerDate, req) {
  const entries = await prayerIntentionRepository.getRegisterData(prayerDate, req.user.churchId);
  const church = await lookupRepository.getChurchById(req.user.churchId);
  const buffer = await generateDailyRegisterPdf({
    prayerDate,
    church,
    entries,
    generatedBy: req.user.username,
  });
  await auditService.fromRequest(req, {
    action: 'PRINT_REGISTER',
    module: 'prayer_register',
    entityType: 'prayer_register',
    newValues: { prayerDate, count: entries.length },
  });
  return buffer;
}

async function getRegisterPreview(prayerDate, req) {
  return prayerIntentionRepository.getRegisterData(prayerDate, req.user.churchId);
}

async function getDashboardStats(req) {
  return prayerIntentionRepository.getDashboardStats(req.user.churchId);
}

module.exports = {
  create,
  update,
  remove,
  markCompleted,
  markAllCompletedForDate,
  buildReceiptPdf,
  buildDailyRegisterPdf,
  getRegisterPreview,
  getDashboardStats,
  list: (query, req) => prayerIntentionRepository.list({ ...query, churchId: req.user.churchId }),
  getById: prayerIntentionRepository.getById,
};
