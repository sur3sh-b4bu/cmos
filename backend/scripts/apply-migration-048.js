const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'coms_db',
  });

  console.log('Running migration 048...');

  const [colsPi] = await conn.query("SHOW COLUMNS FROM prayer_intentions LIKE 'is_refunded'");
  if (colsPi.length === 0) {
    await conn.query(`
      ALTER TABLE prayer_intentions
        ADD COLUMN is_refunded TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
        ADD COLUMN refunded_at DATETIME NULL AFTER is_refunded,
        ADD COLUMN refunded_by INT UNSIGNED NULL AFTER refunded_at,
        ADD COLUMN refund_reason VARCHAR(500) NULL AFTER refunded_by,
        ADD COLUMN refund_amount DECIMAL(10,2) NULL AFTER refund_reason,
        ADD KEY idx_prayer_intentions_refunded (is_refunded, refunded_at)
    `);
    console.log('Added refund columns to prayer_intentions');
  } else {
    console.log('prayer_intentions already has is_refunded');
  }

  const targetContTable = (await conn.query("SHOW TABLES LIKE 'contributions'"))[0].length > 0 ? 'contributions' : 'donations';
  const [colsDon] = await conn.query(`SHOW COLUMNS FROM ${targetContTable} LIKE 'is_refunded'`);
  if (colsDon.length === 0) {
    await conn.query(`
      ALTER TABLE ${targetContTable}
        ADD COLUMN is_refunded TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
        ADD COLUMN refunded_at DATETIME NULL AFTER is_refunded,
        ADD COLUMN refunded_by INT UNSIGNED NULL AFTER refunded_at,
        ADD COLUMN refund_reason VARCHAR(500) NULL AFTER refunded_by,
        ADD COLUMN refund_amount DECIMAL(10,2) NULL AFTER refund_reason,
        ADD KEY idx_${targetContTable}_refunded (is_refunded, refunded_at)
    `);
    console.log(`Added refund columns to ${targetContTable}`);
  } else {
    console.log(`${targetContTable} already has is_refunded`);
  }

  await conn.end();
  console.log('Migration 048 executed successfully.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
