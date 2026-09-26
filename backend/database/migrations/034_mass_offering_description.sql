-- =============================================================================
-- Migration 034: Offering Description on Masses
-- =============================================================================
-- Optional free-text note per Mass (e.g. "For the intentions of the living
-- and the deceased of the family") -- set once in Masters > Masses, then
-- shown on the Mass Intention form when that Mass is selected (see
-- mass-intention-form.ts/.html) and printed on the Mass Intention receipt
-- (see massIntentionRepository.js's BASE_SELECT and receiptPdf.js). Nullable
-- and NOT included in findPotentialDuplicate/create/update's own column
-- lists since it's descriptive text carried from the Mass, not something
-- captured per intention.
-- =============================================================================

ALTER TABLE masses
  ADD COLUMN offering_description TEXT NULL AFTER default_offering_amount;
