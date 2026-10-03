-- =============================================================================
-- COMS - Comprehensive Master Database Synchronization & Verification SQL Script
-- =============================================================================
-- Safe, idempotent, and non-destructive.
-- Can be run in MySQL Workbench, phpMyAdmin, HeidiSQL, or MySQL CLI.
--
-- Logic:
-- 1. Creates any missing tables with IF NOT EXISTS.
-- 2. Checks information_schema for every column:
--    IF column exists -> SKIPS and logs verified
--    IF column missing -> ADDS column without disturbing data
-- 3. Inserts all permissions, certificate series, contribution types, and settings.
-- 4. Registers all 48 migrations in schema_migrations.
--
-- Guaranteed: Never errors on duplicate columns or existing tables.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS coms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coms_db;

CREATE TABLE IF NOT EXISTS _schema_verify_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(64) NOT NULL,
  column_name VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  details TEXT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

TRUNCATE TABLE _schema_verify_log;

DELIMITER $$

DROP PROCEDURE IF EXISTS CheckAndSyncColumn $$
CREATE PROCEDURE CheckAndSyncColumn(
  IN in_table VARCHAR(64),
  IN in_column VARCHAR(64),
  IN in_definition TEXT,
  IN in_after VARCHAR(64)
)
BEGIN
  DECLARE v_tbl_exists INT DEFAULT 0;
  DECLARE v_col_exists INT DEFAULT 0;
  DECLARE v_sql TEXT;

  SELECT COUNT(*) INTO v_tbl_exists
    FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = in_table;

  IF v_tbl_exists = 0 THEN
    INSERT INTO _schema_verify_log (table_name, column_name, status, details)
    VALUES (in_table, in_column, 'TABLE_MISSING', CONCAT('Table `', in_table, '` does not exist.'));
  ELSE
    SELECT COUNT(*) INTO v_col_exists
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = in_table
       AND column_name = in_column;

    IF v_col_exists > 0 THEN
      INSERT INTO _schema_verify_log (table_name, column_name, status, details)
      VALUES (in_table, in_column, 'EXISTS', CONCAT('Column `', in_table, '`.`', in_column, '` verified. Existing data intact.'));
    ELSE
      IF in_after IS NOT NULL AND in_after != '' THEN
        SET v_sql = CONCAT('ALTER TABLE `', in_table, '` ADD COLUMN `', in_column, '` ', in_definition, ' AFTER `', in_after, '`');
      ELSE
        SET v_sql = CONCAT('ALTER TABLE `', in_table, '` ADD COLUMN `', in_column, '` ', in_definition);
      END IF;

      SET @stmt_sql = v_sql;
      PREPARE stmt FROM @stmt_sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;

      INSERT INTO _schema_verify_log (table_name, column_name, status, details)
      VALUES (in_table, in_column, 'ADDED', CONCAT('Added missing column `', in_table, '`.`', in_column, '` safely without data loss.'));
    END IF;
  END IF;
END $$

DROP PROCEDURE IF EXISTS CheckAndSyncIndex $$
CREATE PROCEDURE CheckAndSyncIndex(
  IN in_table VARCHAR(64),
  IN in_index VARCHAR(64),
  IN in_columns TEXT
)
BEGIN
  DECLARE v_tbl_exists INT DEFAULT 0;
  DECLARE v_idx_exists INT DEFAULT 0;
  DECLARE v_sql TEXT;

  SELECT COUNT(*) INTO v_tbl_exists
    FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = in_table;

  IF v_tbl_exists > 0 THEN
    SELECT COUNT(*) INTO v_idx_exists
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = in_table
       AND index_name = in_index;

    IF v_idx_exists = 0 THEN
      SET v_sql = CONCAT('ALTER TABLE `', in_table, '` ADD INDEX `', in_index, '` (', in_columns, ')');
      SET @stmt_sql = v_sql;
      PREPARE stmt FROM @stmt_sql;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
      INSERT INTO _schema_verify_log (table_name, column_name, status, details)
      VALUES (in_table, in_index, 'INDEX_ADDED', CONCAT('Added missing index `', in_index, '` on `', in_table, '`.'));
    END IF;
  END IF;
END $$

DELIMITER ;

