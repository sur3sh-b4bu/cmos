const DEFAULT_PAGE_SIZE = 25;
// Generous enough for every real use (a full masters lookup already asks
// for 500 to populate a dropdown -- see master-lookup.service.ts) while
// still ruling out a single request asking the DB to return an entire
// table (an unbounded `pageSize` would otherwise reach the DB as a literal
// `LIMIT 999999999`).
const MAX_PAGE_SIZE = 1000;

/** Clamps a client-supplied pageSize into a safe range. Anything missing,
 * non-numeric, zero, or negative falls back to the default; anything past
 * MAX_PAGE_SIZE is capped rather than rejected, since a caller asking for
 * "too many" almost always just wants "as many as reasonably possible",
 * not an error. */
function clampPageSize(value, max = MAX_PAGE_SIZE) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), max);
}

/** Same idea for `page` -- anything missing/non-numeric/less than 1 becomes
 * page 1 rather than producing a negative SQL OFFSET. */
function clampPage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

module.exports = { clampPageSize, clampPage, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
