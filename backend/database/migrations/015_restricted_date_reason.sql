-- =============================================================================
-- Migration 015: Restricted Dates carry their own reason text
--
-- Item 5 of the Restricted-Date redesign requires the warning banner shown
-- when a user picks one of these dates to explain WHY it's restricted, not
-- just that it is. Nullable so existing rows keep working -- the frontend
-- falls back to a generic explanation when reason is not set.
-- =============================================================================

ALTER TABLE holidays
  ADD COLUMN reason VARCHAR(500) NULL AFTER holiday_date;
