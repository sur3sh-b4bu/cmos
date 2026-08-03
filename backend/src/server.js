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

  const server = app.listen(env.port, () => {
    logger.info(`COMS API listening on port ${env.port} [${env.nodeEnv}]`);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => process.exit(0));
  });
}

start();
