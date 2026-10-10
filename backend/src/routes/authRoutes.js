const express = require('express');
const authController = require('../controllers/authController');
const webauthnController = require('../controllers/webauthnController');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const { loginSchema, changePasswordSchema } = require('../validators/authValidators');

const router = express.Router();

router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.post('/refresh', (req, res) => {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'sid';
  const incoming = req.cookies?.[cookieName];
  if (!incoming) {
    return res.status(401).json({ success: false, message: 'No active session' });
  }
  return res.json({ success: true, message: 'Session active' });
});
router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

// WebAuthn Biometric Passkeys
router.post('/webauthn/login/options', webauthnController.getLoginOptions);
router.post('/webauthn/login/verify', webauthnController.verifyLogin);
router.post('/webauthn/register/options', authenticate, webauthnController.getRegisterOptions);
router.post('/webauthn/register/verify', authenticate, webauthnController.verifyRegister);
router.get('/webauthn/devices', authenticate, webauthnController.listDevices);
router.delete('/webauthn/devices/:id', authenticate, webauthnController.removeDevice);

module.exports = router;

