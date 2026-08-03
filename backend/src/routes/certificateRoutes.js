const express = require('express');
const controller = require('../controllers/certificateController');
const authenticate = require('../middlewares/authenticate');
const ApiError = require('../utils/ApiError');
const registry = require('../config/certificateRegistry');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

/** Certificate permissions are keyed per-type (baptism_certificates.view, etc.), resolved at request time. */
function authorizeCertificate(action) {
  return (req, res, next) => {
    const config = registry[req.params.type];
    if (!config) return next(ApiError.notFound(`Unknown certificate type: ${req.params.type}`));
    const permissionCode = `${config.permissionPrefix}.${action}`;
    if (!req.user.permissions.includes(permissionCode)) {
      return next(ApiError.forbidden(`Missing required permission: ${permissionCode}`));
    }
    next();
  };
}

router.get('/:type', authorizeCertificate('view'), controller.list);
router.get('/:type/:id', authorizeCertificate('view'), controller.getById);
router.post('/:type', authorizeCertificate('create'), controller.create);
router.put('/:type/:id', authorizeCertificate('update'), controller.update);
router.delete('/:type/:id', authorizeCertificate('delete'), controller.remove);
router.get('/:type/:id/print', authorizeCertificate('print'), controller.printCertificate);

module.exports = router;