-- =============================================================================
-- 1. BASE TABLE CREATION (IF NOT EXISTS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS countries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  iso_code VARCHAR(3) NOT NULL,
  phone_code VARCHAR(10) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_countries_iso (iso_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS states (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  country_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_states_country (country_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS districts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_districts_state (state_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS churches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  name_ta VARCHAR(200) NULL,
  registration_no VARCHAR(100) NULL,
  address_line1 VARCHAR(200) NULL,
  address_line1_ta VARCHAR(200) NULL,
  address_line2 VARCHAR(200) NULL,
  address_line2_ta VARCHAR(200) NULL,
  city VARCHAR(100) NULL,
  city_ta VARCHAR(100) NULL,
  district_id INT UNSIGNED NULL,
  state_id INT UNSIGNED NULL,
  country_id INT UNSIGNED NULL,
  pincode VARCHAR(20) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  website VARCHAR(200) NULL,
  logo_url VARCHAR(255) NULL,
  established_date DATE NULL,
  default_offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  theme_color VARCHAR(20) NOT NULL DEFAULT '#072a63',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS branches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_branches_church (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS priests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  title VARCHAR(50) NULL DEFAULT 'Rev. Fr.',
  phone VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  is_parish_priest TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_priests_church (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS masses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  name_ta VARCHAR(150) NULL,
  mass_time TIME NOT NULL,
  day_type ENUM('Daily','Sunday','Special') NOT NULL DEFAULT 'Daily',
  sort_order INT NOT NULL DEFAULT 0,
  default_offering_amount DECIMAL(10,2) NULL,
  offering_description VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_masses_church (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  church_id INT UNSIGNED NULL,
  is_system_role TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  code VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_role_permission (role_id, permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS statuses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  code VARCHAR(50) NOT NULL,
  label VARCHAR(100) NOT NULL,
  color VARCHAR(20) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_status_entity_code (entity_type, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS genders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  code VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_genders_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_departments_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS languages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_languages_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prayer_intention_master (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_ta VARCHAR(150) NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_pim_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  description VARCHAR(255) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_pm_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificate_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(30) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_ct_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NULL,
  branch_id INT UNSIGNED NULL,
  role_id INT UNSIGNED NOT NULL,
  employee_code VARCHAR(30) NULL,
  full_name VARCHAR(150) NOT NULL,
  username VARCHAR(60) NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role_id),
  KEY idx_users_church (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  replaced_by_token_id INT UNSIGNED NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_refresh_tokens_user (user_id),
  KEY idx_refresh_tokens_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  credential_id VARCHAR(255) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INT UNSIGNED NOT NULL DEFAULT 0,
  transports VARCHAR(255) NULL,
  device_name VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NULL,
  KEY idx_webauthn_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS receipt_series (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  prefix VARCHAR(10) NOT NULL DEFAULT 'REC',
  current_number INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_receipt_series_church (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prayer_intentions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  receipt_no VARCHAR(30) NOT NULL,
  public_token CHAR(32) NULL,
  bulk_batch_id VARCHAR(36) NULL,
  name VARCHAR(150) NOT NULL,
  booked_by VARCHAR(150) NULL,
  phone VARCHAR(20) NULL,
  prayer_date DATE NOT NULL,
  mass_id INT UNSIGNED NOT NULL,
  prayer_intention_master_id INT UNSIGNED NULL,
  custom_intention TEXT NULL,
  offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  announcement_status ENUM('PENDING','ANNOUNCED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  payment_method_id INT UNSIGNED NULL,
  remarks VARCHAR(500) NULL,
  status_id INT UNSIGNED NOT NULL,
  completed_at DATETIME NULL,
  completed_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_refunded TINYINT(1) NOT NULL DEFAULT 0,
  refunded_at DATETIME NULL,
  refunded_by INT UNSIGNED NULL,
  refund_reason VARCHAR(500) NULL,
  refund_amount DECIMAL(10,2) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_prayer_intentions_church_receipt (church_id, receipt_no),
  KEY idx_prayer_intentions_date_mass (prayer_date, mass_id),
  KEY idx_prayer_intentions_status (status_id),
  KEY idx_prayer_intentions_phone (phone),
  KEY idx_prayer_intentions_refunded (is_refunded, refunded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prayer_intention_id INT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL,
  transaction_ref VARCHAR(100) NOT NULL,
  provider_transaction_id VARCHAR(100) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  failure_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  verified_at DATETIME NULL,
  UNIQUE KEY uq_payment_transactions_ref (transaction_ref),
  KEY idx_payment_transactions_intention (prayer_intention_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contribution_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_ta VARCHAR(150) NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_contribution_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contributions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  receipt_no VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NULL,
  contribution_type_id INT UNSIGNED NULL,
  custom_contribution_type TEXT NULL,
  contribution_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method_id INT UNSIGNED NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_refunded TINYINT(1) NOT NULL DEFAULT 0,
  refunded_at DATETIME NULL,
  refunded_by INT UNSIGNED NULL,
  refund_reason VARCHAR(500) NULL,
  refund_amount DECIMAL(10,2) NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_contributions_church_receipt (church_id, receipt_no),
  KEY idx_contributions_phone (phone),
  KEY idx_contributions_refunded (is_refunded, refunded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contribution_payment_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contribution_id INT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL,
  transaction_ref VARCHAR(100) NOT NULL,
  provider_transaction_id VARCHAR(100) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  failure_reason VARCHAR(255) NULL,
  method ENUM('cash', 'upi', 'cheque', 'bank_transfer', 'other') NULL,
  reference_number VARCHAR(100) NULL,
  remarks VARCHAR(500) NULL,
  payment_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  verified_at DATETIME NULL,
  UNIQUE KEY uq_contribution_payment_transactions_ref (transaction_ref),
  KEY idx_contribution_payment_transactions_contribution (contribution_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS baptism_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  certificate_no VARCHAR(30) NOT NULL,
  child_name VARCHAR(150) NOT NULL,
  gender_id INT UNSIGNED NOT NULL,
  date_of_birth DATE NOT NULL,
  date_of_baptism DATE NOT NULL,
  father_name VARCHAR(150) NULL,
  mother_name VARCHAR(150) NULL,
  godfather_name VARCHAR(150) NULL,
  godmother_name VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  custom_priest_name TEXT NULL,
  register_volume VARCHAR(50) NULL,
  register_page VARCHAR(50) NULL,
  register_sl_no VARCHAR(50) NULL,
  certificate_issued_date DATE NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_baptism_certificate_no (certificate_no),
  KEY idx_baptism_child_name (child_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS marriage_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  certificate_no VARCHAR(30) NOT NULL,
  bride_name VARCHAR(150) NOT NULL,
  groom_name VARCHAR(150) NOT NULL,
  marriage_date DATE NOT NULL,
  groom_profession VARCHAR(100) NULL,
  bride_profession VARCHAR(100) NULL,
  witness1_name VARCHAR(150) NULL,
  witness2_name VARCHAR(150) NULL,
  witness3_name VARCHAR(150) NULL,
  witness4_name VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  custom_priest_name TEXT NULL,
  register_volume VARCHAR(50) NULL,
  register_page VARCHAR(50) NULL,
  register_sl_no VARCHAR(50) NULL,
  certificate_issued_date DATE NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_marriage_certificate_no (certificate_no),
  KEY idx_marriage_names (bride_name, groom_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS death_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  certificate_no VARCHAR(30) NOT NULL,
  deceased_name VARCHAR(150) NOT NULL,
  date_of_death DATE NOT NULL,
  burial_date DATE NULL,
  cemetery VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  custom_priest_name TEXT NULL,
  family_contact VARCHAR(20) NULL,
  register_volume VARCHAR(50) NULL,
  register_page VARCHAR(50) NULL,
  register_sl_no VARCHAR(50) NULL,
  certificate_issued_date DATE NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_death_certificate_no (certificate_no),
  KEY idx_death_deceased_name (deceased_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificate_series (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  certificate_type VARCHAR(50) NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  next_number INT UNSIGNED NOT NULL DEFAULT 1,
  number_padding INT UNSIGNED NOT NULL DEFAULT 4,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cert_series_church_type (church_id, certificate_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certificate_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  certificate_type VARCHAR(50) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  html_template MEDIUMTEXT NOT NULL,
  css_styles MEDIUMTEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  UNIQUE KEY uq_cert_tmpl_church_type (church_id, certificate_type, template_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restricted_dates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  restricted_date DATE NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  UNIQUE KEY uq_restricted_date_church (church_id, restricted_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NULL,
  user_id INT UNSIGNED NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_id INT UNSIGNED NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_church (church_id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_module (module),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NULL,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  description VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 2. COLUMN-BY-COLUMN VERIFICATION & SAFE ADDITION
-- =============================================================================

-- Table: churches
CALL CheckAndSyncColumn('churches', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('churches', 'name', 'VARCHAR(200) NOT NULL', 'id');
CALL CheckAndSyncColumn('churches', 'name_ta', 'VARCHAR(200) NULL', 'name');
CALL CheckAndSyncColumn('churches', 'registration_no', 'VARCHAR(100) NULL', 'name_ta');
CALL CheckAndSyncColumn('churches', 'address_line1', 'VARCHAR(200) NULL', 'registration_no');
CALL CheckAndSyncColumn('churches', 'address_line1_ta', 'VARCHAR(200) NULL', 'address_line1');
CALL CheckAndSyncColumn('churches', 'address_line2', 'VARCHAR(200) NULL', 'address_line1_ta');
CALL CheckAndSyncColumn('churches', 'address_line2_ta', 'VARCHAR(200) NULL', 'address_line2');
CALL CheckAndSyncColumn('churches', 'city', 'VARCHAR(100) NULL', 'address_line2_ta');
CALL CheckAndSyncColumn('churches', 'city_ta', 'VARCHAR(100) NULL', 'city');
CALL CheckAndSyncColumn('churches', 'district_id', 'INT UNSIGNED NULL', 'city_ta');
CALL CheckAndSyncColumn('churches', 'state_id', 'INT UNSIGNED NULL', 'district_id');
CALL CheckAndSyncColumn('churches', 'country_id', 'INT UNSIGNED NULL', 'state_id');
CALL CheckAndSyncColumn('churches', 'pincode', 'VARCHAR(20) NULL', 'country_id');
CALL CheckAndSyncColumn('churches', 'phone', 'VARCHAR(20) NULL', 'pincode');
CALL CheckAndSyncColumn('churches', 'email', 'VARCHAR(150) NULL', 'phone');
CALL CheckAndSyncColumn('churches', 'website', 'VARCHAR(200) NULL', 'email');
CALL CheckAndSyncColumn('churches', 'logo_url', 'VARCHAR(255) NULL', 'website');
CALL CheckAndSyncColumn('churches', 'established_date', 'DATE NULL', 'logo_url');
CALL CheckAndSyncColumn('churches', 'default_offering_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00', 'established_date');
CALL CheckAndSyncColumn('churches', 'theme_color', 'VARCHAR(20) NOT NULL DEFAULT \'#072a63\'', 'default_offering_amount');
CALL CheckAndSyncColumn('churches', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'theme_color');
CALL CheckAndSyncColumn('churches', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('churches', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('churches', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('churches', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('churches', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: masses
CALL CheckAndSyncColumn('masses', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('masses', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('masses', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('masses', 'name', 'VARCHAR(100) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('masses', 'name_ta', 'VARCHAR(150) NULL', 'name');
CALL CheckAndSyncColumn('masses', 'mass_time', 'TIME NOT NULL', 'name_ta');
CALL CheckAndSyncColumn('masses', 'day_type', 'ENUM(\'Daily\',\'Sunday\',\'Special\') NOT NULL DEFAULT \'Daily\'', 'mass_time');
CALL CheckAndSyncColumn('masses', 'sort_order', 'INT NOT NULL DEFAULT 0', 'day_type');
CALL CheckAndSyncColumn('masses', 'default_offering_amount', 'DECIMAL(10,2) NULL', 'sort_order');
CALL CheckAndSyncColumn('masses', 'offering_description', 'VARCHAR(500) NULL', 'default_offering_amount');
CALL CheckAndSyncColumn('masses', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'offering_description');
CALL CheckAndSyncColumn('masses', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('masses', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('masses', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('masses', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('masses', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: prayer_intention_master
CALL CheckAndSyncColumn('prayer_intention_master', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('prayer_intention_master', 'name', 'VARCHAR(100) NOT NULL', 'id');
CALL CheckAndSyncColumn('prayer_intention_master', 'name_ta', 'VARCHAR(150) NULL', 'name');
CALL CheckAndSyncColumn('prayer_intention_master', 'code', 'VARCHAR(50) NOT NULL', 'name_ta');
CALL CheckAndSyncColumn('prayer_intention_master', 'description', 'VARCHAR(255) NULL', 'code');
CALL CheckAndSyncColumn('prayer_intention_master', 'is_custom', 'TINYINT(1) NOT NULL DEFAULT 0', 'description');
CALL CheckAndSyncColumn('prayer_intention_master', 'is_default', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_custom');
CALL CheckAndSyncColumn('prayer_intention_master', 'sort_order', 'INT NOT NULL DEFAULT 0', 'is_default');
CALL CheckAndSyncColumn('prayer_intention_master', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'sort_order');
CALL CheckAndSyncColumn('prayer_intention_master', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('prayer_intention_master', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('prayer_intention_master', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('prayer_intention_master', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('prayer_intention_master', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: prayer_intentions (Mass Intentions)
CALL CheckAndSyncColumn('prayer_intentions', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('prayer_intentions', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('prayer_intentions', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('prayer_intentions', 'receipt_no', 'VARCHAR(30) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('prayer_intentions', 'public_token', 'CHAR(32) NULL', 'receipt_no');
CALL CheckAndSyncColumn('prayer_intentions', 'bulk_batch_id', 'VARCHAR(36) NULL', 'public_token');
CALL CheckAndSyncColumn('prayer_intentions', 'name', 'VARCHAR(150) NOT NULL', 'bulk_batch_id');
CALL CheckAndSyncColumn('prayer_intentions', 'booked_by', 'VARCHAR(150) NULL', 'name');
CALL CheckAndSyncColumn('prayer_intentions', 'phone', 'VARCHAR(20) NULL', 'booked_by');
CALL CheckAndSyncColumn('prayer_intentions', 'prayer_date', 'DATE NOT NULL', 'phone');
CALL CheckAndSyncColumn('prayer_intentions', 'mass_id', 'INT UNSIGNED NOT NULL', 'prayer_date');
CALL CheckAndSyncColumn('prayer_intentions', 'prayer_intention_master_id', 'INT UNSIGNED NULL', 'mass_id');
CALL CheckAndSyncColumn('prayer_intentions', 'custom_intention', 'TEXT NULL', 'prayer_intention_master_id');
CALL CheckAndSyncColumn('prayer_intentions', 'offering_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00', 'custom_intention');
CALL CheckAndSyncColumn('prayer_intentions', 'is_paid', 'TINYINT(1) NOT NULL DEFAULT 1', 'offering_amount');
CALL CheckAndSyncColumn('prayer_intentions', 'announcement_status', 'ENUM(\'PENDING\',\'ANNOUNCED\',\'CANCELLED\') NOT NULL DEFAULT \'PENDING\'', 'is_paid');
CALL CheckAndSyncColumn('prayer_intentions', 'payment_method_id', 'INT UNSIGNED NULL', 'announcement_status');
CALL CheckAndSyncColumn('prayer_intentions', 'remarks', 'VARCHAR(500) NULL', 'payment_method_id');
CALL CheckAndSyncColumn('prayer_intentions', 'status_id', 'INT UNSIGNED NOT NULL', 'remarks');
CALL CheckAndSyncColumn('prayer_intentions', 'completed_at', 'DATETIME NULL', 'status_id');
CALL CheckAndSyncColumn('prayer_intentions', 'completed_by', 'INT UNSIGNED NULL', 'completed_at');
CALL CheckAndSyncColumn('prayer_intentions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'completed_by');
CALL CheckAndSyncColumn('prayer_intentions', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('prayer_intentions', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('prayer_intentions', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('prayer_intentions', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('prayer_intentions', 'is_refunded', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');
CALL CheckAndSyncColumn('prayer_intentions', 'refunded_at', 'DATETIME NULL', 'is_refunded');
CALL CheckAndSyncColumn('prayer_intentions', 'refunded_by', 'INT UNSIGNED NULL', 'refunded_at');
CALL CheckAndSyncColumn('prayer_intentions', 'refund_reason', 'VARCHAR(500) NULL', 'refunded_by');
CALL CheckAndSyncColumn('prayer_intentions', 'refund_amount', 'DECIMAL(10,2) NULL', 'refund_reason');
CALL CheckAndSyncColumn('prayer_intentions', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'refund_amount');

-- Table: contribution_types
CALL CheckAndSyncColumn('contribution_types', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('contribution_types', 'name', 'VARCHAR(100) NOT NULL', 'id');
CALL CheckAndSyncColumn('contribution_types', 'name_ta', 'VARCHAR(150) NULL', 'name');
CALL CheckAndSyncColumn('contribution_types', 'code', 'VARCHAR(50) NOT NULL', 'name_ta');
CALL CheckAndSyncColumn('contribution_types', 'description', 'VARCHAR(255) NULL', 'code');
CALL CheckAndSyncColumn('contribution_types', 'is_default', 'TINYINT(1) NOT NULL DEFAULT 0', 'description');
CALL CheckAndSyncColumn('contribution_types', 'sort_order', 'INT NOT NULL DEFAULT 0', 'is_default');
CALL CheckAndSyncColumn('contribution_types', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'sort_order');
CALL CheckAndSyncColumn('contribution_types', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('contribution_types', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('contribution_types', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('contribution_types', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('contribution_types', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: contributions
CALL CheckAndSyncColumn('contributions', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('contributions', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('contributions', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('contributions', 'receipt_no', 'VARCHAR(30) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('contributions', 'name', 'VARCHAR(150) NOT NULL', 'receipt_no');
CALL CheckAndSyncColumn('contributions', 'phone', 'VARCHAR(20) NULL', 'name');
CALL CheckAndSyncColumn('contributions', 'contribution_type_id', 'INT UNSIGNED NULL', 'phone');
CALL CheckAndSyncColumn('contributions', 'custom_contribution_type', 'TEXT NULL', 'contribution_type_id');
CALL CheckAndSyncColumn('contributions', 'contribution_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00', 'custom_contribution_type');
CALL CheckAndSyncColumn('contributions', 'payment_method_id', 'INT UNSIGNED NULL', 'contribution_amount');
CALL CheckAndSyncColumn('contributions', 'remarks', 'VARCHAR(500) NULL', 'payment_method_id');
CALL CheckAndSyncColumn('contributions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'remarks');
CALL CheckAndSyncColumn('contributions', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('contributions', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('contributions', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('contributions', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('contributions', 'is_refunded', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');
CALL CheckAndSyncColumn('contributions', 'refunded_at', 'DATETIME NULL', 'is_refunded');
CALL CheckAndSyncColumn('contributions', 'refunded_by', 'INT UNSIGNED NULL', 'refunded_at');
CALL CheckAndSyncColumn('contributions', 'refund_reason', 'VARCHAR(500) NULL', 'refunded_by');
CALL CheckAndSyncColumn('contributions', 'refund_amount', 'DECIMAL(10,2) NULL', 'refund_reason');
CALL CheckAndSyncColumn('contributions', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'refund_amount');

-- Table: baptism_certificates
CALL CheckAndSyncColumn('baptism_certificates', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('baptism_certificates', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('baptism_certificates', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('baptism_certificates', 'certificate_no', 'VARCHAR(30) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('baptism_certificates', 'child_name', 'VARCHAR(150) NOT NULL', 'certificate_no');
CALL CheckAndSyncColumn('baptism_certificates', 'gender_id', 'INT UNSIGNED NOT NULL', 'child_name');
CALL CheckAndSyncColumn('baptism_certificates', 'date_of_birth', 'DATE NOT NULL', 'gender_id');
CALL CheckAndSyncColumn('baptism_certificates', 'date_of_baptism', 'DATE NOT NULL', 'date_of_birth');
CALL CheckAndSyncColumn('baptism_certificates', 'father_name', 'VARCHAR(150) NULL', 'date_of_baptism');
CALL CheckAndSyncColumn('baptism_certificates', 'mother_name', 'VARCHAR(150) NULL', 'father_name');
CALL CheckAndSyncColumn('baptism_certificates', 'godfather_name', 'VARCHAR(150) NULL', 'mother_name');
CALL CheckAndSyncColumn('baptism_certificates', 'godmother_name', 'VARCHAR(150) NULL', 'godfather_name');
CALL CheckAndSyncColumn('baptism_certificates', 'priest_id', 'INT UNSIGNED NULL', 'godmother_name');
CALL CheckAndSyncColumn('baptism_certificates', 'custom_priest_name', 'TEXT NULL', 'priest_id');
CALL CheckAndSyncColumn('baptism_certificates', 'register_volume', 'VARCHAR(50) NULL', 'custom_priest_name');
CALL CheckAndSyncColumn('baptism_certificates', 'register_page', 'VARCHAR(50) NULL', 'register_volume');
CALL CheckAndSyncColumn('baptism_certificates', 'register_sl_no', 'VARCHAR(50) NULL', 'register_page');
CALL CheckAndSyncColumn('baptism_certificates', 'certificate_issued_date', 'DATE NULL', 'register_sl_no');
CALL CheckAndSyncColumn('baptism_certificates', 'remarks', 'VARCHAR(500) NULL', 'certificate_issued_date');
CALL CheckAndSyncColumn('baptism_certificates', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'remarks');
CALL CheckAndSyncColumn('baptism_certificates', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('baptism_certificates', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('baptism_certificates', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('baptism_certificates', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('baptism_certificates', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: marriage_certificates
CALL CheckAndSyncColumn('marriage_certificates', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('marriage_certificates', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('marriage_certificates', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('marriage_certificates', 'certificate_no', 'VARCHAR(30) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('marriage_certificates', 'bride_name', 'VARCHAR(150) NOT NULL', 'certificate_no');
CALL CheckAndSyncColumn('marriage_certificates', 'groom_name', 'VARCHAR(150) NOT NULL', 'bride_name');
CALL CheckAndSyncColumn('marriage_certificates', 'marriage_date', 'DATE NOT NULL', 'groom_name');
CALL CheckAndSyncColumn('marriage_certificates', 'groom_profession', 'VARCHAR(100) NULL', 'marriage_date');
CALL CheckAndSyncColumn('marriage_certificates', 'bride_profession', 'VARCHAR(100) NULL', 'groom_profession');
CALL CheckAndSyncColumn('marriage_certificates', 'witness1_name', 'VARCHAR(150) NULL', 'bride_profession');
CALL CheckAndSyncColumn('marriage_certificates', 'witness2_name', 'VARCHAR(150) NULL', 'witness1_name');
CALL CheckAndSyncColumn('marriage_certificates', 'witness3_name', 'VARCHAR(150) NULL', 'witness2_name');
CALL CheckAndSyncColumn('marriage_certificates', 'witness4_name', 'VARCHAR(150) NULL', 'witness3_name');
CALL CheckAndSyncColumn('marriage_certificates', 'priest_id', 'INT UNSIGNED NULL', 'witness4_name');
CALL CheckAndSyncColumn('marriage_certificates', 'custom_priest_name', 'TEXT NULL', 'priest_id');
CALL CheckAndSyncColumn('marriage_certificates', 'register_volume', 'VARCHAR(50) NULL', 'custom_priest_name');
CALL CheckAndSyncColumn('marriage_certificates', 'register_page', 'VARCHAR(50) NULL', 'register_volume');
CALL CheckAndSyncColumn('marriage_certificates', 'register_sl_no', 'VARCHAR(50) NULL', 'register_page');
CALL CheckAndSyncColumn('marriage_certificates', 'certificate_issued_date', 'DATE NULL', 'register_sl_no');
CALL CheckAndSyncColumn('marriage_certificates', 'remarks', 'VARCHAR(500) NULL', 'certificate_issued_date');
CALL CheckAndSyncColumn('marriage_certificates', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'remarks');
CALL CheckAndSyncColumn('marriage_certificates', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('marriage_certificates', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('marriage_certificates', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('marriage_certificates', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('marriage_certificates', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: death_certificates
CALL CheckAndSyncColumn('death_certificates', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('death_certificates', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('death_certificates', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('death_certificates', 'certificate_no', 'VARCHAR(30) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('death_certificates', 'deceased_name', 'VARCHAR(150) NOT NULL', 'certificate_no');
CALL CheckAndSyncColumn('death_certificates', 'date_of_death', 'DATE NOT NULL', 'deceased_name');
CALL CheckAndSyncColumn('death_certificates', 'burial_date', 'DATE NULL', 'date_of_death');
CALL CheckAndSyncColumn('death_certificates', 'cemetery', 'VARCHAR(150) NULL', 'burial_date');
CALL CheckAndSyncColumn('death_certificates', 'priest_id', 'INT UNSIGNED NULL', 'cemetery');
CALL CheckAndSyncColumn('death_certificates', 'custom_priest_name', 'TEXT NULL', 'priest_id');
CALL CheckAndSyncColumn('death_certificates', 'family_contact', 'VARCHAR(20) NULL', 'custom_priest_name');
CALL CheckAndSyncColumn('death_certificates', 'register_volume', 'VARCHAR(50) NULL', 'family_contact');
CALL CheckAndSyncColumn('death_certificates', 'register_page', 'VARCHAR(50) NULL', 'register_volume');
CALL CheckAndSyncColumn('death_certificates', 'register_sl_no', 'VARCHAR(50) NULL', 'register_page');
CALL CheckAndSyncColumn('death_certificates', 'certificate_issued_date', 'DATE NULL', 'register_sl_no');
CALL CheckAndSyncColumn('death_certificates', 'remarks', 'VARCHAR(500) NULL', 'certificate_issued_date');
CALL CheckAndSyncColumn('death_certificates', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'remarks');
CALL CheckAndSyncColumn('death_certificates', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('death_certificates', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('death_certificates', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('death_certificates', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('death_certificates', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: confirmation_certificates
CALL CheckAndSyncColumn('confirmation_certificates', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('confirmation_certificates', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('confirmation_certificates', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('confirmation_certificates', 'certificate_no', 'VARCHAR(30) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('confirmation_certificates', 'name', 'VARCHAR(150) NOT NULL', 'certificate_no');
CALL CheckAndSyncColumn('confirmation_certificates', 'age', 'VARCHAR(10) NULL', 'name');
CALL CheckAndSyncColumn('confirmation_certificates', 'gender_id', 'INT UNSIGNED NULL', 'age');
CALL CheckAndSyncColumn('confirmation_certificates', 'parents', 'VARCHAR(300) NULL', 'gender_id');
CALL CheckAndSyncColumn('confirmation_certificates', 'caste', 'VARCHAR(100) NULL', 'parents');
CALL CheckAndSyncColumn('confirmation_certificates', 'sponsors', 'VARCHAR(300) NULL', 'caste');
CALL CheckAndSyncColumn('confirmation_certificates', 'domicile', 'VARCHAR(200) NULL', 'sponsors');
CALL CheckAndSyncColumn('confirmation_certificates', 'place_of_confirmation', 'VARCHAR(200) NULL', 'domicile');
CALL CheckAndSyncColumn('confirmation_certificates', 'date_of_confirmation', 'DATE NOT NULL', 'place_of_confirmation');
CALL CheckAndSyncColumn('confirmation_certificates', 'bishop_name', 'VARCHAR(150) NULL', 'date_of_confirmation');
CALL CheckAndSyncColumn('confirmation_certificates', 'priest_id', 'INT UNSIGNED NULL', 'bishop_name');
CALL CheckAndSyncColumn('confirmation_certificates', 'custom_priest_name', 'TEXT NULL', 'priest_id');
CALL CheckAndSyncColumn('confirmation_certificates', 'remarks', 'VARCHAR(500) NULL', 'custom_priest_name');
CALL CheckAndSyncColumn('confirmation_certificates', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'remarks');
CALL CheckAndSyncColumn('confirmation_certificates', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('confirmation_certificates', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('confirmation_certificates', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('confirmation_certificates', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('confirmation_certificates', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: roles
CALL CheckAndSyncColumn('roles', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('roles', 'name', 'VARCHAR(100) NOT NULL', 'id');
CALL CheckAndSyncColumn('roles', 'code', 'VARCHAR(50) NOT NULL', 'name');
CALL CheckAndSyncColumn('roles', 'description', 'VARCHAR(255) NULL', 'code');
CALL CheckAndSyncColumn('roles', 'church_id', 'INT UNSIGNED NULL', 'description');
CALL CheckAndSyncColumn('roles', 'is_system_role', 'TINYINT(1) NOT NULL DEFAULT 0', 'church_id');
CALL CheckAndSyncColumn('roles', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'is_system_role');
CALL CheckAndSyncColumn('roles', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('roles', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('roles', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('roles', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('roles', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: users
CALL CheckAndSyncColumn('users', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('users', 'church_id', 'INT UNSIGNED NULL', 'id');
CALL CheckAndSyncColumn('users', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('users', 'role_id', 'INT UNSIGNED NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('users', 'employee_code', 'VARCHAR(30) NULL', 'role_id');
CALL CheckAndSyncColumn('users', 'full_name', 'VARCHAR(150) NOT NULL', 'employee_code');
CALL CheckAndSyncColumn('users', 'username', 'VARCHAR(60) NOT NULL', 'full_name');
CALL CheckAndSyncColumn('users', 'email', 'VARCHAR(150) NULL', 'username');
CALL CheckAndSyncColumn('users', 'phone', 'VARCHAR(20) NULL', 'email');
CALL CheckAndSyncColumn('users', 'password_hash', 'VARCHAR(255) NOT NULL', 'phone');
CALL CheckAndSyncColumn('users', 'must_change_password', 'TINYINT(1) NOT NULL DEFAULT 0', 'password_hash');
CALL CheckAndSyncColumn('users', 'last_login_at', 'DATETIME NULL', 'must_change_password');
CALL CheckAndSyncColumn('users', 'failed_login_attempts', 'INT UNSIGNED NOT NULL DEFAULT 0', 'last_login_at');
CALL CheckAndSyncColumn('users', 'locked_until', 'DATETIME NULL', 'failed_login_attempts');
CALL CheckAndSyncColumn('users', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'locked_until');
CALL CheckAndSyncColumn('users', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('users', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('users', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('users', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Check Indexes for refund and performance
CALL CheckAndSyncIndex('prayer_intentions', 'idx_prayer_intentions_refunded', 'is_refunded, refunded_at');
CALL CheckAndSyncIndex('contributions', 'idx_contributions_refunded', 'is_refunded, refunded_at');


-- =============================================================================
-- 3. PERMISSIONS & ROLE MAPPINGS (SAFE INSERT)
-- =============================================================================

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

-- Map permissions to ADMIN role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'ADMIN'
   AND p.module IN ('confirmation_certificates', 'contributions');

-- Map permissions to OFFICE_STAFF role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'OFFICE_STAFF'
   AND p.code IN (
     'confirmation_certificates.view', 'confirmation_certificates.create', 'confirmation_certificates.update',
     'confirmation_certificates.print', 'confirmation_certificates.export',
     'contributions.view', 'contributions.create', 'contributions.update',
     'contributions.print', 'contributions.export'
   );


-- =============================================================================
-- 4. CERTIFICATE SERIES SEEDING (FOR ALL EXISTING CHURCHES)
-- =============================================================================

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


-- =============================================================================
-- 5. CONTRIBUTION TYPES FOR CERTIFICATES
-- =============================================================================

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


-- =============================================================================
-- 6. SYSTEM SETTINGS (DEFAULT BASELINE)
-- =============================================================================

INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
  ('RECEIPT_QR_MODE', 'calendar', 'Receipt QR contents: "calendar" = offline event, "url" = online link'),
  ('DEFAULT_CURRENCY', 'INR', 'Default system currency code'),
  ('RECEIPT_THANK_YOU_MESSAGE', 'Thank you for your offering. God Bless You.', 'Default message printed on receipts'),
  ('UPI_ENABLED', '0', 'Enable UPI QR on receipts (0 = disabled, 1 = enabled)');


-- =============================================================================
-- 7. REGISTER ALL 48 MIGRATIONS IN SCHEMA_MIGRATIONS
-- =============================================================================

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
  ('044_confirmation_certificates.sql'), ('045_certificate_print_templates.sql'),
  ('046_default_language_tamil.sql'), ('047_default_language_settings_2026_10_03.sql'),
  ('048_refunds_support_2026_10_03.sql');


-- =============================================================================
-- 8. OUTPUT COMPLETE AUDIT & VERIFICATION REPORT
-- =============================================================================

DROP PROCEDURE IF EXISTS CheckAndSyncColumn;
DROP PROCEDURE IF EXISTS CheckAndSyncIndex;

SELECT
  status AS check_status,
  COUNT(*) AS total_items,
  CASE
    WHEN status = 'EXISTS' THEN 'Verified existing column - zero data touched'
    WHEN status = 'ADDED' THEN 'Successfully added new column without data loss'
    WHEN status = 'INDEX_ADDED' THEN 'Successfully created performance index'
    ELSE 'Other verification check'
  END AS status_meaning
FROM _schema_verify_log
GROUP BY status;

SELECT id, table_name, column_name, status, details, checked_at
FROM _schema_verify_log
ORDER BY id ASC;
