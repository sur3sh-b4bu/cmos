const express = require('express');
const controller = require('../controllers/roleController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

const router = express.Router();
router.use(authenticate, authorize('roles.view'));

router.get('/', controller.listRoles);
router.get('/permissions/all', controller.listPermissions);
router.get('/:roleId/permissions', controller.getRolePermissions);
router.put('/:roleId/permissions', authorize('roles.update'), controller.setRolePermissions);

module.exports = router;
