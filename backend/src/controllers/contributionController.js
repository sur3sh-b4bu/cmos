const service = require('../services/contributionService');
const transfer = require('../services/contributionTransferService');
const asyncHandler = require('../utils/asyncHandler');
const { sendXlsx, langOf, mappingOf } = require('../excel/http');
const ApiError = require('../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.query, req);
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const getById = asyncHandler(async (req, res) => {
  const row = await service.getById(req.params.id, req);
  if (!row) throw ApiError.notFound('Contribution not found');
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
  res.json({ success: true, message: 'Contribution deleted' });
});

const refund = asyncHandler(async (req, res) => {
  const row = await service.refund(req.params.id, req.body, req);
  res.json({ success: true, data: row, message: 'Contribution refunded' });
});

const unrefund = asyncHandler(async (req, res) => {
  const row = await service.unrefund(req.params.id, req);
  res.json({ success: true, data: row, message: 'Contribution refund cancelled' });
});

const printReceipt = asyncHandler(async (req, res) => {
  const { buffer, receiptNo } = await service.buildReceiptPdf(req.params.id, req);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="Contribution-Receipt-${receiptNo}.pdf"`);
  res.send(buffer);
});

// The one-click "Print" button's actual endpoint -- see receiptHtml.js's
// doc comment (Mass Intentions' equivalent) for why an HTML page, not the
// PDF above, is what the frontend now loads into its print iframe.
const printReceiptHtml = asyncHandler(async (req, res) => {
  const { html } = await service.buildReceiptHtml(req.params.id, req);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

const exportExcel = asyncHandler(async (req, res) => {
  sendXlsx(res, await transfer.exportContributions(req.query, req));
});

const importTemplate = asyncHandler(async (req, res) => {
  sendXlsx(res, await transfer.buildContributionTemplate(req.query, req));
});

const importExcel = asyncHandler(async (req, res) => {
  const report = await transfer.importContributions(
    { buffer: req.file.buffer, fileName: req.file.originalname, lang: langOf(req), mapping: mappingOf(req) },
    req
  );
  res.json({ success: true, data: report });
});

const importPreview = asyncHandler(async (req, res) => {
  const preview = await transfer.previewContributionImport({ buffer: req.file.buffer, fileName: req.file.originalname, lang: langOf(req), churchId: req.user.churchId });
  res.json({ success: true, data: preview });
});

module.exports = { list, getById, create, update, remove, refund, unrefund, printReceipt, printReceiptHtml, exportExcel, importTemplate, importExcel, importPreview };
