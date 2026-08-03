const service = require('../services/prayerIntentionService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.query, req);
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const getById = asyncHandler(async (req, res) => {
  const row = await service.getById(req.params.id);
  if (!row) throw ApiError.notFound('Prayer intention not found');
  res.json({ success: true, data: row });
});

const create = asyncHandler(async (req, res) => {
  const row = await service.create(req.body, req);
  res.status(201).json({ success: true, data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await service.update(req.params.id, req.body, req);
  res.json({ success: true, data: row });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req);
  res.json({ success: true, message: 'Prayer intention deleted' });
});

const markCompleted = asyncHandler(async (req, res) => {
  const row = await service.markCompleted(req.params.id, req);
  res.json({ success: true, data: row });
});

const markAllCompleted = asyncHandler(async (req, res) => {
  const count = await service.markAllCompletedForDate(req.body.prayerDate, req);
  res.json({ success: true, message: `${count} prayer intention(s) marked completed` });
});

const printReceipt = asyncHandler(async (req, res) => {
  const { buffer, receiptNo } = await service.buildReceiptPdf(req.params.id, req);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="Receipt-${receiptNo}.pdf"`);
  res.send(buffer);
});

const dashboardStats = asyncHandler(async (req, res) => {
  const stats = await service.getDashboardStats(req);
  res.json({ success: true, data: stats });
});

module.exports = { list, getById, create, update, remove, markCompleted, markAllCompleted, printReceipt, dashboardStats };
