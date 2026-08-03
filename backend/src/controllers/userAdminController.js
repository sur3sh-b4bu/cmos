const service = require('../services/userAdminService');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, search } = req.query;
  const result = await service.list({ page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 25, search }, req);
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

const getById = asyncHandler(async (req, res) => {
  const row = await service.getById(req.params.id, req);
  res.json({ success: true, data: row });
});

const create = asyncHandler(async (req, res) => {
  const { user, tempPassword } = await service.create(req.body, req);
  res.status(201).json({ success: true, data: { user, tempPassword } });
});

const update = asyncHandler(async (req, res) => {
  const row = await service.update(req.params.id, req.body, req);
  res.json({ success: true, data: row });
});

const activate = asyncHandler(async (req, res) => {
  await service.setActive(req.params.id, true, req);
  res.json({ success: true, message: 'User activated' });
});

const deactivate = asyncHandler(async (req, res) => {
  await service.setActive(req.params.id, false, req);
  res.json({ success: true, message: 'User deactivated' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { tempPassword } = await service.resetPassword(req.params.id, req);
  res.json({ success: true, data: { tempPassword } });
});

module.exports = { list, getById, create, update, activate, deactivate, resetPassword };
