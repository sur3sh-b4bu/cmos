const express = require('express');
const controller = require('../controllers/churchSetupController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { applySchema } = require('../validators/churchSetupValidators');

const router = express.Router();

router.use(authenticate);

// Same permission as editing Masters: setting a church up is creating its
// receipt/certificate series, Masses, branch and priest.
router.get('/:churchId/status', authorize('masters.create'), controller.status);
router.post('/:churchId', authorize('masters.create'), validate({ body: applySchema }), controller.apply);

module.exports = router;
