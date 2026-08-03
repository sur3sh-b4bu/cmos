const express = require('express');
const authRoutes = require('./authRoutes');
const mastersRoutes = require('./mastersRoutes');
const prayerIntentionRoutes = require('./prayerIntentionRoutes');
const certificateRoutes = require('./certificateRoutes');
const reportRoutes = require('./reportRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const userAdminRoutes = require('./userAdminRoutes');
const roleRoutes = require('./roleRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'COMS API is running' }));
router.use('/auth', authRoutes);
router.use('/masters', mastersRoutes);
router.use('/prayer-intentions', prayerIntentionRoutes);
router.use('/certificates', certificateRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/users', userAdminRoutes);
router.use('/roles', roleRoutes);

module.exports = router;
