const reportRepository = require('../repositories/reportRepository');
const lookupRepository = require('../repositories/lookupRepository');
const auditService = require('../services/auditService');
const { generateCollectionsDetailPdf } = require('../reports/collectionsDetailPdf');
const { generateContributionCollectionsDetailPdf } = require('../reports/contributionCollectionsDetailPdf');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { effectiveBranchId } = require('../utils/effectiveScope');

/**
 * Two print buttons share these same endpoints (see reports.ts/html):
 * `?mine=true` -- every user with reports.view can always print their OWN
 * billed transactions for a day, no extra permission needed. Omitted/false
 * -- the all-users, per-row "who billed it" breakdown -- is the sensitive
 * one, gated to reports.print_all (ADMIN by default, see seed.js) and
 * enforced HERE rather than as route-level middleware since the same route
 * serves both variants depending on this query flag.
 */
function assertCanPrintAllUsers(req) {
  // Master Administrator is never narrowed by permissions (see middlewares/authorize.js), and
  // deliberately has none listed -- so it must be let through here too, not only at the route.
  if (req.user.roleCode === 'MASTER_ADMIN') return;
  if (!(req.user.permissions || []).includes('reports.print_all')) {
    throw ApiError.forbidden('Missing required permission: reports.print_all');
  }
}

const massIntentions = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, massId, paidOnly } = req.query;
  const result = await reportRepository.massIntentionsReport({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    dateFrom,
    dateTo,
    massId,
    paidOnly: paidOnly !== undefined ? paidOnly === 'true' : undefined,
  });
  res.json({ success: true, data: result });
});

const collections = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, method } = req.query;
  const result = await reportRepository.collectionsReport({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    dateFrom,
    dateTo,
    method,
  });
  res.json({ success: true, data: result });
});

const collectionsDetail = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, dateBasis } = req.query;
  const result = await reportRepository.collectionsRangeDetail({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    dateFrom,
    dateTo: dateTo || dateFrom,
    dateBasis,
  });
  res.json({ success: true, data: result });
});

const collectionsDetailPrint = asyncHandler(async (req, res) => {
  const { dateFrom, dateBasis } = req.query;
  const dateTo = req.query.dateTo || dateFrom;
  const mine = req.query.mine === 'true';
  if (!mine) assertCanPrintAllUsers(req);

  const [detail, church, currency] = await Promise.all([
    reportRepository.collectionsRangeDetail({
      churchId: req.user.churchId,
      branchId: effectiveBranchId(req),
      dateFrom,
      dateTo,
      userId: mine ? req.user.id : undefined,
      dateBasis,
    }),
    lookupRepository.getChurchById(req.user.churchId),
    lookupRepository.getDefaultCurrency(),
  ]);
  const buffer = await generateCollectionsDetailPdf({
    dateFrom,
    dateTo,
    church,
    rows: detail.rows,
    total: detail.total,
    generatedBy: req.user.username,
    currencySymbol: currency.symbol,
    mine,
    dateBasis,
    lang: req.query.lang === 'ta' ? 'ta' : 'en',
  });
  await auditService.fromRequest(req, {
    action: 'PRINT_REPORT',
    module: 'reports',
    entityType: 'collections_detail',
    newValues: { dateFrom, dateTo, count: detail.count, total: detail.total, mine },
  });
  res.set('Content-Type', 'application/pdf');
  const filenameSuffix = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;
  res.set('Content-Disposition', `inline; filename="Collections-${filenameSuffix}.pdf"`);
  res.send(buffer);
});

const contributionCollections = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, method } = req.query;
  const result = await reportRepository.contributionCollectionsReport({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    dateFrom,
    dateTo,
    method,
  });
  res.json({ success: true, data: result });
});

const contributionCollectionsDetail = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const result = await reportRepository.contributionCollectionsRangeDetail({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    dateFrom,
    dateTo: dateTo || dateFrom,
  });
  res.json({ success: true, data: result });
});

const contributionCollectionsDetailPrint = asyncHandler(async (req, res) => {
  const { dateFrom } = req.query;
  const dateTo = req.query.dateTo || dateFrom;
  const mine = req.query.mine === 'true';
  if (!mine) assertCanPrintAllUsers(req);

  const [detail, church, currency] = await Promise.all([
    reportRepository.contributionCollectionsRangeDetail({
      churchId: req.user.churchId,
      branchId: effectiveBranchId(req),
      dateFrom,
      dateTo,
      userId: mine ? req.user.id : undefined,
    }),
    lookupRepository.getChurchById(req.user.churchId),
    lookupRepository.getDefaultCurrency(),
  ]);
  const buffer = await generateContributionCollectionsDetailPdf({
    dateFrom,
    dateTo,
    church,
    rows: detail.rows,
    total: detail.total,
    generatedBy: req.user.username,
    currencySymbol: currency.symbol,
    mine,
    lang: req.query.lang === 'ta' ? 'ta' : 'en',
  });
  await auditService.fromRequest(req, {
    action: 'PRINT_REPORT',
    module: 'reports',
    entityType: 'contribution_collections_detail',
    newValues: { dateFrom, dateTo, count: detail.count, total: detail.total, mine },
  });
  res.set('Content-Type', 'application/pdf');
  const filenameSuffix = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;
  res.set('Content-Disposition', `inline; filename="Contributions-${filenameSuffix}.pdf"`);
  res.send(buffer);
});

const certificates = asyncHandler(async (req, res) => {
  const { type, dateFrom, dateTo } = req.query;
  const result = await reportRepository.certificatesReport({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    type,
    dateFrom,
    dateTo,
  });
  res.json({ success: true, data: result });
});

module.exports = {
  massIntentions,
  collections,
  collectionsDetail,
  collectionsDetailPrint,
  contributionCollections,
  contributionCollectionsDetail,
  contributionCollectionsDetailPrint,
  certificates,
};
