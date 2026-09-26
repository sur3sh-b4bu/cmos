-- =============================================================================
-- Migration 037: Backfill legacy certificates' branch_id
-- =============================================================================
-- Migration 036 added branch_id to the certificate tables, but every
-- certificate that already existed has no recorded branch at all -- there
-- was nothing to carry it over from (some were even bulk-imported with no
-- created_by to fall back on either). Left NULL, they'd stay visible from
-- EVERY branch forever (the "NULL = church-wide" convention), which is what
-- caused legacy certificates to keep showing up after a user's branch was
-- changed even once the read-scoping fix (see certificateRepository.js) was
-- in place.
--
-- Per user decision, every pre-existing NULL-branch certificate is assigned
-- to one concrete branch per church rather than staying shared -- this is a
-- best-effort guess, not their real history, since that history was never
-- captured. Preference order:
--   1. The church's branch literally named "Main Branch", if one exists.
--   2. Otherwise, that church's earliest-created branch (lowest id).
-- A church with no branches at all leaves its certificates NULL (nothing
-- sensible to assign) -- unchanged from today for that edge case.
-- =============================================================================

UPDATE baptism_certificates c
JOIN branches b ON b.church_id = c.church_id AND b.name = 'Main Branch'
SET c.branch_id = b.id
WHERE c.branch_id IS NULL;

UPDATE baptism_certificates c
JOIN (SELECT church_id, MIN(id) AS branch_id FROM branches GROUP BY church_id) b
  ON b.church_id = c.church_id
SET c.branch_id = b.branch_id
WHERE c.branch_id IS NULL;

UPDATE marriage_certificates c
JOIN branches b ON b.church_id = c.church_id AND b.name = 'Main Branch'
SET c.branch_id = b.id
WHERE c.branch_id IS NULL;

UPDATE marriage_certificates c
JOIN (SELECT church_id, MIN(id) AS branch_id FROM branches GROUP BY church_id) b
  ON b.church_id = c.church_id
SET c.branch_id = b.branch_id
WHERE c.branch_id IS NULL;

UPDATE death_certificates c
JOIN branches b ON b.church_id = c.church_id AND b.name = 'Main Branch'
SET c.branch_id = b.id
WHERE c.branch_id IS NULL;

UPDATE death_certificates c
JOIN (SELECT church_id, MIN(id) AS branch_id FROM branches GROUP BY church_id) b
  ON b.church_id = c.church_id
SET c.branch_id = b.branch_id
WHERE c.branch_id IS NULL;
