const service = require('../services/massIntentionService');
const asyncHandler = require('../utils/asyncHandler');

const preview = asyncHandler(async (req, res) => {
  const rows = await service.getRegisterPreview(req.query.date, req);
  res.json({ success: true, data: rows });
});

const print = asyncHandler(async (req, res) => {
  const namesOnly = req.query.namesOnly === true || req.query.namesOnly === 'true';
  const buffer = await service.buildDailyRegisterPdf(req.query.date, req, { namesOnly });
  res.set('Content-Type', 'application/pdf');
  const suffix = namesOnly ? '-Names' : '';
  res.set('Content-Disposition', `inline; filename="Daily-Prayer-Register${suffix}-${req.query.date}.pdf"`);
  res.send(buffer);
});

module.exports = { preview, print };
