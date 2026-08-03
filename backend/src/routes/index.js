const express = require('express');
const authRoutes = require('./authRoutes');
const mastersRoutes = require('./mastersRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'COMS API is running' }));
router.use('/auth', authRoutes);
router.use('/masters', mastersRoutes);

module.exports = router;
