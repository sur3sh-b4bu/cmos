const reportRepository = require('../repositories/reportRepository');
const asyncHandler = require('../utils/asyncHandler');

const prayerIntentions = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, massId, statusId } = req.query;
  const result = await reportRepository.prayerIntentionsReport({
    churchId: req.user.churchId,
    dateFrom,
    dateTo,
    massId,
    statusId,
  });
  res.json({ success: true, data: result });
});

const collections = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, paymentMethodId } = req.query;
  const result = await reportRepository.collectionsReport({
    churchId: req.user.churchId,
    dateFrom,
    dateTo,
    paymentMethodId,
  });
  res.json({ success: true, data: result });
});

const certificates = asyncHandler(async (req, res) => {
  const { type, dateFrom, dateTo } = req.query;
  const result = await reportRepository.certificatesReport({
    churchId: req.user.churchId,
    type,
    dateFrom,
    dateTo,
  });
  res.json({ success: true, data: result });
});

module.exports = { prayerIntentions, collections, certificates };
