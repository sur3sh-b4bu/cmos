const express = require('express');
const controller = require('../controllers/userAdminController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createSchema, updateSchema } = require('../validators/userAdminValidators');

const router = express.Router();
router.use(authenticate);
// No requireChurchContext here (unlike mass-intentions/contributions/
// certificates/reports) -- Master Administrator can manage Users while in
// Central Management: its own list is unrestricted across every church by
// default (see userAdminRepository's addChurchScope), and creating a user
// still requires a church, just picked per-record on the form itself
// (userAdminService.create()'s own churchId/'Select a church' check),
// exactly like a Masters row.

router.get('/', authorize('users.view'), controller.list);
router.get('/:id', authorize('users.view'), controller.getById);
router.post('/', authorize('users.create'), validate({ body: createSchema }), controller.create);
router.put('/:id', authorize('users.update'), validate({ body: updateSchema }), controller.update);
router.post('/:id/activate', authorize('users.update'), controller.activate);
router.post('/:id/deactivate', authorize('users.update'), controller.deactivate);
router.post('/:id/reset-password', authorize('users.update'), controller.resetPassword);

module.exports = router;
