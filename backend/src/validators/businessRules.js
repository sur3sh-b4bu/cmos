'use strict';

const { parseDateCell, latestDateOnEarthIso } = require('../excel/dateOnly');

/**
 * Business rules enforced by the SERVER for both the normal create/update
 * endpoints and the Excel import -- the UI repeats them for convenience, but
 * a direct API call or a spreadsheet can never get around them.
 */

// Strictly 10 digits only (e.g. "9876543210").
const PHONE_PATTERN = /^[0-9]{10}$/;
const PHONE_MESSAGE = 'Phone number must be exactly 10 digits.';

function isValidPhone(value) {
  if (value === null || value === undefined || value === '') return true;
  return PHONE_PATTERN.test(String(value).trim());
}

/**
 * Per-certificate-type date rules.
 *  - notFuture: not later than the latest calendar date that exists anywhere
 *    on Earth right now (see latestDateOnEarthIso), so no machine timezone
 *    is consulted and nobody is rejected for entering "today".
 *  - notBefore: must not be earlier than another date field of the same record.
 */
const CERTIFICATE_DATE_RULES = {
  baptism: [
    { field: 'date_of_birth', notFuture: true },
    { field: 'date_of_baptism', notBefore: 'date_of_birth' },
  ],
  marriage: [{ field: 'marriage_date', notFuture: true }],
  death: [
    { field: 'date_of_death', notFuture: true },
    { field: 'burial_date', notBefore: 'date_of_death' },
  ],
};

/**
 * Checks a record's ISO dates against a rule list.
 *
 * @param {object[]} rules   e.g. CERTIFICATE_DATE_RULES.baptism
 * @param {Object} values    field -> ISO "YYYY-MM-DD" | null
 * @param {(field: string) => string} labelFor  the heading the user sees for a field
 * @returns {{field: string, message: string}[]}
 */
function checkDateRules(rules, values, labelFor, nowMs = Date.now()) {
  const errors = [];
  const latest = latestDateOnEarthIso(nowMs);
  for (const rule of rules) {
    const value = values[rule.field];
    if (!value) continue;
    if (rule.notFuture && value > latest) {
      errors.push({ field: rule.field, message: `${labelFor(rule.field)} cannot be in the future.` });
    }
    if (rule.notBefore) {
      const other = values[rule.notBefore];
      if (other && value < other) {
        errors.push({
          field: rule.field,
          message: `${labelFor(rule.field)} cannot be before ${labelFor(rule.notBefore)}.`,
        });
      }
    }
  }
  return errors;
}

/**
 * Normalises every date field present in `data` to ISO and reports unparsable
 * ones (instead of letting the database throw a 500). Returns a shallow copy.
 */
function normalizeDateFields(data, dateFields, labelFor) {
  const normalized = { ...data };
  const errors = [];
  for (const field of dateFields) {
    if (!(field in data)) continue;
    const raw = data[field];
    if (raw === null || raw === undefined || raw === '') {
      normalized[field] = null;
      continue;
    }
    const parsed = parseDateCell(raw);
    if (parsed.ok) normalized[field] = parsed.iso;
    else errors.push({ field, message: `${labelFor(field)}: ${parsed.reason}` });
  }
  return { normalized, errors };
}

module.exports = {
  PHONE_PATTERN,
  PHONE_MESSAGE,
  isValidPhone,
  CERTIFICATE_DATE_RULES,
  checkDateRules,
  normalizeDateFields,
};
