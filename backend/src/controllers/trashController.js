const asyncHandler = require('../utils/asyncHandler');
const trashRepository = require('../repositories/trashRepository');
const auditLogRepository = require('../repositories/auditLogRepository');

const listTrash = asyncHandler(async (req, res) => {
  const { moduleKey = 'mass_intentions', page = 1, pageSize = 25, search } = req.query;

  const result = await trashRepository.listTrash({
    moduleKey,
    page,
    pageSize,
    search,
    churchId: req.user.churchId,
  });

  res.json({ success: true, data: result });
});

const restore = asyncHandler(async (req, res) => {
  const { moduleKey, id } = req.body;

  if (!moduleKey || !id) {
    return res.status(400).json({ success: false, message: 'moduleKey and id are required' });
  }

  const restored = await trashRepository.restoreRecord({
    moduleKey,
    id: Number(id),
    churchId: req.user.churchId,
    userId: req.user.id,
  });

  if (!restored) {
    return res.status(404).json({ success: false, message: 'Record not found in trash or already restored' });
  }

  await auditLogRepository.record({
    userId: req.user.id,
    username: req.user.username,
    action: 'RESTORE_RECORD',
    module: moduleKey,
    entityType: moduleKey,
    entityId: id,
    newValues: { is_deleted: 0, is_active: 1 },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({ success: true, message: 'Record successfully restored' });
});

module.exports = { listTrash, restore };
