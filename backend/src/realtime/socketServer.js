const { Server } = require('socket.io');
const env = require('../config/env');
const { hashSessionToken } = require('../utils/sessionToken');
const sessionRepository = require('../repositories/sessionRepository');
const userRepository = require('../repositories/userRepository');
const logger = require('../utils/logger');

let io = null;

/** Socket.IO doesn't parse cookies itself -- pulls just the named cookie's
 * value out of the raw `Cookie` header string (e.g. `"a=1; sid=abc; b=2"`).
 * Only ever looks for one, so a hand-rolled split beats pulling in a cookie-
 * parsing dependency for this one call site. */
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const [key, ...rest] = pair.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

// Same "allow the exact configured origins, plus any dev-machine loopback
// origin" rule as app.js's own CORS setup (see its comment) -- kept as a
// literal copy rather than a shared export since socket.io's cors option
// shape (an `origin` callback returning a boolean) differs slightly from the
// `cors` package's.
const isDevLoopbackOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

function churchRoom(churchId) {
  return `church:${churchId}`;
}

/**
 * Wires Socket.IO onto the SAME HTTP server Express listens on (see
 * server.js) -- it multiplexes by request path, so this needs no separate
 * port and nothing extra to expose/proxy beyond what already reaches the
 * REST API.
 *
 * This is purely a "something changed, go refetch" signal -- see
 * emitToChurch() -- never a channel for the data itself, so there is no
 * separate authorization model to keep in sync with REST: every connection
 * presents the same `sid` session cookie used for API calls (the client
 * connects with `withCredentials: true`, see realtime.service.ts), gets
 * looked up exactly like authenticate.js does, and is placed in a room
 * scoped to that user's own church_id. A broadcast to that room can
 * therefore only ever reach other logged-in users of the SAME church,
 * mirroring the church_id scoping every REST list query already enforces
 * (see massIntentionService.list()).
 */
function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.cors.origin.includes(origin)) return callback(null, true);
        if (!env.isProduction && isDevLoopbackOrigin(origin)) return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const sessionToken = readCookie(socket.handshake.headers.cookie, env.session.cookieName);
    if (!sessionToken) return next(new Error('Authentication required'));
    try {
      const session = await sessionRepository.findValidByHash(hashSessionToken(sessionToken));
      if (!session) return next(new Error('Invalid or expired session'));
      const status = await userRepository.getAuthStatus(session.user_id);
      if (!status || !status.is_active) return next(new Error('Invalid or expired session'));
      socket.data.churchId = status.church_id;
      socket.data.userId = session.user_id;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    socket.join(churchRoom(socket.data.churchId));
  });

  logger.info('Socket.IO realtime server initialized');
  return io;
}

/**
 * Broadcasts a "something changed" event to every connected user of one
 * church. Payload is deliberately tiny (just enough for a list to decide
 * whether/how to refetch, e.g. { action: 'created', id }) -- the receiving
 * client always re-fetches from the REST API rather than trusting the socket
 * payload as the record itself, so this can never become a second source of
 * truth to keep in sync.
 *
 * No-ops before initSocketServer() has run (e.g. under Jest, which imports
 * services directly without booting the HTTP server) and if churchId is
 * falsy, so callers don't need their own guard.
 */
function emitToChurch(churchId, event, payload = {}) {
  if (!io || !churchId) return;
  io.to(churchRoom(churchId)).emit(event, payload);
}

module.exports = { initSocketServer, emitToChurch };
