-- =============================================================================
-- Migration 043: Marriage certificate witnesses expansion (up to 4 witnesses)
-- =============================================================================

ALTER TABLE marriage_certificates
  ADD COLUMN witness3_name VARCHAR(150) NULL AFTER witness2_name,
  ADD COLUMN witness4_name VARCHAR(150) NULL AFTER witness3_name;
