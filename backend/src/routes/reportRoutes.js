const express = require('express');
const controller = require('../controllers/reportController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

const router = express.Router();
router.use(authenticate, authorize('reports.view'));

router.get('/prayer-intentions', controller.prayerIntentions);
router.get('/collections', controller.collections);
router.get('/certificates', controller.certificates);

module.exports = router;
