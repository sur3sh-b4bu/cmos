'use strict';

const { prepareTestDatabase } = require('../../scripts/prepare-test-db');

/** Runs once before the integration suite: makes sure the test database exists, is migrated and seeded. */
module.exports = async () => {
  process.env.DB_NAME = prepareTestDatabase();
};
