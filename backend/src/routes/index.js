const express = require('express');
const authRoutes = require('./authRoutes');
const mastersRoutes = require('./mastersRoutes');
const massIntentionRoutes = require('./massIntentionRoutes');
const contributionRoutes = require('./contributionRoutes');
const certificateRoutes = require('./certificateRoutes');
const certificateTemplateRoutes = require('./certificateTemplateRoutes');
const reportRoutes = require('./reportRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const userAdminRoutes = require('./userAdminRoutes');
const roleRoutes = require('./roleRoutes');
const churchSetupRoutes = require('./churchSetupRoutes');
const centralRoutes = require('./centralRoutes');
const publicRoutes = require('./publicRoutes');
const trashRoutes = require('./trashRoutes');
const expenseRoutes = require('./expenseRoutes');
const familyRoutes = require('./familyRoutes');

const router = express.Router();

router.get('/health', (req, res) =>
  res.json({
    success: true,
    status: 'ok',
    message: 'COMS API is running',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  })
);
router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/masters', mastersRoutes);
router.use('/mass-intentions', massIntentionRoutes);
router.use('/contributions', contributionRoutes);
router.use('/families', familyRoutes);
router.use('/certificates', certificateRoutes);
router.use('/certificate-templates', certificateTemplateRoutes);
router.use('/reports', reportRoutes);
router.use('/expenses', expenseRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/users', userAdminRoutes);
router.use('/roles', roleRoutes);
router.use('/church-setup', churchSetupRoutes);
router.use('/central', centralRoutes);
router.use('/trash', trashRoutes);

module.exports = router;
