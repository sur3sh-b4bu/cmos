/**
 * Integration tests: run against a real MySQL database (`coms_test`, created
 * and migrated by scripts/prepare-test-db.js -- never the development
 * database). Slower, so kept out of the default `npm test`.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.integration.test.js'],
  testTimeout: 60000,
  globalSetup: '<rootDir>/tests/integration/globalSetup.js',
};
