const service = require('../services/prayerIntentionService');
const asyncHandler = require('../utils/asyncHandler');

const preview = asyncHandler(async (req, res) => {
  const rows = await service.getRegisterPreview(req.query.date, req);
  res.json({ success: true, data: rows });
});

const print = asyncHandler(async (req, res) => {
  const buffer = await service.buildDailyRegisterPdf(req.query.date, req);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="Daily-Prayer-Register-${req.query.date}.pdf"`);
  res.send(buffer);
});

module.exports = { preview, print };
