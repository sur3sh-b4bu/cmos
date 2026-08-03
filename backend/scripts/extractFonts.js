/**
 * One-time (re-runnable) setup script: extracts the Roboto TTF files that
 * ship base64-encoded inside pdfmake's own package (Apache-2.0, no license
 * fee) into backend/assets/fonts/, so PdfPrinter can read them from disk.
 * Run via `npm run fonts:extract` after a fresh `npm install`.
 */
const fs = require('fs');
const path = require('path');
const vfs = require('pdfmake/build/vfs_fonts.js');

const outDir = path.join(__dirname, '..', 'assets', 'fonts');
fs.mkdirSync(outDir, { recursive: true });

for (const [filename, base64] of Object.entries(vfs)) {
  fs.writeFileSync(path.join(outDir, filename), Buffer.from(base64, 'base64'));
  console.log(`wrote ${filename}`);
}
console.log('Fonts extracted to', outDir);
