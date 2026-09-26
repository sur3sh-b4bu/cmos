'use strict';

const service = require('../central/centralService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/** Analytics are computed live from the records, so they must never be served from a cache. */
const respond = (handler) =>
  asyncHandler(async (req, res) => {
    const data = await handler(req);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data });
  });

const churchIdParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw ApiError.badRequest('Invalid church id');
  return id;
};

module.exports = {
  overview: respond((req) => service.getOverview(req.query)),
  massIntentions: respond((req) => service.getMassIntentions(req.query)),
  register: respond((req) => service.getRegister(req.query)),
  certificates: respond((req) => service.getCertificates(req.params.type, req.query)),
  contributions: respond((req) => service.getContributions(req.query)),
  insights: respond((req) => service.getInsights(req.query)),
  branches: respond((req) => service.getBranchPerformance(req.query)),
  church: respond((req) => service.getChurch(churchIdParam(req), req.query)),
};
