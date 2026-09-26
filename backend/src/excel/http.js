'use strict';

const { XLSX_MIME } = require('./workbookWriter');
const ApiError = require('../utils/ApiError');

/**
 * Sends an .xlsx as a download. `count` (records exported) rides in a header
 * so the UI can say "Exported N records".
 */
function sendXlsx(res, { buffer, fileName, count }) {
  res.set({
    'Content-Type': XLSX_MIME,
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store',
    ...(count === undefined ? {} : { 'X-Export-Count': String(count) }),
  });
  res.send(buffer);
}

/** `lang` for an import can arrive as a form field or a query parameter. */
function langOf(req) {
  return (req.body && req.body.lang) || req.query.lang;
}

/**
 * The user's column choices from the match-columns step: a JSON object of
 * { fieldKey: 1-based file column number } sent as a form field named
 * "mapping". Absent means "match by heading". Only the shape is checked here;
 * workbookReader.validateMapping() checks it against the fields and the file.
 */
function mappingOf(req) {
  const raw = req.body && req.body.mapping;
  if (raw === undefined || raw === '') return undefined;
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw ApiError.badRequest('The column mapping is not valid.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw ApiError.badRequest('The column mapping is not valid.');
  return parsed;
}

module.exports = { sendXlsx, langOf, mappingOf };
