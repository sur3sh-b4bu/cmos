const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { checkConnection } = require('./config/db');

async function start() {
  try {
    await checkConnection();
    logger.info('Database connection verified');
  } catch (err) {
    logger.error('Failed to connect to database on startup', { error: err.message });
    process.exit(1);
  }

  const port = env.port || 4000;
  const nodeEnv = env.nodeEnv || 'development';
  const server = app.listen(port, () => {
    logger.info(`COMS API listening on port ${port} [${nodeEnv}]`);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });
  // Node's state is unreliable after an uncaught exception, so log it and exit
  // non-zero -- scripts/windows/run-server.cmd then starts a fresh process.
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception, exiting', { error: err.message, stack: err.stack });
    setTimeout(() => process.exit(1), 500); // let the log line flush to disk first
  });
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

start();
