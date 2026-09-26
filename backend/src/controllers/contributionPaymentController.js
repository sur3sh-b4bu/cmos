const service = require('../services/contributionPaymentService');
const asyncHandler = require('../utils/asyncHandler');

const receivePayment = asyncHandler(async (req, res) => {
  const contribution = await service.receivePayment(req.params.id, req.body, req);
  res.json({ success: true, data: contribution });
});

module.exports = { receivePayment };
