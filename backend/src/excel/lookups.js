'use strict';

/**
 * Helpers for turning a cell value ("f", "Fr. Thomas", "Morning Mass", "3")
 * into the id of a row in a lookup list. Shared by every module's import.
 */

/** Case-, spacing- and accent-form-insensitive comparison token. */
function token(raw) {
  return String(raw).normalize('NFC').replace(/[\u00a0\u200b]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Indexes lookup rows by their comparison token. `nameOf(row)` gives the
 * name(s) a row answers to (a string or array of strings, e.g. name and code).
 */
function buildIndex(rows, nameOf) {
  const byToken = new Map();
  const byId = new Map();
  for (const row of rows) {
    byId.set(Number(row.id), row);
    const names = [].concat(nameOf(row)).filter(Boolean);
    for (const name of names) {
      const key = token(name);
      const bucket = byToken.get(key) || [];
      if (!bucket.includes(row)) bucket.push(row);
      byToken.set(key, bucket);
    }
  }
  return { byToken, byId };
}

/**
 * Resolves a cell to one lookup row. Accepts the row's name (or code), or its
 * numeric id, so sheets built from older exports ("Name or ID") still import.
 *
 * @returns {{row: object}|{ambiguous: true}|{missing: true}}
 */
function findRow(raw, index, { synonyms = {} } = {}) {
  const key = token(raw);
  const mapped = synonyms[key] || key;
  const bucket = index.byToken.get(mapped);
  if (bucket && bucket.length === 1) return { row: bucket[0] };
  if (bucket && bucket.length > 1) return { ambiguous: true };
  if (/^\d+$/.test(key) && index.byId.has(Number(key))) return { row: index.byId.get(Number(key)) };
  return { missing: true };
}

module.exports = { token, buildIndex, findRow };
