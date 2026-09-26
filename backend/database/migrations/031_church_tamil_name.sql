-- =============================================================================
-- Migration 031: Tamil name for Churches
-- =============================================================================
-- Same pattern as migration 029/030's name_ta on Masses/Mass Intention
-- Presets/Contribution Types -- optional, nullable Tamil name alongside the
-- existing English `name`; see localized-name.util.ts (frontend) and
-- pdfLabels.js's localizedName() (backend) for the fallback to English when
-- blank. Applies to every printed receipt/register that already switches
-- on `lang` (receiptPdf.js/bulkReceiptPdf.js/dailyRegisterPdf.js/
-- contributionReceiptPdf.js) and the app header's church name.
--
-- Deliberately NOT applied to certificatePdf.js (Baptism/Marriage/Death
-- register extracts) or the always-English collections reports
-- (collectionsDetailPdf.js/contributionCollectionsDetailPdf.js) -- both are
-- intentionally English-only regardless of site language (see those files'
-- own comments), so a Tamil church name there would be inconsistent with
-- the rest of the document rather than helpful.
--
-- No UPDATE statements here (unlike migration 029/030) -- a church's own
-- Tamil name isn't a routine translation of a fixed set of options, it's
-- specific to each church and best entered directly via Masters > Churches.
-- =============================================================================

ALTER TABLE churches
  ADD COLUMN name_ta VARCHAR(200) NULL AFTER name;
