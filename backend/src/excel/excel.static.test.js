const fs = require('fs');
const path = require('path');

/**
 * Guard rail: the Excel import/export code must give the same answer on every
 * computer, so it may never read the machine's timezone or locale. These
 * patterns are exactly the APIs that do. (Run under the TZ x locale matrix in
 * scripts/test-matrix.js, the behaviour tests prove it; this test proves nobody
 * reintroduces the cause.)
 */
const FORBIDDEN = [
  { pattern: /\.toLocale\w*\(/, why: 'toLocale*() depends on the OS region' },
  { pattern: /\bIntl\./, why: 'Intl.* depends on the OS region' },
  { pattern: /\.(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|getSeconds|getTimezoneOffset)\(/, why: 'local-time getter depends on the machine timezone (use getUTC*)' },
  { pattern: /\.set(FullYear|Month|Date|Hours|Minutes|Seconds)\(/, why: 'local-time setter depends on the machine timezone (use setUTC*)' },
  { pattern: /\.toString\(\)\s*\.\s*(slice|substr)/, why: 'Date.toString() is locale/timezone formatted' },
  { pattern: /\.toDateString\(|\.toTimeString\(/, why: 'depends on the machine timezone' },
  { pattern: /new Date\(\s*['"`]/, why: 'new Date(<text>) parses non-ISO text as LOCAL time' },
  { pattern: /Date\.parse\(/, why: 'Date.parse() of text is timezone dependent' },
  { pattern: /process\.env\.(TZ|LANG|LC_ALL)/, why: 'must not branch on the environment locale/timezone' },
];

function listSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : [];
  });
}

describe('src/excel is timezone- and locale-independent by construction', () => {
  const files = listSourceFiles(__dirname);

  it('finds the excel modules to check', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(files.map((f) => [path.relative(__dirname, f), f]))('%s uses no machine-dependent date API', (_name, file) => {
    // Comments may legitimately name the forbidden APIs while explaining why
    // they're forbidden -- only executable code is checked.
    const code = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    const hits = FORBIDDEN.filter(({ pattern }) => pattern.test(code)).map(({ why }) => why);
    expect(hits).toEqual([]);
  });
});
