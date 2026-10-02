-- =============================================================================
-- COMS - Comprehensive Master Database Synchronization SQL Script
-- =============================================================================
-- Safe, idempotent, and non-destructive.
-- Can be run in MySQL Workbench, phpMyAdmin, HeidiSQL, or MySQL CLI.
--
-- Logic:
-- 1. Creates any missing tables with IF NOT EXISTS.
-- 2. Checks information_schema for every column:
--    IF column exists -> SKIPS
--    IF column missing -> ADDS column
-- 3. Inserts all permissions, certificate series, contribution types, and settings.
-- 4. Registers all 44 migrations in schema_migrations.
--
-- Guaranteed: Never errors on duplicate columns or existing tables.
-- =============================================================================

SET @dbname = DATABASE();

-- -----------------------------------------------------------------------------
-- 1. Ensure schema_migrations table exists
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- 2. Ensure core tables exist (IF NOT EXISTS)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS confirmation_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  certificate_no VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  age VARCHAR(10) NULL,
  gender_id INT UNSIGNED NULL,
  parents VARCHAR(300) NULL,
  caste VARCHAR(100) NULL,
  sponsors VARCHAR(300) NULL,
  domicile VARCHAR(200) NULL,
  place_of_confirmation VARCHAR(200) NULL,
  date_of_confirmation DATE NOT NULL,
  bishop_name VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  custom_priest_name TEXT NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_confirmation_certificate_no (certificate_no),
  KEY idx_confirmation_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_token CHAR(64) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  church_id INT UNSIGNED NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user_sessions_user (user_id),
  KEY idx_user_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------------------------
-- 3. Idempotent Column Checks and Additions across all tables
-- -----------------------------------------------------------------------------

