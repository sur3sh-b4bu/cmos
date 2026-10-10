'use strict';

const familyService = require('../services/familyService');
const { getEffectiveScope } = require('../utils/effectiveScope');

async function list(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const query = {
      ...req.query,
      churchId: scope.churchId,
      branchId: scope.branchId,
    };
    const result = await familyService.getFamilies(query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const family = await familyService.getFamilyDetail(Number(req.params.id), scope);
    res.json({ success: true, data: family });
  } catch (err) {
    next(err);
  }
}

async function getNextCode(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const code = await familyService.getNextCode(scope.churchId);
    res.json({ success: true, data: { family_code: code } });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const payload = {
      ...req.body,
      church_id: scope.churchId,
      branch_id: scope.branchId || req.body.branch_id,
    };
    const family = await familyService.createFamily(payload, req.user);
    res.status(201).json({ success: true, data: family });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const payload = {
      ...req.body,
      church_id: scope.churchId,
    };
    const family = await familyService.updateFamily(Number(req.params.id), payload, req.user);
    res.json({ success: true, data: family });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    await familyService.deleteFamily(Number(req.params.id), req.user, scope);
    res.json({ success: true, message: 'Family deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function addMember(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const payload = {
      ...req.body,
      church_id: scope.churchId,
    };
    const member = await familyService.addMember(Number(req.params.id), payload, req.user);
    res.status(201).json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

async function updateMember(req, res, next) {
  try {
    const member = await familyService.updateMember(Number(req.params.memberId), req.body, req.user);
    res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    await familyService.removeMember(Number(req.params.memberId), req.user);
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
}

async function splitFamily(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const payload = {
      ...req.body,
      church_id: scope.churchId,
      branch_id: scope.branchId || req.body.branch_id,
    };
    const newFamily = await familyService.splitFamily(Number(req.params.id), payload, req.user);
    res.status(201).json({ success: true, data: newFamily, message: 'Family divided successfully' });
  } catch (err) {
    next(err);
  }
}

async function migrateFamily(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const payload = {
      ...req.body,
      church_id: scope.churchId,
    };
    const family = await familyService.migrateFamily(Number(req.params.id), payload, req.user);
    res.json({ success: true, data: family, message: 'Migration status updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function getCensus(req, res, next) {
  try {
    const scope = getEffectiveScope(req);
    const stats = await familyService.getCensus(scope.churchId, scope.branchId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  getNextCode,
  create,
  update,
  remove,
  addMember,
  updateMember,
  removeMember,
  splitFamily,
  migrateFamily,
  getCensus,
};
