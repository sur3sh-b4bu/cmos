const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { page, pageSize, userId, module, fromDate, toDate, search } = req.query;
  const result = await auditService.list({
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 25,
    userId: userId ? Number(userId) : undefined,
    module,
    fromDate,
    toDate,
    search,
  });
  res.json({ success: true, data: result.rows, meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
});

module.exports = { list };
