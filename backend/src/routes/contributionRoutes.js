const express = require('express');
const controller = require('../controllers/contributionController');
const paymentController = require('../controllers/contributionPaymentController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const requireChurchContext = require('../middlewares/requireChurchContext');
const uploadExcel = require('../middlewares/uploadExcel');
const validate = require('../middlewares/validate');
const { createSchema, updateSchema, receivePaymentSchema } = require('../validators/contributionValidators');

const router = express.Router();
router.use(authenticate, requireChurchContext);

router.get('/', authorize('contributions.view'), controller.list);
// Excel import/export -- static routes, registered before '/:id'.
router.get('/export', authorize('contributions.view'), controller.exportExcel);
router.get('/import-template', authorize('contributions.create'), controller.importTemplate);
router.post('/import', authorize('contributions.create'), uploadExcel, controller.importExcel);
router.post('/import/preview', authorize('contributions.create'), uploadExcel, controller.importPreview);
router.get('/:id', authorize('contributions.view'), controller.getById);
router.post('/', authorize('contributions.create'), validate({ body: createSchema }), controller.create);
router.put('/:id', authorize('contributions.update'), validate({ body: updateSchema }), controller.update);
router.delete('/:id', authorize('contributions.delete'), controller.remove);

router.get('/:id/receipt', authorize('contributions.print', 'receipts.print'), controller.printReceipt);
// The one-click "Print" button's endpoint -- see receiptHtml.js's doc
// comment (Mass Intentions' equivalent) for why the frontend loads this
// HTML view rather than the PDF above into its print iframe.
router.get('/:id/receipt/print', authorize('contributions.print', 'receipts.print'), controller.printReceiptHtml);

// Step 2 of the payment workflow -- see contributionPaymentService's
// receivePayment() comment. The UPI demo-QR step (step 1) is shared with
// Mass Intentions at /mass-intentions/payment/demo-qr -- it doesn't touch
// either entity's table, so there's nothing contribution-specific to route here.
router.post(
  '/:id/payment/receive',
  authorize('contributions.update'),
  validate({ body: receivePaymentSchema }),
  paymentController.receivePayment
);

module.exports = router;
