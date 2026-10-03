const service = require('../services/massIntentionService');
const transfer = require('../services/massIntentionTransferService');
const asyncHandler = require('../utils/asyncHandler');
const { sendXlsx, langOf, mappingOf } = require('../excel/http');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.query, req);
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const getById = asyncHandler(async (req, res) => {
  const row = await service.getById(req.params.id, req);
  if (!row) throw ApiError.notFound('Mass intention not found');
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
  res.json({ success: true, message: 'Mass intention deleted' });
});

const refund = asyncHandler(async (req, res) => {
  const row = await service.refund(req.params.id, req.body, req);
  res.json({ success: true, data: row, message: 'Mass intention refunded' });
});

const unrefund = asyncHandler(async (req, res) => {
  const row = await service.unrefund(req.params.id, req);
  res.json({ success: true, data: row, message: 'Mass intention refund cancelled' });
});

const printReceipt = asyncHandler(async (req, res) => {
  const { buffer, receiptNo } = await service.buildReceiptPdf(req.params.id, req);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="Receipt-${receiptNo}.pdf"`);
  res.send(buffer);
});

// The one-click "Print" button's actual endpoint -- see receiptHtml.js's
// doc comment for why an HTML page, not the PDF above, is what the
// frontend now loads into its print iframe.
const printReceiptHtml = asyncHandler(async (req, res) => {
  const { html } = await service.buildReceiptHtml(req.params.id, req);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

const printBulkReceipt = asyncHandler(async (req, res) => {
  const batchId = req.query.batchId ? String(req.query.batchId) : undefined;
  const ids = String(req.query.ids || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!batchId && !ids.length) throw ApiError.badRequest('No mass intentions specified.');

  const buffer = await service.buildBulkReceiptPdf({ ids, batchId }, req);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="Mass-Intentions-Receipt-${Date.now()}.pdf"`);
  res.send(buffer);
});

/** "Show Bulk Mass Intentions" -- lets a Bulk save's combined receipt be
 * reprinted later, since it's otherwise only ever shown once, right after
 * saving (see mass-intentions-list.ts). */
const listBulkBatches = asyncHandler(async (req, res) => {
  const result = await service.listBulkBatches(req.query, req);
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const dashboardStats = asyncHandler(async (req, res) => {
  const stats = await service.getDashboardStats(req);
  res.json({ success: true, data: stats });
});

const exportExcel = asyncHandler(async (req, res) => {
  sendXlsx(res, await transfer.exportMassIntentions(req.query, req));
});

const importTemplate = asyncHandler(async (req, res) => {
  sendXlsx(res, await transfer.buildMassIntentionTemplate(req.query, req));
});

const importExcel = asyncHandler(async (req, res) => {
  const report = await transfer.importMassIntentions(
    { buffer: req.file.buffer, fileName: req.file.originalname, lang: langOf(req), mapping: mappingOf(req) },
    req
  );
  res.json({ success: true, data: report });
});

const importPreview = asyncHandler(async (req, res) => {
  const preview = await transfer.previewMassIntentionImport({ buffer: req.file.buffer, fileName: req.file.originalname, lang: langOf(req), churchId: req.user.churchId });
  res.json({ success: true, data: preview });
});

module.exports = {
  exportExcel,
  importTemplate,
  importExcel,
  importPreview,
  list,
  getById,
  create,
  update,
  remove,
  refund,
  unrefund,
  printReceipt,
  printReceiptHtml,
  printBulkReceipt,
  listBulkBatches,
  dashboardStats,
};
