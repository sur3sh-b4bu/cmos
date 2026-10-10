'use strict';

const express = require('express');
const router = express.Router();
const familyController = require('../controllers/familyController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const requireChurchContext = require('../middlewares/requireChurchContext');

router.use(authenticate, requireChurchContext);

// Census & stats
router.get('/stats/census', authorize('families.view'), familyController.getCensus);
router.get('/next-code', authorize('families.create'), familyController.getNextCode);

// Families CRUD
router.get('/', authorize('families.view'), familyController.list);
router.get('/:id', authorize('families.view'), familyController.getById);
router.post('/', authorize('families.create'), familyController.create);
router.put('/:id', authorize('families.update'), familyController.update);
router.delete('/:id', authorize('families.delete'), familyController.remove);

// Family Split & Migration Actions
router.post('/:id/split', authorize('families.update'), familyController.splitFamily);
router.post('/:id/migrate', authorize('families.update'), familyController.migrateFamily);

// Members sub-resources
router.post('/:id/members', authorize('families.update'), familyController.addMember);
router.put('/members/:memberId', authorize('families.update'), familyController.updateMember);
router.delete('/members/:memberId', authorize('families.update'), familyController.removeMember);

module.exports = router;
