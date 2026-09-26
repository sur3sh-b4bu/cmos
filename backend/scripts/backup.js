'use strict';

/**
 * Backs up the COMS database and the uploaded church logos.
 *
 *   npm run backup
 *
 * Writes <BACKUP_DIR>/coms-<database>-<YYYY-MM-DD_HHMMSS>.sql.gz (a consistent
 * snapshot taken while the app keeps running), mirrors backend/uploads into
 * <BACKUP_DIR>/uploads, then deletes all but the newest BACKUP_KEEP dumps.
 * Exits non-zero if anything fails, so a scheduler can flag it.
 *
 * Restore with `npm run restore -- <file>` (see restore.js).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { config, findMysqlProgram, connectionArgs, clientEnv } = require('./lib/mysqlTools');

const pad = (n) => String(n).padStart(2, '0');

function timestamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function dumpDatabase(outFile) {
  const mysqldump = findMysqlProgram('mysqldump');
  const args = [
    ...connectionArgs(),
    '--single-transaction', // consistent snapshot without locking out users
    '--routines',
    '--triggers',
    '--events',
    '--hex-blob',
    '--default-character-set=utf8mb4',
    config.database,
  ];
  const child = spawn(mysqldump, args, { env: clientEnv(), stdio: ['ignore', 'pipe', 'pipe'] });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`mysqldump exited with code ${code}: ${stderr.trim()}`))));
  });

  const written = pipeline(child.stdout, zlib.createGzip(), fs.createWriteStream(outFile));
  await Promise.all([exited, written]);
}

/** A truncated dump is worse than none. mysqldump always ends a complete dump
 * with a "-- Dump completed" line, so read the file back and look for it. */
async function verifyDump(file) {
  let tail = '';
  const gunzip = zlib.createGunzip();
  gunzip.on('data', (chunk) => { tail = (tail + chunk.toString('utf8')).slice(-400); });
  await pipeline(fs.createReadStream(file), gunzip);
  if (!tail.includes('-- Dump completed')) {
    throw new Error('Backup file is incomplete (missing the "Dump completed" marker).');
  }
}

function mirrorUploads() {
  if (!fs.existsSync(config.uploadsDir)) return 0;
  const target = path.join(config.backupDir, 'uploads');
  fs.cpSync(config.uploadsDir, target, { recursive: true });
  return fs.readdirSync(target, { recursive: true }).length;
}

function pruneOldDumps() {
  const dumps = fs
    .readdirSync(config.backupDir)
    .filter((f) => /^coms-.*\.sql\.gz$/.test(f))
    .sort(); // the timestamp in the name sorts oldest -> newest
  const stale = dumps.slice(0, Math.max(0, dumps.length - config.keep));
  for (const f of stale) fs.unlinkSync(path.join(config.backupDir, f));
  return stale.length;
}

async function main() {
  fs.mkdirSync(config.backupDir, { recursive: true });
  const outFile = path.join(config.backupDir, `coms-${config.database}-${timestamp()}.sql.gz`);
  const started = Date.now();

  console.log(`Backing up database "${config.database}" from ${config.host}:${config.port} ...`);
  try {
    await dumpDatabase(outFile);
    await verifyDump(outFile);
  } catch (err) {
    fs.rmSync(outFile, { force: true }); // never leave a half-written dump looking like a good one
    throw err;
  }

  const files = mirrorUploads();
  const pruned = pruneOldDumps();
  const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
  console.log(`OK  ${outFile}  (${mb} MB, ${((Date.now() - started) / 1000).toFixed(1)}s, verified)`);
  console.log(`    uploads mirrored (${files} items), ${pruned} old backup(s) removed, keeping up to ${config.keep}.`);
  if (!process.env.BACKUP_DIR) {
    console.log('    NOTE: BACKUP_DIR is not set, so backups are on the SAME disk as the database.');
    console.log('          Set BACKUP_DIR in backend/.env to an external drive or synced cloud folder.');
  }
}

main().catch((err) => {
  console.error(`BACKUP FAILED: ${err.message}`);
  process.exit(1);
});
