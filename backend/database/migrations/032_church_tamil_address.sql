-- =============================================================================
-- Migration 032: Tamil address for Churches
-- =============================================================================
-- Companion to migration 031's name_ta -- the printed receipt header shows
-- the church's address_line1 + city under its name (see receiptPdf.js/
-- contributionReceiptPdf.js), which stayed English-only even after the name
-- itself could switch to Tamil.
--
-- A single free-text override rather than per-field address_line1_ta/city_ta
-- columns -- the printed line is always one combined string already, and an
-- address (unlike a name/mass/intention picked from a fixed set) doesn't
-- decompose cleanly into "the same fields, just translated" the way those
-- do; simplest to let it be typed as one line however reads best. Optional/
-- nullable -- falls back to the existing English address_line1 + city when
-- blank, same fallback rule as every other name_ta column.
-- =============================================================================

ALTER TABLE churches
  ADD COLUMN address_ta VARCHAR(255) NULL AFTER address_line2;
