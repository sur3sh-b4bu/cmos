-- =============================================================================
-- Migration 021: Expands churches.theme_color (added in migration 020) with
-- five more brand color options -- red, violet, orange, purple, pink -- each
-- paired with the same gold accent as blue/green. MySQL has no ALTER TYPE
-- for ENUM; MODIFY COLUMN with the full new value list is the standard way
-- to add options without losing existing data (values keep their meaning by
-- name, not position, so 'blue'/'green' rows are unaffected).
-- =============================================================================

ALTER TABLE churches
  MODIFY COLUMN theme_color ENUM('blue', 'green', 'red', 'violet', 'orange', 'purple', 'pink') NOT NULL DEFAULT 'blue';
