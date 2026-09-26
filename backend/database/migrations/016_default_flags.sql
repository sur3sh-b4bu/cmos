-- =============================================================================
-- Migration 016: "Default" flag for Languages and Currencies
--
-- Both tables need exactly one row marked as the application's current
-- default -- Languages so deleting the default one has somewhere to fall
-- back to (see genericMasterRepository.softDelete's auto-reassignment),
-- Currencies so "the default currency" is a real, administrator-changeable
-- record (Masters -> Currencies -> Set Default) instead of an assumption.
-- Enforcing "only one true at a time" is done in application code
-- (genericMasterRepository.setDefault), not a DB constraint -- MySQL has no
-- partial/filtered unique index to express "unique where is_default = 1"
-- cleanly.
-- =============================================================================

ALTER TABLE languages
  ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER code;

ALTER TABLE currencies
  ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER symbol;

-- Seed a default only if the table has no default yet (idempotent, and
-- doesn't clobber a default an administrator already picked).
UPDATE languages
SET is_default = 1
WHERE id = (SELECT id FROM (SELECT MIN(id) AS id FROM languages WHERE is_deleted = 0) t)
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM languages WHERE is_default = 1) x);

UPDATE currencies
SET is_default = 1
WHERE code = 'INR'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM currencies WHERE is_default = 1) x);

-- Fallback if there's no INR row (shouldn't happen given seed.js, but keeps
-- the invariant "some currency is default" true regardless).
UPDATE currencies
SET is_default = 1
WHERE id = (SELECT id FROM (SELECT MIN(id) AS id FROM currencies WHERE is_deleted = 0) t)
  AND NOT EXISTS (SELECT 1 FROM (SELECT id FROM currencies WHERE is_default = 1) x);
