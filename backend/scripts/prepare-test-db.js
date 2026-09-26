'use strict';

/**
 * Creates and prepares the database the integration tests run against.
 *
 * It never touches the development database: the name comes from
 * TEST_DB_NAME (default "coms_test") and must contain "test". Migrations and
 * the seed run in child processes with DB_NAME pointed at it, so this works
 * the same on Windows, macOS and Linux and is safe to run repeatedly
 * (migrations skip what is applied; the seed only fills empty tables).
 *
 * Connection settings (host, user, password) come from backend/.env like the
 * app itself.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const TEST_DB_NAME = process.env.TEST_DB_NAME || 'coms_test';

function run(script) {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'database', script)], {
    env: { ...process.env, DB_NAME: TEST_DB_NAME },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`${script} failed for test database "${TEST_DB_NAME}":\n${result.stdout}\n${result.stderr}`);
  }
}

function prepareTestDatabase() {
  if (!/test/i.test(TEST_DB_NAME)) {
    throw new Error(`Refusing to prepare "${TEST_DB_NAME}": the test database name must contain "test" so it can never be the real database.`);
  }
  run('migrate.js');
  run('seed.js');
  return TEST_DB_NAME;
}

module.exports = { prepareTestDatabase, TEST_DB_NAME };

if (require.main === module) {
  try {
    console.log(`Prepared test database "${prepareTestDatabase()}".`);
  } catch (err) {
    console.error(err.message);
    console.error('\nIs MySQL running, and are DB_HOST / DB_USER / DB_PASSWORD in backend/.env correct?');
    process.exit(1);
  }
}
