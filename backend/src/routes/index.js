const express = require('express');
const authRoutes = require('./authRoutes');
const mastersRoutes = require('./mastersRoutes');
const prayerIntentionRoutes = require('./prayerIntentionRoutes');
const certificateRoutes = require('./certificateRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'COMS API is running' }));
router.use('/auth', authRoutes);
router.use('/masters', mastersRoutes);
router.use('/prayer-intentions', prayerIntentionRoutes);
router.use('/certificates', certificateRoutes);

module.exports = router;
