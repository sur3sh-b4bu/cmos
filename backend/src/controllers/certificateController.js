const service = require('../services/certificateService');
const asyncHandler = require('../utils/asyncHandler');

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

module.exports = { list, getById, create, update, remove, printCertificate };
