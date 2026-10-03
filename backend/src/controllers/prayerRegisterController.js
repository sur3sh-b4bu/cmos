const service = require('../services/massIntentionService');
const asyncHandler = require('../utils/asyncHandler');

const preview = asyncHandler(async (req, res) => {
  const rows = await service.getRegisterPreview(req.query.date, req);
  res.json({ success: true, data: rows });
});

const print = asyncHandler(async (req, res) => {
  const namesOnly = req.query.namesOnly === true || req.query.namesOnly === 'true';
  const reasonsOnly = req.query.reasonsOnly === true || req.query.reasonsOnly === 'true' || req.query.mode === 'reasons';
  const massId = req.query.massId ? Number(req.query.massId) : null;
  const buffer = await service.buildDailyRegisterPdf(req.query.date, req, { namesOnly, reasonsOnly, massId });
  res.set('Content-Type', 'application/pdf');
  const suffix = reasonsOnly ? '-Reasons' : namesOnly ? '-Names' : '';
  const massSuffix = massId ? `-Mass-${massId}` : '';
  res.set('Content-Disposition', `inline; filename="Daily-Prayer-Register${suffix}${massSuffix}-${req.query.date}.pdf"`);
  res.send(buffer);
});

module.exports = { preview, print };
