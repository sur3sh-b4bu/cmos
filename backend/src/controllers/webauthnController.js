const webauthnService = require('../services/webauthnService');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const getLoginOptions = asyncHandler(async (req, res) => {
  const { username } = req.body;
  if (!username) throw ApiError.badRequest('Username is required');
  const result = await webauthnService.getAuthenticationOptions(username);
  res.json({ success: true, data: result });
});

const verifyLogin = asyncHandler(async (req, res) => {
  const { username, response } = req.body;
  if (!username || !response) throw ApiError.badRequest('Username and response are required');
  const result = await webauthnService.verifyAuthentication(username, response, req);
  res.json({ success: true, data: result });
});

const getRegisterOptions = asyncHandler(async (req, res) => {
  const options = await webauthnService.getRegistrationOptions(req.user);
  res.json({ success: true, data: options });
});

const verifyRegister = asyncHandler(async (req, res) => {
  const { response, deviceLabel } = req.body;
  if (!response) throw ApiError.badRequest('Registration response is required');
  const result = await webauthnService.verifyRegistration(req.user, response, deviceLabel, req);
  res.json({ success: true, data: result });
});

const listDevices = asyncHandler(async (req, res) => {
  const devices = await webauthnService.listDevices(req.user.id);
  res.json({ success: true, data: devices });
});

const removeDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await webauthnService.removeDevice(id, req.user, req);
  res.json({ success: true, message: 'Device removed successfully' });
});

module.exports = {
  getLoginOptions,
  verifyLogin,
  getRegisterOptions,
  verifyRegister,
  listDevices,
  removeDevice,
};
