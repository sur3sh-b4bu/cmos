'use strict';

/**
 * Shared helpers for backup.js / restore.js: reads the same backend/.env the
 * app uses, and finds the `mysqldump` / `mysql` command-line programs (on PATH
 * first, then the usual Windows / Linux install folders).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const BACKEND_DIR = path.join(__dirname, '..', '..');

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: String(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'coms_db',
  // Where dumps are written. Point this at an external drive or a synced cloud
  // folder -- a backup on the same disk as the database does not survive that
  // disk failing.
  backupDir: path.resolve(BACKEND_DIR, process.env.BACKUP_DIR || 'backups'),
  keep: Math.max(1, Number(process.env.BACKUP_KEEP || 30)),
  uploadsDir: path.join(BACKEND_DIR, 'uploads'),
};

function candidatePaths(program) {
  const exe = process.platform === 'win32' ? `${program}.exe` : program;
  const candidates = [];
  if (process.platform === 'win32') {
    for (const root of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean)) {
      for (const vendor of ['MySQL', 'MariaDB']) {
        const vendorDir = path.join(root, vendor);
        if (!fs.existsSync(vendorDir)) continue;
        for (const dir of fs.readdirSync(vendorDir)) {
          candidates.push(path.join(vendorDir, dir, 'bin', exe));
        }
      }
    }
  } else {
    candidates.push(`/usr/bin/${exe}`, `/usr/local/bin/${exe}`, `/usr/local/mysql/bin/${exe}`);
  }
  return candidates;
}

/** Full path to `program` ('mysqldump' or 'mysql'), or throws with guidance. */
function findMysqlProgram(program) {
  const probe = spawnSync(program, ['--version'], { encoding: 'utf8' });
  if (!probe.error && probe.status === 0) return program; // already on PATH

  const explicit = process.env[`${program.toUpperCase()}_PATH`];
  if (explicit && fs.existsSync(explicit)) return explicit;

  const found = candidatePaths(program).find((p) => fs.existsSync(p));
  if (found) return found;
  throw new Error(
    `Could not find "${program}". Install the MySQL client tools, or set ${program.toUpperCase()}_PATH in backend/.env to its full path.`
  );
}

/** Connection flags shared by mysqldump and mysql. The password travels in the
 * MYSQL_PWD environment variable (see clientEnv) so it never shows up in the
 * process list. */
function connectionArgs() {
  return [`--host=${config.host}`, `--port=${config.port}`, `--user=${config.user}`];
}

function clientEnv() {
  return { ...process.env, MYSQL_PWD: config.password };
}

module.exports = { config, findMysqlProgram, connectionArgs, clientEnv };
