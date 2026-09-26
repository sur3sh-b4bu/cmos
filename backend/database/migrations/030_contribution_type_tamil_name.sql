-- =============================================================================
-- Migration 030: Tamil name for Contribution Types
-- =============================================================================
-- Same pattern as migration 029's name_ta on prayer_intention_master/masses --
-- optional, nullable Tamil name alongside the existing English `name`;
-- see frontend/src/app/core/utils/localized-name.util.ts for the fallback
-- to English when blank. Applies to the Contributions grid, the New
-- Contribution form's Contribution Type dropdown, and the printed
-- Contribution receipt.
--
-- The UPDATE statements below cover seed.js's own default rows (General
-- Offering/Mass Offering/Building Fund/Charity/Others); anything an
-- administrator has since added or renamed (e.g. a custom "Church
-- Maintenance" type) is untouched here -- fill it in directly via
-- Masters > Contribution Types.
-- =============================================================================

ALTER TABLE contribution_types
  ADD COLUMN name_ta VARCHAR(100) NULL AFTER name;

UPDATE contribution_types SET name_ta = 'பொது காணிக்கை' WHERE name = 'General Offering';
UPDATE contribution_types SET name_ta = 'திருப்பலி காணிக்கை' WHERE name = 'Mass Offering';
UPDATE contribution_types SET name_ta = 'கட்டிட நிதி' WHERE name = 'Building Fund';
UPDATE contribution_types SET name_ta = 'தொண்டு' WHERE name = 'Charity';
UPDATE contribution_types SET name_ta = 'மற்றவை' WHERE name = 'Others';
