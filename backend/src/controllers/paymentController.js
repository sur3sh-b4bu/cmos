const service = require('../services/paymentService');
const asyncHandler = require('../utils/asyncHandler');

const receivePayment = asyncHandler(async (req, res) => {
  const intention = await service.receivePayment(req.params.id, req.body, req);
  res.json({ success: true, data: intention });
});

const demoQr = asyncHandler(async (req, res) => {
  const intent = await service.generateDemoQr(req.body, req);
  res.json({ success: true, data: intent });
});

module.exports = { receivePayment, demoQr };
