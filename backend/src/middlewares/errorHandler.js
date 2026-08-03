const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

/* eslint-disable no-unused-vars */
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

  // MySQL duplicate-entry -> 409 Conflict with a readable message.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A record with these details already exists.',
    });
  }

  logger.error(err.message || 'Unhandled error', { stack: err.stack, path: req.originalUrl });
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again.',
  });
}

module.exports = errorHandler;
