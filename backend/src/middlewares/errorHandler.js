const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Express only recognizes an error-handling middleware by arity (exactly 4
// params) -- `next` must stay in the signature even though it's never
// called from in here.
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { stack: err.stack, path: req.originalUrl });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || undefined,
    });
  }

  // Multer's own errors (file too large, too many files, etc.) -- its error
  // codes are always named LIMIT_* -- surface as a normal 400 instead of the
  // generic 500 below.
  if (err.code && String(err.code).startsWith('LIMIT_')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // MySQL duplicate-entry -> 409 Conflict with a readable message.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with these details already exists.',
    });
  }

  // A value didn't fit the column's actual type (e.g. free text typed into
  // a TIME/DATE/numeric field, like "10:00 - 12:00" into a Mass's single
  // start-time column) -> 400 instead of the generic 500 below, since this
  // is bad input, not a server fault. Most such fields now use a proper
  // picker/typed input client-side (see master-config.ts's 'time' field
  // type), but this stays as a fallback for anything reachable without one
  // (bulk Excel import, direct API calls).
  if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.code === 'WARN_DATA_TRUNCATED') {
    return res.status(400).json({
      success: false,
      message: 'One of the values entered is not in a format this field accepts. Please check and try again.',
    });
  }

  logger.error(err.message || 'Unhandled error', { stack: err.stack, path: req.originalUrl });
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again.',
  });
}

module.exports = errorHandler;
