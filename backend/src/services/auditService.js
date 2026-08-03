const auditLogRepository = require('../repositories/auditLogRepository');
const logger = require('../utils/logger');

/**
 * Fire-and-forget audit logging: a failure here must never break the
 * request that triggered it, so errors are caught and logged instead
 * of propagated.
 */
async function log(entry) {
  try {
    await auditLogRepository.record(entry);
  } catch (err) {
    logger.error('Failed to write audit log', { error: err.message, entry });
  }
}

function fromRequest(req, { action, module, entityType, entityId, oldValues, newValues }) {
  return log({
    userId: req.user?.id,
    username: req.user?.username,
    action,
    module,
    entityType,
    entityId,
    oldValues,
    newValues,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
}

module.exports = { log, fromRequest, list: auditLogRepository.list };
