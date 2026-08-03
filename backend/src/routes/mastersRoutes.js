const express = require('express');
const controller = require('../controllers/mastersController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('masters.view'), controller.listMasterKeys);
router.get('/:masterKey', authorize('masters.view'), controller.list);
router.get('/:masterKey/:id', authorize('masters.view'), controller.getById);
router.post('/:masterKey', authorize('masters.create'), controller.create);
router.put('/:masterKey/:id', authorize('masters.update'), controller.update);
router.post('/:masterKey/reorder', authorize('masters.update'), controller.reorder);
router.delete('/:masterKey/:id', authorize('masters.delete'), controller.remove);

module.exports = router;
