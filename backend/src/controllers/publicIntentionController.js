const service = require('../services/publicIntentionService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const TOKEN_PATTERN = /^[a-f0-9]{32}$/i;

/** Reject anything that isn't token-shaped before it ever reaches the database. */
function requireValidToken(token) {
  if (!TOKEN_PATTERN.test(token || '')) {
    throw ApiError.notFound('This receipt link is not valid.');
  }
}

const summary = asyncHandler(async (req, res) => {
  requireValidToken(req.params.token);
  const data = await service.getPublicSummary(req.params.token);
  res.json({ success: true, data });
});

const calendar = asyncHandler(async (req, res) => {
  requireValidToken(req.params.token);

  // Reminder lead time is chosen by the parishioner on the page; clamp it to
  // a sane range so a hand-edited query string can't produce a broken alarm.
  const raw = req.query.reminder;
  let reminderMinutesBefore = 60;
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10080) {
      throw ApiError.badRequest('Reminder must be between 0 minutes and 7 days before.');
    }
    reminderMinutesBefore = Math.round(parsed);
  }

  const { ics, filename } = await service.buildCalendarFile(req.params.token, reminderMinutesBefore);

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(ics);
});

module.exports = { summary, calendar };
