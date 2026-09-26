const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/publicIntentionController');

/**
 * Unauthenticated routes reached by scanning the QR code on a printed
 * receipt. Deliberately NOT behind `authenticate` -- the person holding the
 * receipt is a parishioner, not a COMS user.
 *
 * Because these are open to the internet, they get their own tighter rate
 * limit on top of the global one: a valid token is unguessable, but that's
 * only true if an attacker can't grind through the keyspace quickly.
 */
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again in a few minutes.' },
});

const router = express.Router();
router.use(publicLimiter);

router.get('/intentions/:token', controller.summary);
router.get('/intentions/:token/calendar.ics', controller.calendar);

module.exports = router;
