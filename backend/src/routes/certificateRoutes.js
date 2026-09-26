const express = require('express');
const controller = require('../controllers/certificateController');
const authenticate = require('../middlewares/authenticate');
const requireChurchContext = require('../middlewares/requireChurchContext');
const uploadExcel = require('../middlewares/uploadExcel');
const ApiError = require('../utils/ApiError');
const registry = require('../config/certificateRegistry');

const router = express.Router({ mergeParams: true });
router.use(authenticate, requireChurchContext);

/** Certificate permissions are keyed per-type (baptism_certificates.view, etc.), resolved at request time. */
function authorizeCertificate(action) {
  return (req, res, next) => {
    // Cross-church superuser -- same bypass as the shared authorize.js
    // middleware. Master Administrator is deliberately seeded with an
    // empty permissions array (see seed.js), so without this it would fail
    // every permission check below unconditionally.
    if (req.user.roleCode === 'MASTER_ADMIN') return next();
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
// Static second segments -- must be registered before '/:type/:id' below.
router.get('/:type/export', authorizeCertificate('view'), controller.exportExcel);
router.get('/:type/import-template', authorizeCertificate('create'), controller.importTemplate);
router.post('/:type/import', authorizeCertificate('create'), uploadExcel, controller.importExcel);
router.post('/:type/import/preview', authorizeCertificate('create'), uploadExcel, controller.importPreview);
router.get('/:type/:id', authorizeCertificate('view'), controller.getById);
router.post('/:type', authorizeCertificate('create'), controller.create);
router.put('/:type/:id', authorizeCertificate('update'), controller.update);
router.delete('/:type/:id', authorizeCertificate('delete'), controller.remove);
router.get('/:type/:id/print', authorizeCertificate('print'), controller.printCertificate);

module.exports = router;
