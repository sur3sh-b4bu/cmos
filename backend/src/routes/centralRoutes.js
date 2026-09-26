const express = require('express');
const controller = require('../controllers/centralController');
const authenticate = require('../middlewares/authenticate');
const masterAdminOnly = require('../middlewares/masterAdminOnly');

const router = express.Router();

// Central Management: organization-wide analytics. Master Administrator only.
router.use(authenticate, masterAdminOnly);

router.get('/overview', controller.overview);
router.get('/mass-intentions', controller.massIntentions);
router.get('/register', controller.register);
router.get('/certificates/:type', controller.certificates);
router.get('/contributions', controller.contributions);
router.get('/insights', controller.insights);
router.get('/branches', controller.branches);
router.get('/church/:id', controller.church);

module.exports = router;
