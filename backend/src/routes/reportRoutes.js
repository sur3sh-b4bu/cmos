const express = require('express');
const controller = require('../controllers/reportController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

const router = express.Router();
router.use(authenticate, authorize('reports.view'));

router.get('/mass-intentions', controller.massIntentions);
router.get('/mass-intentions/print', controller.massIntentionsPrint);
router.get('/collections', controller.collections);
router.get('/collections/detail', controller.collectionsDetail);
router.get('/collections/detail/print', controller.collectionsDetailPrint);
router.get('/contributions', controller.contributionCollections);
router.get('/contributions/detail', controller.contributionCollectionsDetail);
router.get('/contributions/detail/print', controller.contributionCollectionsDetailPrint);
router.get('/certificates', controller.certificates);
router.get('/certificates/print', controller.certificatesPrint);
router.get('/overall-financial', controller.overallFinancial);
router.get('/overall-financial/print', controller.overallFinancialPrint);

module.exports = router;
