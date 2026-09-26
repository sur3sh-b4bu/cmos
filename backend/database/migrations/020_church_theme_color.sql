-- =============================================================================
-- Migration 020: Per-church brand color. St. Thomas Church and St. Mary
-- Church-style multi-church setups each want their own sidebar/header/button
-- color instead of one fixed brand -- configurable in Masters > Churches
-- (see masterRegistry.js's `churches` entry). Frontend applies it as a
-- data-brand-theme attribute driving the CSS custom-property overrides in
-- _tokens.scss; 'blue' (the existing default palette) needs no override.
-- =============================================================================

ALTER TABLE churches
  ADD COLUMN theme_color ENUM('blue', 'green') NOT NULL DEFAULT 'blue' AFTER logo_url;
