-- =============================================================================
-- Migration 018: Certificate fields to match the physical diocese register
-- extract format (Baptism / Marriage / Death), plus a Diocese name on
-- churches so the printed certificate's header line ("Tuticorin Diocese" in
-- the paper original) is real per-church data, not hardcoded text.
-- =============================================================================

ALTER TABLE churches
  ADD COLUMN diocese VARCHAR(200) NULL AFTER name;

-- --- Baptism -----------------------------------------------------------------
ALTER TABLE baptism_certificates
  ADD COLUMN place_of_baptism VARCHAR(200) NULL AFTER date_of_baptism,
  ADD COLUMN parent_residence VARCHAR(300) NULL AFTER mother_name;

-- --- Marriage ------------------------------------------------------------------
-- Every field on the "EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN
-- MARRIAGES" form not already covered by an existing column.
ALTER TABLE marriage_certificates
  ADD COLUMN where_married VARCHAR(200) NULL AFTER marriage_date,
  ADD COLUMN groom_age VARCHAR(10) NULL AFTER groom_name,
  ADD COLUMN bride_age VARCHAR(10) NULL AFTER bride_name,
  ADD COLUMN groom_condition VARCHAR(50) NULL AFTER bride_age,
  ADD COLUMN bride_condition VARCHAR(50) NULL AFTER groom_condition,
  ADD COLUMN groom_profession VARCHAR(100) NULL AFTER bride_condition,
  ADD COLUMN bride_profession VARCHAR(100) NULL AFTER groom_profession,
  ADD COLUMN groom_residence VARCHAR(200) NULL AFTER bride_profession,
  ADD COLUMN bride_residence VARCHAR(200) NULL AFTER groom_residence,
  ADD COLUMN groom_father_name VARCHAR(150) NULL AFTER bride_residence,
  ADD COLUMN bride_father_name VARCHAR(150) NULL AFTER groom_father_name,
  ADD COLUMN banns_or_licence VARCHAR(200) NULL AFTER bride_father_name,
  ADD COLUMN impediments_dispensed VARCHAR(200) NULL AFTER banns_or_licence;

-- --- Death -----------------------------------------------------------------
-- `cemetery` (existing) already covers "Place of Burial" -- only relabeled
-- on the form/PDF, not duplicated as a new column.
ALTER TABLE death_certificates
  ADD COLUMN age VARCHAR(10) NULL AFTER deceased_name,
  ADD COLUMN place VARCHAR(200) NULL AFTER age,
  ADD COLUMN profession VARCHAR(100) NULL AFTER place,
  ADD COLUMN parents VARCHAR(300) NULL AFTER profession,
  ADD COLUMN place_of_death VARCHAR(200) NULL AFTER date_of_death,
  ADD COLUMN cause VARCHAR(200) NULL AFTER place_of_death,
  ADD COLUMN confession_received VARCHAR(100) NULL AFTER cause,
  ADD COLUMN viaticum_received VARCHAR(100) NULL AFTER confession_received,
  ADD COLUMN anointing_received VARCHAR(100) NULL AFTER viaticum_received;
