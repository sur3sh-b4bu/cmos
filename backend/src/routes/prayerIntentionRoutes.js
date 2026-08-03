const express = require('express');
const controller = require('../controllers/prayerIntentionController');
const registerController = require('../controllers/prayerRegisterController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createSchema, updateSchema, registerDateQuery } = require('../validators/prayerIntentionValidators');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard-stats', authorize('dashboard.view'), controller.dashboardStats);

router.get('/register/preview', authorize('prayer_register.view'), validate({ query: registerDateQuery }), registerController.preview);
router.get('/register/print', authorize('prayer_register.print'), validate({ query: registerDateQuery }), registerController.print);

router.get('/', authorize('prayer_intentions.view'), controller.list);
router.get('/:id', authorize('prayer_intentions.view'), controller.getById);
router.post('/', authorize('prayer_intentions.create'), validate({ body: createSchema }), controller.create);
router.put('/:id', authorize('prayer_intentions.update'), validate({ body: updateSchema }), controller.update);
router.delete('/:id', authorize('prayer_intentions.delete'), controller.remove);

router.post('/mark-all-completed', authorize('prayer_intentions.update'), controller.markAllCompleted);
router.post('/:id/mark-completed', authorize('prayer_intentions.update'), controller.markCompleted);
router.get('/:id/receipt', authorize('prayer_intentions.print', 'receipts.print'), controller.printReceipt);

module.exports = router;
