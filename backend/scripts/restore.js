'use strict';

/**
 * Restores a backup made by backup.js.
 *
 *   npm run restore -- <path-to-coms-....sql.gz> [--force] [--with-uploads]
 *
 * Loads the dump into the database named by DB_NAME in backend/.env (created
 * if missing). To try a backup out without touching live data, point it at a
 * different database:  DB_NAME=coms_restore_check npm run restore -- <file>
 *
 * It refuses to load into a database that already has tables unless --force is
 * given, because restoring REPLACES whatever is there. Stop the app first when
 * restoring over live data. --with-uploads also copies the mirrored logos from
 * <BACKUP_DIR>/uploads back into backend/uploads.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn, spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');
const { config, findMysqlProgram, connectionArgs, clientEnv } = require('./lib/mysqlTools');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');
const withUploads = args.includes('--with-uploads');

function fail(message) {
  console.error(`RESTORE FAILED: ${message}`);
  process.exit(1);
}

function runMysql(mysql, sql) {
  const res = spawnSync(mysql, [...connectionArgs(), '--batch', '--skip-column-names', '-e', sql], {
    env: clientEnv(),
    encoding: 'utf8',
  });
  if (res.status !== 0) fail(`mysql error: ${(res.stderr || res.error?.message || '').trim()}`);
  return res.stdout.trim();
}

async function main() {
  if (!file) fail('Give the backup file: npm run restore -- <path-to-coms-....sql.gz>');
  if (!fs.existsSync(file)) fail(`File not found: ${file}`);
  if (!/^[\w$]+$/.test(config.database)) fail(`Unsafe database name: ${config.database}`);

  const mysql = findMysqlProgram('mysql');
  runMysql(mysql, `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4`);
  const existing = Number(
    runMysql(mysql, `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${config.database}'`)
  );
  if (existing > 0 && !force) {
    fail(
      `Database "${config.database}" already has ${existing} tables. Restoring replaces them. ` +
        'Stop the app, then re-run with --force (or restore into another database via DB_NAME).'
    );
  }

  console.log(`Restoring ${path.basename(file)} into "${config.database}" ...`);
  const child = spawn(mysql, [...connectionArgs(), '--default-character-set=utf8mb4', config.database], {
    env: clientEnv(),
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`mysql exited with code ${code}: ${stderr.trim()}`))));
  });
  await Promise.all([exited, pipeline(fs.createReadStream(file), zlib.createGunzip(), child.stdin)]);

  const tables = runMysql(mysql, `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${config.database}'`);
  console.log(`OK  restored ${tables} tables into "${config.database}".`);

  if (withUploads) {
    const source = path.join(config.backupDir, 'uploads');
    if (fs.existsSync(source)) {
      fs.cpSync(source, config.uploadsDir, { recursive: true });
      console.log(`OK  uploads copied from ${source}`);
    } else {
      console.log(`No uploads mirror found at ${source}; skipped.`);
    }
  }
}

main().catch((err) => fail(err.message));
