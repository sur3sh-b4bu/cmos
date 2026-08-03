const express = require('express');
const controller = require('../controllers/auditLogController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

const router = express.Router();
router.use(authenticate, authorize('audit_logs.view'));

router.get('/', controller.list);

module.exports = router;
