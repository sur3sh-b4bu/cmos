const service = require('../services/certificateService');
const transfer = require('../services/certificateTransferService');
const asyncHandler = require('../utils/asyncHandler');
const { sendXlsx, langOf, mappingOf } = require('../excel/http');

const list = asyncHandler(async (req, res) => {
  const result = await service.list(req.params.type, req.query, req);
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const getById = asyncHandler(async (req, res) => {
  const row = await service.getById(req.params.type, req.params.id, req);
  res.json({ success: true, data: row });
});

const create = asyncHandler(async (req, res) => {
  const row = await service.create(req.params.type, req.body, req);
  res.status(201).json({ success: true, data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await service.update(req.params.type, req.params.id, req.body, req);
  res.json({ success: true, data: row });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.type, req.params.id, req);
  res.json({ success: true, message: 'Certificate deleted' });
});

const printCertificate = asyncHandler(async (req, res) => {
  const { buffer, certificateNo } = await service.buildPdf(req.params.type, req.params.id, req);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="Certificate-${certificateNo}.pdf"`);
  res.send(buffer);
});

const exportExcel = asyncHandler(async (req, res) => {
  sendXlsx(res, await transfer.exportCertificates(req.params.type, req.query, req));
});

const importTemplate = asyncHandler(async (req, res) => {
  sendXlsx(res, await transfer.buildCertificateTemplate(req.params.type, req.query, req));
});

const importExcel = asyncHandler(async (req, res) => {
  const report = await transfer.importCertificates(
    req.params.type,
    { buffer: req.file.buffer, fileName: req.file.originalname, lang: langOf(req), mapping: mappingOf(req) },
    req
  );
  res.json({ success: true, data: report });
});

const importPreview = asyncHandler(async (req, res) => {
  const preview = await transfer.previewCertificateImport(req.params.type, {
    buffer: req.file.buffer,
    fileName: req.file.originalname,
    lang: langOf(req),
    churchId: req.user.churchId,
  });
  res.json({ success: true, data: preview });
});

module.exports = { list, getById, create, update, remove, printCertificate, exportExcel, importTemplate, importExcel, importPreview };
