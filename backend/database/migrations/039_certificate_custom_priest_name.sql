-- =============================================================================
-- Migration 039: Custom (free-text) priest name on certificates
-- =============================================================================
-- priest_id is a strict link to the Priests master list, but the priest who
-- actually officiated a baptism/marriage/burial isn't always one registered
-- in this church's own Priests list (e.g. a visiting priest) by the time the
-- certificate is entered. This adds a free-text fallback alongside priest_id
-- rather than replacing it -- same "TEXT NULL" shape as the app's existing
-- select-or-type-your-own pairs (contributions.custom_contribution_type,
-- prayer_intentions.custom_intention). certificateRepository.js resolves
-- priest_name to this value whenever no priest_id is linked.
-- =============================================================================

ALTER TABLE baptism_certificates
  ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id;

ALTER TABLE marriage_certificates
  ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id;

ALTER TABLE death_certificates
  ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id;
