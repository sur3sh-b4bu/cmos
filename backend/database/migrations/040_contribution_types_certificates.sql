-- =============================================================================
-- Migration 040: Contribution Types -- retire "Mass Offering", add the three
-- certificate types
-- =============================================================================
-- A Mass offering is what a Mass Intention already records, so it is no longer
-- offered as a Contribution Type. Contributions can instead be recorded against
-- a Baptism, Marriage or Death certificate.
--
-- "Mass Offering" is SOFT-deleted (is_deleted = 1, is_active = 0), never removed:
-- contributions already saved with it keep pointing at it and still show its
-- name in lists and receipts; it simply stops appearing in the dropdown.
--
-- The three new types are inserted only if their code is not there yet, so this
-- can be re-run and never overrides something an administrator has edited. On a
-- fresh database (migrations run before the seed) they are created here, and the
-- seed's own INSERT IGNORE then leaves them alone.
-- =============================================================================

UPDATE contribution_types
   SET is_deleted = 1, is_active = 0
 WHERE code = 'MASS_OFFERING' AND is_deleted = 0;

INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Baptism Certificate', 'ஞானஸ்நான சான்றிதழ்', 'BAPTISM_CERTIFICATE', 'Contribution received for a Baptism certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'BAPTISM_CERTIFICATE');

INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Marriage Certificate', 'திருமண சான்றிதழ்', 'MARRIAGE_CERTIFICATE', 'Contribution received for a Marriage certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'MARRIAGE_CERTIFICATE');

INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Death Certificate', 'இறப்பு சான்றிதழ்', 'DEATH_CERTIFICATE', 'Contribution received for a Death certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'DEATH_CERTIFICATE');