-- churches columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'churches' AND COLUMN_NAME = 'default_offering_amount');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE churches ADD COLUMN default_offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'churches' AND COLUMN_NAME = 'theme_color');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE churches ADD COLUMN theme_color VARCHAR(20) NOT NULL DEFAULT \'#072a63\'', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'churches' AND COLUMN_NAME = 'name_ta');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE churches ADD COLUMN name_ta VARCHAR(200) NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'churches' AND COLUMN_NAME = 'address_line1_ta');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE churches ADD COLUMN address_line1_ta VARCHAR(200) NULL AFTER address_line1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'churches' AND COLUMN_NAME = 'address_line2_ta');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE churches ADD COLUMN address_line2_ta VARCHAR(200) NULL AFTER address_line2', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'churches' AND COLUMN_NAME = 'city_ta');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE churches ADD COLUMN city_ta VARCHAR(100) NULL AFTER city', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- masses columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'masses' AND COLUMN_NAME = 'default_offering_amount');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE masses ADD COLUMN default_offering_amount DECIMAL(10,2) NULL AFTER end_time', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'masses' AND COLUMN_NAME = 'name_ta');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE masses ADD COLUMN name_ta VARCHAR(150) NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'masses' AND COLUMN_NAME = 'offering_description');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE masses ADD COLUMN offering_description VARCHAR(500) NULL AFTER default_offering_amount', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- prayer_intention_master columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'prayer_intention_master' AND COLUMN_NAME = 'name_ta');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE prayer_intention_master ADD COLUMN name_ta VARCHAR(150) NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- prayer_intentions columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'prayer_intentions' AND COLUMN_NAME = 'public_token');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE prayer_intentions ADD COLUMN public_token CHAR(32) NULL AFTER receipt_no', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'prayer_intentions' AND COLUMN_NAME = 'is_paid');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE prayer_intentions ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 1 AFTER offering_amount', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'prayer_intentions' AND COLUMN_NAME = 'booked_by');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE prayer_intentions ADD COLUMN booked_by VARCHAR(150) NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'prayer_intentions' AND COLUMN_NAME = 'bulk_batch_id');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE prayer_intentions ADD COLUMN bulk_batch_id VARCHAR(36) NULL AFTER public_token', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'prayer_intentions' AND COLUMN_NAME = 'announcement_status');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE prayer_intentions ADD COLUMN announcement_status ENUM(\'PENDING\',\'ANNOUNCED\',\'CANCELLED\') NOT NULL DEFAULT \'PENDING\' AFTER is_paid', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contributions columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contributions' AND COLUMN_NAME = 'branch_id');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE contributions ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contributions' AND COLUMN_NAME = 'custom_contribution_type');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE contributions ADD COLUMN custom_contribution_type TEXT NULL AFTER contribution_type_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- contribution_types columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'contribution_types' AND COLUMN_NAME = 'name_ta');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE contribution_types ADD COLUMN name_ta VARCHAR(150) NULL AFTER name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- baptism_certificates columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'baptism_certificates' AND COLUMN_NAME = 'branch_id');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE baptism_certificates ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'baptism_certificates' AND COLUMN_NAME = 'custom_priest_name');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE baptism_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'baptism_certificates' AND COLUMN_NAME = 'register_volume');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE baptism_certificates ADD COLUMN register_volume VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'baptism_certificates' AND COLUMN_NAME = 'register_page');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE baptism_certificates ADD COLUMN register_page VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'baptism_certificates' AND COLUMN_NAME = 'register_sl_no');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE baptism_certificates ADD COLUMN register_sl_no VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'baptism_certificates' AND COLUMN_NAME = 'certificate_issued_date');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE baptism_certificates ADD COLUMN certificate_issued_date DATE NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- marriage_certificates columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'branch_id');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'custom_priest_name');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'groom_profession');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN groom_profession VARCHAR(100) NULL AFTER bride_condition', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'bride_profession');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN bride_profession VARCHAR(100) NULL AFTER groom_profession', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'witness3_name');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN witness3_name VARCHAR(150) NULL AFTER witness2_name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'witness4_name');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN witness4_name VARCHAR(150) NULL AFTER witness3_name', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'register_volume');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN register_volume VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'register_page');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN register_page VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'register_sl_no');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN register_sl_no VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'marriage_certificates' AND COLUMN_NAME = 'certificate_issued_date');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE marriage_certificates ADD COLUMN certificate_issued_date DATE NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- death_certificates columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'death_certificates' AND COLUMN_NAME = 'branch_id');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE death_certificates ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'death_certificates' AND COLUMN_NAME = 'custom_priest_name');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE death_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'death_certificates' AND COLUMN_NAME = 'register_volume');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE death_certificates ADD COLUMN register_volume VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'death_certificates' AND COLUMN_NAME = 'register_page');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE death_certificates ADD COLUMN register_page VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'death_certificates' AND COLUMN_NAME = 'register_sl_no');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE death_certificates ADD COLUMN register_sl_no VARCHAR(50) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'death_certificates' AND COLUMN_NAME = 'certificate_issued_date');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE death_certificates ADD COLUMN certificate_issued_date DATE NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- confirmation_certificates columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'confirmation_certificates' AND COLUMN_NAME = 'custom_priest_name');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE confirmation_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- roles columns
SET @col_exist = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'church_id');
SET @sql = IF(@col_exist = 0, 'ALTER TABLE roles ADD COLUMN church_id INT UNSIGNED NULL AFTER description', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 4. Permissions (confirmation_certificates & contributions)
-- -----------------------------------------------------------------------------
INSERT IGNORE INTO permissions (module, action, code, description) VALUES
  ('confirmation_certificates', 'view', 'confirmation_certificates.view', 'view confirmation certificates'),
  ('confirmation_certificates', 'create', 'confirmation_certificates.create', 'create confirmation certificates'),
  ('confirmation_certificates', 'update', 'confirmation_certificates.update', 'update confirmation certificates'),
  ('confirmation_certificates', 'delete', 'confirmation_certificates.delete', 'delete confirmation certificates'),
  ('confirmation_certificates', 'print', 'confirmation_certificates.print', 'print confirmation certificates'),
  ('confirmation_certificates', 'export', 'confirmation_certificates.export', 'export confirmation certificates'),
  ('contributions', 'view', 'contributions.view', 'view contributions'),
  ('contributions', 'create', 'contributions.create', 'create contributions'),
  ('contributions', 'update', 'contributions.update', 'update contributions'),
  ('contributions', 'delete', 'contributions.delete', 'delete contributions'),
  ('contributions', 'print', 'contributions.print', 'print contributions'),
  ('contributions', 'export', 'contributions.export', 'export contributions');

-- Map to ADMIN
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'ADMIN'
   AND p.module IN ('confirmation_certificates', 'contributions');

-- Map to OFFICE_STAFF
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'OFFICE_STAFF'
   AND p.code IN (
     'confirmation_certificates.view',
     'confirmation_certificates.create',
     'confirmation_certificates.update',
     'confirmation_certificates.print',
     'confirmation_certificates.export',
     'contributions.view',
     'contributions.create',
     'contributions.update',
     'contributions.print',
     'contributions.export'
   );

-- -----------------------------------------------------------------------------
-- 5. Certificate Series (Baptism, Marriage, Death, Confirmation)
-- -----------------------------------------------------------------------------
INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding)
SELECT c.id, 'Baptism', 'BAP', 1, 4 FROM churches c
 WHERE NOT EXISTS (SELECT 1 FROM certificate_series cs WHERE cs.church_id = c.id AND cs.certificate_type = 'Baptism');

INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding)
SELECT c.id, 'Marriage', 'MAR', 1, 4 FROM churches c
 WHERE NOT EXISTS (SELECT 1 FROM certificate_series cs WHERE cs.church_id = c.id AND cs.certificate_type = 'Marriage');

INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding)
SELECT c.id, 'Death', 'DTH', 1, 4 FROM churches c
 WHERE NOT EXISTS (SELECT 1 FROM certificate_series cs WHERE cs.church_id = c.id AND cs.certificate_type = 'Death');

INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding)
SELECT c.id, 'Confirmation', 'CNF', 1, 4 FROM churches c
 WHERE NOT EXISTS (SELECT 1 FROM certificate_series cs WHERE cs.church_id = c.id AND cs.certificate_type = 'Confirmation');

-- -----------------------------------------------------------------------------
-- 6. Contribution Types for Certificates
-- -----------------------------------------------------------------------------
INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Confirmation Certificate', 'உறுதிப்பூசுதல் சான்றிதழ்', 'CONFIRMATION_CERTIFICATE', 'Contribution received for a Confirmation certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'CONFIRMATION_CERTIFICATE');

INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Baptism Certificate', 'ஞானஸ்நான சான்றிதழ்', 'BAPTISM_CERTIFICATE', 'Contribution received for a Baptism certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'BAPTISM_CERTIFICATE');

INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Marriage Certificate', 'திருமண சான்றிதழ்', 'MARRIAGE_CERTIFICATE', 'Contribution received for a Marriage certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'MARRIAGE_CERTIFICATE');

INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Death Certificate', 'இறப்பு சான்றிதழ்', 'DEATH_CERTIFICATE', 'Contribution received for a Death certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'DEATH_CERTIFICATE');

-- -----------------------------------------------------------------------------
-- 7. System Settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  description VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
  ('RECEIPT_QR_MODE', 'calendar', 'Receipt QR contents: "calendar" = offline event, "url" = online link'),
  ('DEFAULT_CURRENCY', 'INR', 'Default system currency code'),
  ('RECEIPT_THANK_YOU_MESSAGE', 'Thank you for your offering. God Bless You.', 'Default message printed on receipts'),
  ('UPI_ENABLED', '0', 'Enable UPI QR on receipts (0 = disabled, 1 = enabled)');

-- -----------------------------------------------------------------------------
-- 8. Register all migrations in schema_migrations
-- -----------------------------------------------------------------------------
INSERT IGNORE INTO schema_migrations (filename) VALUES
  ('001_master_tables.sql'), ('002_lookup_and_rbac.sql'), ('003_users_auth.sql'),
  ('004_prayer_intentions.sql'), ('005_certificates.sql'), ('006_audit_logs.sql'),
  ('007_prayer_intention_public_token.sql'), ('008_webauthn_credentials.sql'),
  ('009_receipt_qr_mode_setting.sql'), ('010_upi_settings.sql'),
  ('011_default_currency_setting.sql'), ('012_payment_transactions.sql'),
  ('013_rename_to_mass_intentions.sql'), ('014_payment_workflow_redesign.sql'),
  ('015_restricted_date_reason.sql'), ('016_default_flags.sql'),
  ('018_certificate_register_extract_fields.sql'), ('019_church_default_offering_amount.sql'),
  ('020_church_theme_color.sql'), ('021_church_theme_color_more_options.sql'),
  ('022_donations.sql'), ('023_mass_intention_booked_by.sql'),
  ('024_mass_default_offering_amount.sql'), ('025_scope_receipt_numbers_per_church.sql'),
  ('026_bulk_batch_id.sql'), ('027_rename_donations_to_contributions.sql'),
  ('028_announcement_status.sql'), ('029_intention_and_mass_tamil_names.sql'),
  ('030_contribution_type_tamil_name.sql'), ('031_church_tamil_name.sql'),
  ('032_church_tamil_address.sql'), ('033_seed_tamil_backfill.sql'),
  ('034_mass_offering_description.sql'), ('035_church_scoped_roles.sql'),
  ('036_certificate_branch_scoping.sql'), ('037_backfill_certificate_branch.sql'),
  ('038_session_auth.sql'), ('039_certificate_custom_priest_name.sql'),
  ('040_contribution_types_certificates.sql'), ('041_central_analytics_indexes.sql'),
  ('042_church_theme_color_more_options.sql'), ('043_marriage_witnesses_expansion.sql'),
  ('044_confirmation_certificates.sql');
