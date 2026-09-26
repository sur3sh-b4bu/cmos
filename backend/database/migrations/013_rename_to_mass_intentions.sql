-- =============================================================================
-- Migration 013: Rename "Prayer Intention" -> "Mass Intention"
--
-- Updates existing permission rows IN PLACE (same id, same FK relationships
-- in role_permissions) so every role that already had a prayer_intentions.*
-- grant keeps that exact grant under its new code -- no re-grant needed.
--
-- The `prayer_intentions` table/columns and `prayer_register` naming are
-- deliberately left untouched: only the user-facing "Prayer Intention" ->
-- "Mass Intention" entity name changes; "Prayer Register" was not part of
-- that rename, and renaming the underlying table risks breaking the
-- audit-log history and every FK pointing at it for no user-facing benefit.
-- =============================================================================

UPDATE permissions
SET module = 'mass_intentions',
    code = REPLACE(code, 'prayer_intentions.', 'mass_intentions.'),
    description = REPLACE(description, 'prayer intentions', 'mass intentions')
WHERE module = 'prayer_intentions';
