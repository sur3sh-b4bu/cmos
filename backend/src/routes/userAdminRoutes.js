const express = require('express');
const controller = require('../controllers/userAdminController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createSchema, updateSchema } = require('../validators/userAdminValidators');

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('users.view'), controller.list);
router.get('/:id', authorize('users.view'), controller.getById);
router.post('/', authorize('users.create'), validate({ body: createSchema }), controller.create);
router.put('/:id', authorize('users.update'), validate({ body: updateSchema }), controller.update);
router.post('/:id/activate', authorize('users.update'), controller.activate);
router.post('/:id/deactivate', authorize('users.update'), controller.deactivate);
router.post('/:id/reset-password', authorize('users.update'), controller.resetPassword);

module.exports = router;
