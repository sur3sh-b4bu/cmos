const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireChurchContext = require('../middlewares/requireChurchContext');
const trashController = require('../controllers/trashController');

const router = express.Router();

router.use(authenticate, requireChurchContext);

router.get('/', trashController.listTrash);
router.post('/restore', trashController.restore);

module.exports = router;
