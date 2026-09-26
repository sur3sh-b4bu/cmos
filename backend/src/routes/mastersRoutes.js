const express = require('express');
const controller = require('../controllers/mastersController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const { churchLogoUpload } = require('../middlewares/upload');

const router = express.Router();

router.use(authenticate);

// The Masters *admin hub* (enumerating every configurable table) stays
// gated by masters.view -- that's an administration screen.
router.get('/', authorize('masters.view'), controller.listMasterKeys);

// Reading a single master table's rows, however, is not an admin action --
// it's how every data-entry form in the app (Mass Intentions' Mass/
// Intention/Payment-Method selects, Certificates' Gender/Priest selects, the
// Critical Days list used to block bookings, etc.) populates its dropdowns.
// Gating it behind masters.view meant roles without that admin permission
// (e.g. Office Staff, who create mass intentions and certificates all day)
// could not load ANY dropdown anywhere in the app -- any authenticated user
// may read reference data; only masters.create/update/delete can change it.
router.get('/:masterKey', controller.list);
router.get('/:masterKey/:id', controller.getById);
router.post('/:masterKey', authorize('masters.create'), controller.create);
router.put('/:masterKey/:id', authorize('masters.update'), controller.update);
// Literal /churches/:id/logo path -- registered ahead of the generic
// /:masterKey/... routes below only for readability; Express wouldn't
// actually confuse the two since the segment counts differ.
router.post('/churches/:id/logo', authorize('masters.update'), churchLogoUpload, controller.uploadChurchLogo);
router.post('/:masterKey/reorder', authorize('masters.update'), controller.reorder);
router.post('/:masterKey/:id/set-default', authorize('masters.update'), controller.setDefault);
router.delete('/:masterKey/:id', authorize('masters.delete'), controller.remove);

module.exports = router;
