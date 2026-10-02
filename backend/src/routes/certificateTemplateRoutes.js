const express = require('express');
const controller = require('../controllers/certificateTemplateController');
const authenticate = require('../middlewares/authenticate');
const requireChurchContext = require('../middlewares/requireChurchContext');
const authorize = require('../middlewares/authorize');

const router = express.Router();
router.use(authenticate, requireChurchContext);

router.get('/', controller.getAll);
router.get('/:type/preview', controller.preview);
router.get('/:type', controller.getByType);
router.put('/:type', controller.update);
router.post('/:type/reset', controller.reset);

module.exports = router;
