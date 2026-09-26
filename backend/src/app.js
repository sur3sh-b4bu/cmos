const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();

app.use(helmet());
// In development the frontend can end up served from a port other than the
// usual 4200 (e.g. a tool's preview/port-forwarding proxy picks a random free
// port each run), so a fixed CORS_ORIGIN list can't keep up. Keep the
// explicit allow-list (needed for the LAN address phones use to scan receipt
// QR codes) but additionally accept any localhost/127.0.0.1 origin -- still
// scoped to this machine, never anything on the network -- when not in
// production.
const isDevLoopbackOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // same-origin / non-browser clients (curl, health checks)
      if (env.cors.origin.includes(origin)) return callback(null, true);
      if (!env.isProduction && isDevLoopbackOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    // The SPA reads these off an Excel download ("Exported N records", file name).
    exposedHeaders: ['X-Export-Count', 'Content-Disposition'],
  })
);

// Plain liveness check for the Node process itself -- for a process manager
// (pm2/systemd), uptime monitor, `docker healthcheck`, or the sidebar's own
// health indicator (see health.service.ts) to confirm the server is up and
// responding at all. Kept ahead of the rate limiter and outside the /api
// prefix -- neither exists for this, and a health check that could itself
// get rate-limited defeats the point -- but AFTER cors() above: this is a
// genuine cross-origin browser request in dev (frontend on :4200, backend
// on :4000), and skipping cors() doesn't make a health check "more
// available" the way skipping the rate limiter does -- it does the
// opposite, since a response with no CORS headers at all is exactly what
// the browser blocks a cross-origin script from reading. curl/uptime
// monitors were never affected by this (CORS is a browser-enforced
// restriction, not a server one), which is why that always looked fine.
// Distinct from GET /api/health (routes/index.js), which is the versioned
// API's own "is the API reachable" check.
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use(compression());

// Uploaded assets (currently just church logos) -- served from a different
// origin than the frontend in dev (different port), so helmet's default
// same-origin Cross-Origin-Resource-Policy has to be relaxed here or the
// browser silently refuses to render the <img>, even though the request
// itself succeeds.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '..', 'uploads'))
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  morgan(env.isProduction ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);
app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
