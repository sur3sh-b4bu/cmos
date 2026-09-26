const express = require('express');
const authRoutes = require('./authRoutes');
const mastersRoutes = require('./mastersRoutes');
const massIntentionRoutes = require('./massIntentionRoutes');
const contributionRoutes = require('./contributionRoutes');
const certificateRoutes = require('./certificateRoutes');
const reportRoutes = require('./reportRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const userAdminRoutes = require('./userAdminRoutes');
const roleRoutes = require('./roleRoutes');
const churchSetupRoutes = require('./churchSetupRoutes');
const centralRoutes = require('./centralRoutes');
const publicRoutes = require('./publicRoutes');
const trashRoutes = require('./trashRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'COMS API is running' }));
router.use('/public', publicRoutes);
router.use('/auth', authRoutes);
router.use('/masters', mastersRoutes);
router.use('/mass-intentions', massIntentionRoutes);
router.use('/contributions', contributionRoutes);
router.use('/certificates', certificateRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/users', userAdminRoutes);
router.use('/roles', roleRoutes);
router.use('/church-setup', churchSetupRoutes);
router.use('/central', centralRoutes);
router.use('/trash', trashRoutes);

module.exports = router;
