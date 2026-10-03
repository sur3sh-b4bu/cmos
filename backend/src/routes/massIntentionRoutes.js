const express = require('express');
const controller = require('../controllers/massIntentionController');
const registerController = require('../controllers/prayerRegisterController');
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const requireChurchContext = require('../middlewares/requireChurchContext');
const uploadExcel = require('../middlewares/uploadExcel');
const validate = require('../middlewares/validate');
const {
  createSchema,
  updateSchema,
  registerDateQuery,
  receivePaymentSchema,
  demoQrSchema,
} = require('../validators/massIntentionValidators');

const router = express.Router();
router.use(authenticate, requireChurchContext);

router.get('/dashboard-stats', authorize('dashboard.view'), controller.dashboardStats);

router.get('/register/preview', authorize('prayer_register.view'), validate({ query: registerDateQuery }), registerController.preview);
router.get('/register/print', authorize('prayer_register.print'), validate({ query: registerDateQuery }), registerController.print);

// Static route -- must be registered before the '/:id' routes below, and
// deliberately takes no intention id: it's used both before a Mass
// Intention is saved (the form's inline UPI panel) and after, so it only
// needs amount/purpose, not a record to attach to. See paymentService.generateDemoQr().
router.post(
  '/payment/demo-qr',
  authorize('mass_intentions.create'),
  validate({ body: demoQrSchema }),
  paymentController.demoQr
);

router.get('/', authorize('mass_intentions.view'), controller.list);
// Static route -- must be registered before '/:id' below. "Show Bulk Mass
// Intentions" -- see controller.listBulkBatches.
router.get('/bulk-batches', authorize('mass_intentions.view'), controller.listBulkBatches);
// Excel import/export -- static routes, registered before '/:id'.
router.get('/export', authorize('mass_intentions.view'), controller.exportExcel);
router.get('/import-template', authorize('mass_intentions.create'), controller.importTemplate);
router.post('/import', authorize('mass_intentions.create'), uploadExcel, controller.importExcel);
router.post('/import/preview', authorize('mass_intentions.create'), uploadExcel, controller.importPreview);
router.get('/:id', authorize('mass_intentions.view'), controller.getById);
router.post('/', authorize('mass_intentions.create'), validate({ body: createSchema }), controller.create);
router.put('/:id', authorize('mass_intentions.update'), validate({ body: updateSchema }), controller.update);
router.post('/:id/refund', authorize('mass_intentions.update'), controller.refund);
router.post('/:id/unrefund', authorize('mass_intentions.update'), controller.unrefund);
router.delete('/:id', authorize('mass_intentions.delete'), controller.remove);

// Static route -- must be registered before '/:id/receipt' below for
// readability (Express wouldn't actually confuse the two regardless, since
// 'bulk' as a literal second segment never matches '/:id/receipt's literal
// 'receipt' segment). One combined receipt for a whole Bulk Mass Intention
// batch -- see massIntentionService.buildBulkReceiptPdf / bulkReceiptPdf.js.
router.get('/receipt/bulk', authorize('mass_intentions.print', 'receipts.print'), controller.printBulkReceipt);
router.get('/:id/receipt', authorize('mass_intentions.print', 'receipts.print'), controller.printReceipt);
// The one-click "Print" button's endpoint -- see receiptHtml.js's doc
// comment for why the frontend loads this HTML view rather than the PDF
// above into its print iframe. Same permissions as the PDF.
router.get('/:id/receipt/print', authorize('mass_intentions.print', 'receipts.print'), controller.printReceiptHtml);

// Step 2 of the payment workflow -- see massIntentionService's create()/buildReceiptPdf() comments.
router.post(
  '/:id/payment/receive',
  authorize('mass_intentions.update'),
  validate({ body: receivePaymentSchema }),
  paymentController.receivePayment
);

module.exports = router;
