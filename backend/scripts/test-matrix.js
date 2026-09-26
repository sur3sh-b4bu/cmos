'use strict';

/**
 * Runs the unit + database integration tests once per timezone x locale
 * combination, to prove date handling never depends on the machine's
 * timezone or regional settings.
 *
 * Every run is a fresh Jest process with TZ / LANG / LC_ALL / LC_TIME set in
 * its environment (Node reads TZ at start-up on Windows, macOS and Linux
 * alike), so no extra dependency such as cross-env is needed.
 *
 *   npm run test:matrix                 full matrix
 *   npm run test:matrix -- --quick      UTC-11, UTC+14 and Asia/Kolkata only
 *   npm run test:matrix -- --unit       skip the database (integration) tests
 *
 * The integration tests need MySQL (see scripts/prepare-test-db.js).
 */

const path = require('path');
const { spawnSync } = require('child_process');

const JEST = require.resolve('jest/bin/jest');
const ROOT = path.join(__dirname, '..');

// [IANA zone, label, expected getTimezoneOffset() in minutes on 1 June 2020]
const TIMEZONES = [
  ['UTC', 'UTC+0', 0],
  ['Pacific/Pago_Pago', 'UTC-11', 660],
  ['Pacific/Kiritimati', 'UTC+14', -840],
  ['Asia/Kolkata', 'UTC+5:30', -330],
  ['America/New_York', 'UTC-5/-4 (DST)', 240],
];
const QUICK_TIMEZONES = ['Pacific/Pago_Pago', 'Pacific/Kiritimati', 'Asia/Kolkata'];
const LOCALES = ['en_US.UTF-8', 'en_IN.UTF-8'];

const args = new Set(process.argv.slice(2));
const unitOnly = args.has('--unit');
const zones = TIMEZONES.filter(([tz]) => !args.has('--quick') || QUICK_TIMEZONES.includes(tz));

const suites = [{ name: 'unit', config: 'jest.config.js' }];
if (!unitOnly) suites.push({ name: 'integration', config: 'jest.integration.config.js' });

function runJest(config, env) {
  return spawnSync(process.execPath, [JEST, '-c', config, '--runInBand', '--silent'], {
    cwd: ROOT,
    env: { ...process.env, ...env, LOG_LEVEL: 'error', FORCE_COLOR: '0' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function summary(output) {
  const line = (output.match(/^Tests:.*$/m) || [''])[0].trim();
  return line || 'no summary';
}

/** Proves the child process really runs in the requested zone, so a platform that ignores TZ can never give a false pass. */
function assertZoneApplied(tz, expectedOffset) {
  const probe = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(new Date(2020, 5, 1).getTimezoneOffset()))'], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  if (Number(probe.stdout) !== expectedOffset) {
    console.error(`This platform's Node did not apply TZ=${tz} (offset ${probe.stdout}, expected ${expectedOffset}); the matrix would not test what it claims. Aborting.`);
    process.exit(2);
  }
}

const rows = [];
let failed = 0;

for (const [tz, offset, expectedOffset] of zones) {
  assertZoneApplied(tz, expectedOffset);
  for (const locale of LOCALES) {
    for (const suite of suites) {
      const env = { TZ: tz, LANG: locale, LC_ALL: locale, LC_TIME: locale };
      const result = runJest(suite.config, env);
      const output = `${result.stdout || ''}\n${result.stderr || ''}`;
      const ok = result.status === 0;
      if (!ok) {
        failed += 1;
        console.log(`\n--- FAILED: ${suite.name} with TZ=${tz} LANG=${locale} ---\n${output}`);
      }
      rows.push({ timezone: `${tz} (${offset})`, locale, suite: suite.name, result: ok ? 'PASS' : 'FAIL', tests: summary(output) });
    }
  }
}

console.table(rows);
console.log(failed ? `${failed} run(s) FAILED.` : `All ${rows.length} runs passed.`);
process.exit(failed ? 1 : 0);
