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

CREATE TABLE IF NOT EXISTS certificate_print_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  certificate_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NULL,
  subheader_prefix VARCHAR(100) NULL,
  diocese_label VARCHAR(150) NULL,
  signatory_title VARCHAR(100) NULL,
  seal_label VARCHAR(50) NULL,
  field_labels JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_church_cert_type (church_id, certificate_type),
  INDEX idx_cert_templates_church (church_id)
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

CREATE TABLE IF NOT EXISTS `account_heads` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `church_id` INT UNSIGNED NULL,
  `type` ENUM('receipt', 'payment') NOT NULL,
  `section` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `tamil_name` VARCHAR(255) NULL,
  `code` VARCHAR(100) NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `auto_source` VARCHAR(100) NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_heads_church_type` (`church_id`, `type`, `is_active`),
  INDEX `idx_heads_section` (`section`, `order_index`),
  CONSTRAINT `fk_heads_church` FOREIGN KEY (`church_id`) REFERENCES `churches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `church_expenses` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `church_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED NULL,
  `entry_date` DATE NOT NULL,
  `month_year` VARCHAR(7) NOT NULL,
  `type` ENUM('receipt', 'payment') NOT NULL,
  `head_id` INT UNSIGNED NULL,
  `head_name` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `payment_method_id` INT UNSIGNED NULL,
  `voucher_no` VARCHAR(50) NULL,
  `paid_to` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `is_auto_sync` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  INDEX `idx_expenses_church_month` (`church_id`, `month_year`, `entry_date`),
  INDEX `idx_expenses_head` (`head_id`),
  INDEX `idx_expenses_deleted` (`deleted_at`),
  CONSTRAINT `fk_expenses_church` FOREIGN KEY (`church_id`) REFERENCES `churches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_expenses_head` FOREIGN KEY (`head_id`) REFERENCES `account_heads` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `monthly_financial_abstracts` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `church_id` INT UNSIGNED NOT NULL,
  `branch_id` INT UNSIGNED NULL,
  `month_year` VARCHAR(7) NOT NULL,
  `opening_cash_hand` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `opening_cash_bank` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `opening_fixed_deposits` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `closing_cash_hand` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `closing_cash_bank` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `closing_fixed_deposits` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `receipts_specific_project` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `payments_specific_project` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_stole_fees` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_mass_intentions` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_parish_contribution` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `remit_diocesan_collection` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_monthly_allowance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_medical_allowance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_mission_conveyance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `recv_any_other` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `priest_name` VARCHAR(255) NULL,
  `designation` VARCHAR(255) NULL,
  `unit_no` VARCHAR(50) NULL,
  `notes` TEXT NULL,
  `created_by` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_church_month_branch` (`church_id`, `month_year`, `branch_id`),
  CONSTRAINT `fk_abstract_church` FOREIGN KEY (`church_id`) REFERENCES `churches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =============================================================================
-- 2. COLUMN-BY-COLUMN VERIFICATION & SAFE ADDITION (ALL TABLES & COLUMNS)
-- =============================================================================

-- Table: countries
CALL CheckAndSyncColumn('countries', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('countries', 'name', 'VARCHAR(100) NOT NULL', 'id');
CALL CheckAndSyncColumn('countries', 'iso_code', 'VARCHAR(3) NOT NULL', 'name');
CALL CheckAndSyncColumn('countries', 'phone_code', 'VARCHAR(10) NULL', 'iso_code');
CALL CheckAndSyncColumn('countries', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'phone_code');
CALL CheckAndSyncColumn('countries', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('countries', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('countries', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('countries', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('countries', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: states
CALL CheckAndSyncColumn('states', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('states', 'country_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('states', 'name', 'VARCHAR(100) NOT NULL', 'country_id');
CALL CheckAndSyncColumn('states', 'code', 'VARCHAR(10) NULL', 'name');
CALL CheckAndSyncColumn('states', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'code');
CALL CheckAndSyncColumn('states', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('states', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('states', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('states', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('states', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: districts
CALL CheckAndSyncColumn('districts', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('districts', 'state_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('districts', 'name', 'VARCHAR(100) NOT NULL', 'state_id');
CALL CheckAndSyncColumn('districts', 'code', 'VARCHAR(10) NULL', 'name');
CALL CheckAndSyncColumn('districts', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'code');
CALL CheckAndSyncColumn('districts', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('districts', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('districts', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('districts', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('districts', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

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

-- Table: branches
CALL CheckAndSyncColumn('branches', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('branches', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('branches', 'name', 'VARCHAR(150) NOT NULL', 'church_id');
CALL CheckAndSyncColumn('branches', 'code', 'VARCHAR(30) NULL', 'name');
CALL CheckAndSyncColumn('branches', 'address', 'VARCHAR(255) NULL', 'code');
CALL CheckAndSyncColumn('branches', 'phone', 'VARCHAR(20) NULL', 'address');
CALL CheckAndSyncColumn('branches', 'email', 'VARCHAR(150) NULL', 'phone');
CALL CheckAndSyncColumn('branches', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'email');
CALL CheckAndSyncColumn('branches', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('branches', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('branches', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('branches', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('branches', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: priests
CALL CheckAndSyncColumn('priests', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('priests', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('priests', 'name', 'VARCHAR(150) NOT NULL', 'church_id');
CALL CheckAndSyncColumn('priests', 'title', 'VARCHAR(50) NULL DEFAULT \'Rev. Fr.\'', 'name');
CALL CheckAndSyncColumn('priests', 'phone', 'VARCHAR(20) NULL', 'title');
CALL CheckAndSyncColumn('priests', 'email', 'VARCHAR(150) NULL', 'phone');
CALL CheckAndSyncColumn('priests', 'is_parish_priest', 'TINYINT(1) NOT NULL DEFAULT 0', 'email');
CALL CheckAndSyncColumn('priests', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'is_parish_priest');
CALL CheckAndSyncColumn('priests', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('priests', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('priests', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('priests', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('priests', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

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

-- Table: permissions
CALL CheckAndSyncColumn('permissions', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('permissions', 'module', 'VARCHAR(50) NOT NULL', 'id');
CALL CheckAndSyncColumn('permissions', 'action', 'VARCHAR(50) NOT NULL', 'module');
CALL CheckAndSyncColumn('permissions', 'code', 'VARCHAR(100) NOT NULL', 'action');
CALL CheckAndSyncColumn('permissions', 'description', 'VARCHAR(255) NULL', 'code');
CALL CheckAndSyncColumn('permissions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'description');
CALL CheckAndSyncColumn('permissions', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('permissions', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('permissions', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('permissions', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('permissions', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: role_permissions
CALL CheckAndSyncColumn('role_permissions', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('role_permissions', 'role_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('role_permissions', 'permission_id', 'INT UNSIGNED NOT NULL', 'role_id');
CALL CheckAndSyncColumn('role_permissions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'permission_id');
CALL CheckAndSyncColumn('role_permissions', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('role_permissions', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('role_permissions', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('role_permissions', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('role_permissions', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: statuses
CALL CheckAndSyncColumn('statuses', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('statuses', 'entity_type', 'VARCHAR(50) NOT NULL', 'id');
CALL CheckAndSyncColumn('statuses', 'code', 'VARCHAR(50) NOT NULL', 'entity_type');
CALL CheckAndSyncColumn('statuses', 'label', 'VARCHAR(100) NOT NULL', 'code');
CALL CheckAndSyncColumn('statuses', 'color', 'VARCHAR(20) NULL', 'label');
CALL CheckAndSyncColumn('statuses', 'sort_order', 'INT NOT NULL DEFAULT 0', 'color');
CALL CheckAndSyncColumn('statuses', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'sort_order');
CALL CheckAndSyncColumn('statuses', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('statuses', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('statuses', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('statuses', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('statuses', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: genders
CALL CheckAndSyncColumn('genders', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('genders', 'name', 'VARCHAR(30) NOT NULL', 'id');
CALL CheckAndSyncColumn('genders', 'code', 'VARCHAR(10) NOT NULL', 'name');
CALL CheckAndSyncColumn('genders', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'code');
CALL CheckAndSyncColumn('genders', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('genders', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('genders', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('genders', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('genders', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: departments
CALL CheckAndSyncColumn('departments', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('departments', 'name', 'VARCHAR(100) NOT NULL', 'id');
CALL CheckAndSyncColumn('departments', 'code', 'VARCHAR(30) NOT NULL', 'name');
CALL CheckAndSyncColumn('departments', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'code');
CALL CheckAndSyncColumn('departments', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('departments', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('departments', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('departments', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('departments', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: languages
CALL CheckAndSyncColumn('languages', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('languages', 'name', 'VARCHAR(50) NOT NULL', 'id');
CALL CheckAndSyncColumn('languages', 'code', 'VARCHAR(10) NOT NULL', 'name');
CALL CheckAndSyncColumn('languages', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'code');
CALL CheckAndSyncColumn('languages', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('languages', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('languages', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('languages', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('languages', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

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

-- Table: payment_methods
CALL CheckAndSyncColumn('payment_methods', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('payment_methods', 'name', 'VARCHAR(50) NOT NULL', 'id');
CALL CheckAndSyncColumn('payment_methods', 'code', 'VARCHAR(20) NOT NULL', 'name');
CALL CheckAndSyncColumn('payment_methods', 'description', 'VARCHAR(255) NULL', 'code');
CALL CheckAndSyncColumn('payment_methods', 'is_default', 'TINYINT(1) NOT NULL DEFAULT 0', 'description');
CALL CheckAndSyncColumn('payment_methods', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'is_default');
CALL CheckAndSyncColumn('payment_methods', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('payment_methods', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('payment_methods', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('payment_methods', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('payment_methods', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

-- Table: certificate_types
CALL CheckAndSyncColumn('certificate_types', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('certificate_types', 'name', 'VARCHAR(50) NOT NULL', 'id');
CALL CheckAndSyncColumn('certificate_types', 'code', 'VARCHAR(30) NOT NULL', 'name');
CALL CheckAndSyncColumn('certificate_types', 'description', 'VARCHAR(255) NULL', 'code');
CALL CheckAndSyncColumn('certificate_types', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'description');
CALL CheckAndSyncColumn('certificate_types', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('certificate_types', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('certificate_types', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');
CALL CheckAndSyncColumn('certificate_types', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'updated_by');
CALL CheckAndSyncColumn('certificate_types', 'is_deleted', 'TINYINT(1) NOT NULL DEFAULT 0', 'is_active');

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

-- Table: user_sessions
CALL CheckAndSyncColumn('user_sessions', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('user_sessions', 'session_token', 'CHAR(64) NOT NULL UNIQUE', 'id');
CALL CheckAndSyncColumn('user_sessions', 'user_id', 'INT UNSIGNED NOT NULL', 'session_token');
CALL CheckAndSyncColumn('user_sessions', 'church_id', 'INT UNSIGNED NOT NULL', 'user_id');
CALL CheckAndSyncColumn('user_sessions', 'ip_address', 'VARCHAR(45) NULL', 'church_id');
CALL CheckAndSyncColumn('user_sessions', 'user_agent', 'VARCHAR(255) NULL', 'ip_address');
CALL CheckAndSyncColumn('user_sessions', 'expires_at', 'DATETIME NOT NULL', 'user_agent');
CALL CheckAndSyncColumn('user_sessions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'expires_at');
CALL CheckAndSyncColumn('user_sessions', 'last_activity_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at');

-- Table: refresh_tokens
CALL CheckAndSyncColumn('refresh_tokens', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('refresh_tokens', 'user_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('refresh_tokens', 'token_hash', 'VARCHAR(255) NOT NULL', 'user_id');
CALL CheckAndSyncColumn('refresh_tokens', 'expires_at', 'DATETIME NOT NULL', 'token_hash');
CALL CheckAndSyncColumn('refresh_tokens', 'revoked_at', 'DATETIME NULL', 'expires_at');
CALL CheckAndSyncColumn('refresh_tokens', 'replaced_by_token_id', 'INT UNSIGNED NULL', 'revoked_at');
CALL CheckAndSyncColumn('refresh_tokens', 'ip_address', 'VARCHAR(64) NULL', 'replaced_by_token_id');
CALL CheckAndSyncColumn('refresh_tokens', 'user_agent', 'VARCHAR(255) NULL', 'ip_address');
CALL CheckAndSyncColumn('refresh_tokens', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'user_agent');

-- Table: webauthn_credentials
CALL CheckAndSyncColumn('webauthn_credentials', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('webauthn_credentials', 'user_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('webauthn_credentials', 'credential_id', 'VARCHAR(255) NOT NULL UNIQUE', 'user_id');
CALL CheckAndSyncColumn('webauthn_credentials', 'public_key', 'TEXT NOT NULL', 'credential_id');
CALL CheckAndSyncColumn('webauthn_credentials', 'counter', 'INT UNSIGNED NOT NULL DEFAULT 0', 'public_key');
CALL CheckAndSyncColumn('webauthn_credentials', 'transports', 'VARCHAR(255) NULL', 'counter');
CALL CheckAndSyncColumn('webauthn_credentials', 'device_name', 'VARCHAR(100) NULL', 'transports');
CALL CheckAndSyncColumn('webauthn_credentials', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'device_name');
CALL CheckAndSyncColumn('webauthn_credentials', 'last_used_at', 'DATETIME NULL', 'created_at');

-- Table: receipt_series
CALL CheckAndSyncColumn('receipt_series', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('receipt_series', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('receipt_series', 'prefix', 'VARCHAR(10) NOT NULL DEFAULT \'REC\'', 'church_id');
CALL CheckAndSyncColumn('receipt_series', 'current_number', 'INT UNSIGNED NOT NULL DEFAULT 0', 'prefix');
CALL CheckAndSyncColumn('receipt_series', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'current_number');
CALL CheckAndSyncColumn('receipt_series', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at');

-- Table: prayer_intentions
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

-- Table: payment_transactions
CALL CheckAndSyncColumn('payment_transactions', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('payment_transactions', 'prayer_intention_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('payment_transactions', 'provider', 'VARCHAR(30) NOT NULL', 'prayer_intention_id');
CALL CheckAndSyncColumn('payment_transactions', 'transaction_ref', 'VARCHAR(100) NOT NULL', 'provider');
CALL CheckAndSyncColumn('payment_transactions', 'provider_transaction_id', 'VARCHAR(100) NULL', 'transaction_ref');
CALL CheckAndSyncColumn('payment_transactions', 'amount', 'DECIMAL(10,2) NOT NULL', 'provider_transaction_id');
CALL CheckAndSyncColumn('payment_transactions', 'status', 'ENUM(\'pending\', \'success\', \'failed\') NOT NULL DEFAULT \'pending\'', 'amount');
CALL CheckAndSyncColumn('payment_transactions', 'failure_reason', 'VARCHAR(255) NULL', 'status');
CALL CheckAndSyncColumn('payment_transactions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'failure_reason');
CALL CheckAndSyncColumn('payment_transactions', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('payment_transactions', 'verified_at', 'DATETIME NULL', 'created_by');

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

-- Table: contribution_payment_transactions
CALL CheckAndSyncColumn('contribution_payment_transactions', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'contribution_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'provider', 'VARCHAR(30) NOT NULL', 'contribution_id');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'transaction_ref', 'VARCHAR(100) NOT NULL', 'provider');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'provider_transaction_id', 'VARCHAR(100) NULL', 'transaction_ref');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'amount', 'DECIMAL(10,2) NOT NULL', 'provider_transaction_id');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'status', 'ENUM(\'pending\', \'success\', \'failed\') NOT NULL DEFAULT \'pending\'', 'amount');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'failure_reason', 'VARCHAR(255) NULL', 'status');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'method', 'ENUM(\'cash\', \'upi\', \'cheque\', \'bank_transfer\', \'other\') NULL', 'failure_reason');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'reference_number', 'VARCHAR(100) NULL', 'method');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'remarks', 'VARCHAR(500) NULL', 'reference_number');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'payment_date', 'DATE NULL', 'remarks');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'payment_date');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('contribution_payment_transactions', 'verified_at', 'DATETIME NULL', 'created_by');

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

-- Table: certificate_series
CALL CheckAndSyncColumn('certificate_series', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('certificate_series', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('certificate_series', 'certificate_type', 'VARCHAR(50) NOT NULL', 'church_id');
CALL CheckAndSyncColumn('certificate_series', 'prefix', 'VARCHAR(10) NOT NULL', 'certificate_type');
CALL CheckAndSyncColumn('certificate_series', 'next_number', 'INT UNSIGNED NOT NULL DEFAULT 1', 'prefix');
CALL CheckAndSyncColumn('certificate_series', 'number_padding', 'INT UNSIGNED NOT NULL DEFAULT 4', 'next_number');
CALL CheckAndSyncColumn('certificate_series', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'number_padding');
CALL CheckAndSyncColumn('certificate_series', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at');

-- Table: certificate_templates
CALL CheckAndSyncColumn('certificate_templates', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('certificate_templates', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('certificate_templates', 'certificate_type', 'VARCHAR(50) NOT NULL', 'church_id');
CALL CheckAndSyncColumn('certificate_templates', 'template_name', 'VARCHAR(100) NOT NULL', 'certificate_type');
CALL CheckAndSyncColumn('certificate_templates', 'html_template', 'MEDIUMTEXT NOT NULL', 'template_name');
CALL CheckAndSyncColumn('certificate_templates', 'css_styles', 'MEDIUMTEXT NULL', 'html_template');
CALL CheckAndSyncColumn('certificate_templates', 'is_default', 'TINYINT(1) NOT NULL DEFAULT 0', 'css_styles');
CALL CheckAndSyncColumn('certificate_templates', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'is_default');
CALL CheckAndSyncColumn('certificate_templates', 'created_by', 'INT UNSIGNED NULL', 'created_at');
CALL CheckAndSyncColumn('certificate_templates', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('certificate_templates', 'updated_by', 'INT UNSIGNED NULL', 'updated_at');

-- Table: certificate_print_templates
CALL CheckAndSyncColumn('certificate_print_templates', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('certificate_print_templates', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('certificate_print_templates', 'certificate_type', 'VARCHAR(30) NOT NULL', 'church_id');
CALL CheckAndSyncColumn('certificate_print_templates', 'title', 'VARCHAR(255) NULL', 'certificate_type');
CALL CheckAndSyncColumn('certificate_print_templates', 'subheader_prefix', 'VARCHAR(100) NULL', 'title');
CALL CheckAndSyncColumn('certificate_print_templates', 'diocese_label', 'VARCHAR(150) NULL', 'subheader_prefix');
CALL CheckAndSyncColumn('certificate_print_templates', 'signatory_title', 'VARCHAR(100) NULL', 'diocese_label');
CALL CheckAndSyncColumn('certificate_print_templates', 'seal_label', 'VARCHAR(50) NULL', 'signatory_title');
CALL CheckAndSyncColumn('certificate_print_templates', 'field_labels', 'JSON NULL', 'seal_label');
CALL CheckAndSyncColumn('certificate_print_templates', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'field_labels');
CALL CheckAndSyncColumn('certificate_print_templates', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at');

-- Table: restricted_dates
CALL CheckAndSyncColumn('restricted_dates', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('restricted_dates', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('restricted_dates', 'restricted_date', 'DATE NOT NULL', 'church_id');
CALL CheckAndSyncColumn('restricted_dates', 'reason', 'VARCHAR(255) NULL', 'restricted_date');
CALL CheckAndSyncColumn('restricted_dates', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'reason');
CALL CheckAndSyncColumn('restricted_dates', 'created_by', 'INT UNSIGNED NULL', 'created_at');

-- Table: audit_logs
CALL CheckAndSyncColumn('audit_logs', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('audit_logs', 'church_id', 'INT UNSIGNED NULL', 'id');
CALL CheckAndSyncColumn('audit_logs', 'user_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('audit_logs', 'module', 'VARCHAR(50) NOT NULL', 'user_id');
CALL CheckAndSyncColumn('audit_logs', 'action', 'VARCHAR(50) NOT NULL', 'module');
CALL CheckAndSyncColumn('audit_logs', 'entity_id', 'INT UNSIGNED NULL', 'action');
CALL CheckAndSyncColumn('audit_logs', 'ip_address', 'VARCHAR(45) NULL', 'entity_id');
CALL CheckAndSyncColumn('audit_logs', 'user_agent', 'VARCHAR(255) NULL', 'ip_address');
CALL CheckAndSyncColumn('audit_logs', 'old_values', 'JSON NULL', 'user_agent');
CALL CheckAndSyncColumn('audit_logs', 'new_values', 'JSON NULL', 'old_values');
CALL CheckAndSyncColumn('audit_logs', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'new_values');

-- Table: system_settings
CALL CheckAndSyncColumn('system_settings', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('system_settings', 'church_id', 'INT UNSIGNED NULL', 'id');
CALL CheckAndSyncColumn('system_settings', 'setting_key', 'VARCHAR(100) NOT NULL UNIQUE', 'church_id');
CALL CheckAndSyncColumn('system_settings', 'setting_value', 'TEXT NULL', 'setting_key');
CALL CheckAndSyncColumn('system_settings', 'description', 'VARCHAR(255) NULL', 'setting_value');
CALL CheckAndSyncColumn('system_settings', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'description');

-- Table: account_heads
CALL CheckAndSyncColumn('account_heads', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('account_heads', 'church_id', 'INT UNSIGNED NULL', 'id');
CALL CheckAndSyncColumn('account_heads', 'type', 'ENUM(\'receipt\', \'payment\') NOT NULL', 'church_id');
CALL CheckAndSyncColumn('account_heads', 'section', 'VARCHAR(100) NOT NULL', 'type');
CALL CheckAndSyncColumn('account_heads', 'name', 'VARCHAR(255) NOT NULL', 'section');
CALL CheckAndSyncColumn('account_heads', 'tamil_name', 'VARCHAR(255) NULL', 'name');
CALL CheckAndSyncColumn('account_heads', 'code', 'VARCHAR(100) NULL', 'tamil_name');
CALL CheckAndSyncColumn('account_heads', 'is_system', 'TINYINT(1) NOT NULL DEFAULT 0', 'code');
CALL CheckAndSyncColumn('account_heads', 'auto_source', 'VARCHAR(100) NULL', 'is_system');
CALL CheckAndSyncColumn('account_heads', 'order_index', 'INT NOT NULL DEFAULT 0', 'auto_source');
CALL CheckAndSyncColumn('account_heads', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1', 'order_index');
CALL CheckAndSyncColumn('account_heads', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'is_active');
CALL CheckAndSyncColumn('account_heads', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at');

-- Table: church_expenses
CALL CheckAndSyncColumn('church_expenses', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('church_expenses', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('church_expenses', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('church_expenses', 'entry_date', 'DATE NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('church_expenses', 'month_year', 'VARCHAR(7) NOT NULL', 'entry_date');
CALL CheckAndSyncColumn('church_expenses', 'type', 'ENUM(\'receipt\', \'payment\') NOT NULL', 'month_year');
CALL CheckAndSyncColumn('church_expenses', 'head_id', 'INT UNSIGNED NULL', 'type');
CALL CheckAndSyncColumn('church_expenses', 'head_name', 'VARCHAR(255) NOT NULL', 'head_id');
CALL CheckAndSyncColumn('church_expenses', 'amount', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'head_name');
CALL CheckAndSyncColumn('church_expenses', 'payment_method_id', 'INT UNSIGNED NULL', 'amount');
CALL CheckAndSyncColumn('church_expenses', 'voucher_no', 'VARCHAR(50) NULL', 'payment_method_id');
CALL CheckAndSyncColumn('church_expenses', 'paid_to', 'VARCHAR(255) NULL', 'voucher_no');
CALL CheckAndSyncColumn('church_expenses', 'notes', 'TEXT NULL', 'paid_to');
CALL CheckAndSyncColumn('church_expenses', 'is_auto_sync', 'TINYINT(1) NOT NULL DEFAULT 0', 'notes');
CALL CheckAndSyncColumn('church_expenses', 'created_by', 'INT UNSIGNED NULL', 'is_auto_sync');
CALL CheckAndSyncColumn('church_expenses', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('church_expenses', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at');
CALL CheckAndSyncColumn('church_expenses', 'deleted_at', 'DATETIME NULL', 'updated_at');

-- Table: monthly_financial_abstracts
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'id', 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY', '');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'church_id', 'INT UNSIGNED NOT NULL', 'id');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'branch_id', 'INT UNSIGNED NULL', 'church_id');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'month_year', 'VARCHAR(7) NOT NULL', 'branch_id');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'opening_cash_hand', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'month_year');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'opening_cash_bank', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'opening_cash_hand');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'opening_fixed_deposits', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'opening_cash_bank');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'closing_cash_hand', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'opening_fixed_deposits');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'closing_cash_bank', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'closing_cash_hand');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'closing_fixed_deposits', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'closing_cash_bank');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'receipts_specific_project', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'closing_fixed_deposits');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'payments_specific_project', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'receipts_specific_project');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'remit_stole_fees', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'payments_specific_project');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'remit_mass_intentions', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'remit_stole_fees');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'remit_parish_contribution', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'remit_mass_intentions');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'remit_diocesan_collection', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'remit_parish_contribution');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'recv_monthly_allowance', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'remit_diocesan_collection');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'recv_medical_allowance', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'recv_monthly_allowance');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'recv_mission_conveyance', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'recv_medical_allowance');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'recv_any_other', 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00', 'recv_mission_conveyance');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'priest_name', 'VARCHAR(255) NULL', 'recv_any_other');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'designation', 'VARCHAR(255) NULL', 'priest_name');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'unit_no', 'VARCHAR(50) NULL', 'designation');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'notes', 'TEXT NULL', 'unit_no');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'created_by', 'INT UNSIGNED NULL', 'notes');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP', 'created_by');
CALL CheckAndSyncColumn('monthly_financial_abstracts', 'updated_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'created_at');

-- =============================================================================
-- INDEX VERIFICATION & SAFE CREATION
-- =============================================================================

-- Indexes for: countries
CALL CheckAndSyncIndex('countries', 'uq_countries_iso', 'iso_code');

-- Indexes for: states
CALL CheckAndSyncIndex('states', 'idx_states_country', 'country_id');

-- Indexes for: districts
CALL CheckAndSyncIndex('districts', 'idx_districts_state', 'state_id');

-- Indexes for: branches
CALL CheckAndSyncIndex('branches', 'idx_branches_church', 'church_id');

-- Indexes for: priests
CALL CheckAndSyncIndex('priests', 'idx_priests_church', 'church_id');

-- Indexes for: masses
CALL CheckAndSyncIndex('masses', 'idx_masses_church', 'church_id');

-- Indexes for: roles
CALL CheckAndSyncIndex('roles', 'uq_roles_code', 'code');

-- Indexes for: permissions
CALL CheckAndSyncIndex('permissions', 'uq_permissions_code', 'code');

-- Indexes for: role_permissions
CALL CheckAndSyncIndex('role_permissions', 'uq_role_permission', 'role_id, permission_id');

-- Indexes for: statuses
CALL CheckAndSyncIndex('statuses', 'uq_status_entity_code', 'entity_type, code');

-- Indexes for: genders
CALL CheckAndSyncIndex('genders', 'uq_genders_code', 'code');

-- Indexes for: departments
CALL CheckAndSyncIndex('departments', 'uq_departments_code', 'code');

-- Indexes for: languages
CALL CheckAndSyncIndex('languages', 'uq_languages_code', 'code');

-- Indexes for: prayer_intention_master
CALL CheckAndSyncIndex('prayer_intention_master', 'uq_pim_code', 'code');

-- Indexes for: payment_methods
CALL CheckAndSyncIndex('payment_methods', 'uq_pm_code', 'code');

-- Indexes for: certificate_types
CALL CheckAndSyncIndex('certificate_types', 'uq_ct_code', 'code');

-- Indexes for: users
CALL CheckAndSyncIndex('users', 'uq_users_username', 'username');
CALL CheckAndSyncIndex('users', 'idx_users_role', 'role_id');
CALL CheckAndSyncIndex('users', 'idx_users_church', 'church_id');

-- Indexes for: user_sessions
CALL CheckAndSyncIndex('user_sessions', 'idx_user_sessions_user', 'user_id');
CALL CheckAndSyncIndex('user_sessions', 'idx_user_sessions_expires', 'expires_at');

-- Indexes for: refresh_tokens
CALL CheckAndSyncIndex('refresh_tokens', 'idx_refresh_tokens_user', 'user_id');
CALL CheckAndSyncIndex('refresh_tokens', 'idx_refresh_tokens_expiry', 'expires_at');

-- Indexes for: webauthn_credentials
CALL CheckAndSyncIndex('webauthn_credentials', 'idx_webauthn_user', 'user_id');

-- Indexes for: receipt_series
CALL CheckAndSyncIndex('receipt_series', 'uq_receipt_series_church', 'church_id');

-- Indexes for: prayer_intentions
CALL CheckAndSyncIndex('prayer_intentions', 'idx_prayer_intentions_church_receipt', 'church_id, receipt_no');
CALL CheckAndSyncIndex('prayer_intentions', 'idx_prayer_intentions_date_mass', 'prayer_date, mass_id');
CALL CheckAndSyncIndex('prayer_intentions', 'idx_prayer_intentions_status', 'status_id');
CALL CheckAndSyncIndex('prayer_intentions', 'idx_prayer_intentions_phone', 'phone');
CALL CheckAndSyncIndex('prayer_intentions', 'idx_prayer_intentions_refunded', 'is_refunded, refunded_at');

-- Indexes for: payment_transactions
CALL CheckAndSyncIndex('payment_transactions', 'uq_payment_transactions_ref', 'transaction_ref');
CALL CheckAndSyncIndex('payment_transactions', 'idx_payment_transactions_intention', 'prayer_intention_id');

-- Indexes for: contribution_types
CALL CheckAndSyncIndex('contribution_types', 'uq_contribution_types_code', 'code');

-- Indexes for: contributions
CALL CheckAndSyncIndex('contributions', 'idx_contributions_church_receipt', 'church_id, receipt_no');
CALL CheckAndSyncIndex('contributions', 'idx_contributions_phone', 'phone');
CALL CheckAndSyncIndex('contributions', 'idx_contributions_refunded', 'is_refunded, refunded_at');

-- Indexes for: contribution_payment_transactions
CALL CheckAndSyncIndex('contribution_payment_transactions', 'uq_contribution_payment_transactions_ref', 'transaction_ref');
CALL CheckAndSyncIndex('contribution_payment_transactions', 'idx_contribution_payment_transactions_contribution', 'contribution_id');

-- Indexes for: baptism_certificates
CALL CheckAndSyncIndex('baptism_certificates', 'uq_baptism_certificate_no', 'certificate_no');
CALL CheckAndSyncIndex('baptism_certificates', 'idx_baptism_child_name', 'child_name');

-- Indexes for: marriage_certificates
CALL CheckAndSyncIndex('marriage_certificates', 'uq_marriage_certificate_no', 'certificate_no');
CALL CheckAndSyncIndex('marriage_certificates', 'idx_marriage_names', 'bride_name, groom_name');

-- Indexes for: death_certificates
CALL CheckAndSyncIndex('death_certificates', 'uq_death_certificate_no', 'certificate_no');
CALL CheckAndSyncIndex('death_certificates', 'idx_death_deceased_name', 'deceased_name');

-- Indexes for: confirmation_certificates
CALL CheckAndSyncIndex('confirmation_certificates', 'uq_confirmation_certificate_no', 'certificate_no');
CALL CheckAndSyncIndex('confirmation_certificates', 'idx_confirmation_name', 'name');

-- Indexes for: certificate_series
CALL CheckAndSyncIndex('certificate_series', 'uq_cert_series_church_type', 'church_id, certificate_type');

-- Indexes for: certificate_templates
CALL CheckAndSyncIndex('certificate_templates', 'uq_cert_tmpl_church_type', 'church_id, certificate_type, template_name');

-- Indexes for: certificate_print_templates
CALL CheckAndSyncIndex('certificate_print_templates', 'uq_church_cert_type', 'church_id, certificate_type');
CALL CheckAndSyncIndex('certificate_print_templates', 'idx_cert_templates_church', 'church_id');

-- Indexes for: restricted_dates
CALL CheckAndSyncIndex('restricted_dates', 'uq_restricted_date_church', 'church_id, restricted_date');

-- Indexes for: audit_logs
CALL CheckAndSyncIndex('audit_logs', 'idx_audit_church', 'church_id');
CALL CheckAndSyncIndex('audit_logs', 'idx_audit_user', 'user_id');
CALL CheckAndSyncIndex('audit_logs', 'idx_audit_module', 'module');
CALL CheckAndSyncIndex('audit_logs', 'idx_audit_created', 'created_at');

-- Indexes for: account_heads
CALL CheckAndSyncIndex('account_heads', 'idx_heads_church_type', 'church_id, type, is_active');
CALL CheckAndSyncIndex('account_heads', 'idx_heads_section', 'section, order_index');

-- Indexes for: church_expenses
CALL CheckAndSyncIndex('church_expenses', 'idx_expenses_church_month', 'church_id, month_year, entry_date');
CALL CheckAndSyncIndex('church_expenses', 'idx_expenses_head', 'head_id');
CALL CheckAndSyncIndex('church_expenses', 'idx_expenses_deleted', 'deleted_at');

-- Indexes for: monthly_financial_abstracts
CALL CheckAndSyncIndex('monthly_financial_abstracts', 'uk_church_month_branch', 'church_id, month_year, branch_id');

-- Refund & Analytics Performance Indexes
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
  ('contributions', 'export', 'contributions.export', 'export contributions'),
  ('expenses', 'view', 'expenses.view', 'View church expenses and accounts'),
  ('expenses', 'create', 'expenses.create', 'Create expense/income entries'),
  ('expenses', 'update', 'expenses.update', 'Update expense/income entries'),
  ('expenses', 'delete', 'expenses.delete', 'Delete expense/income entries'),
  ('expenses', 'print', 'expenses.print', 'Print financial journal and report'),
  ('expenses', 'export', 'expenses.export', 'Export financial records to Excel');

-- Map permissions to ADMIN role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'ADMIN'
   AND p.module IN ('confirmation_certificates', 'contributions', 'expenses');

-- Map permissions to ACCOUNTANT role
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'ACCOUNTANT'
   AND p.module IN ('contributions', 'expenses');

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
-- 6. SYSTEM SETTINGS & STANDARD DEFAULT ACCOUNT HEADS
-- =============================================================================

INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
  ('RECEIPT_QR_MODE', 'calendar', 'Receipt QR contents: "calendar" = offline event, "url" = online link'),
  ('DEFAULT_CURRENCY', 'INR', 'Default system currency code'),
  ('RECEIPT_THANK_YOU_MESSAGE', 'Thank you for your offering. God Bless You.', 'Default message printed on receipts'),
  ('UPI_ENABLED', '0', 'Enable UPI QR on receipts (0 = disabled, 1 = enabled)');

-- Seed Standard Default Account Heads
INSERT IGNORE INTO `account_heads` (`church_id`, `type`, `section`, `name`, `tamil_name`, `code`, `is_system`, `auto_source`, `order_index`) VALUES
(NULL, 'receipt', 'Opening Balance', 'Cash in hand', 'கையிருப்பு ரொக்கம்', 'REC_OPEN_CASH', 1, 'opening_cash', 10),
(NULL, 'receipt', 'Opening Balance', 'Cash at Bank', 'வங்கி இருப்பு', 'REC_OPEN_BANK', 1, 'opening_bank', 20),
(NULL, 'receipt', 'Opening Balance', 'Fixed Deposits', 'வைப்பு நிதி', 'REC_OPEN_FD', 1, 'opening_fd', 30),
(NULL, 'receipt', 'Other Income', 'Collection from Kurusadies', 'குருசடி காணிக்கை', 'REC_KURUSADIES', 1, NULL, 40),
(NULL, 'receipt', 'Other Income', 'Contribution from Village', 'கிராம பங்கு காணிக்கை', 'REC_VILLAGE', 1, 'contributions_village', 50),
(NULL, 'receipt', 'Other Income', 'Collection from Substations', 'கிளைப்பங்கு காணிக்கை', 'REC_SUBSTATIONS', 1, NULL, 60),
(NULL, 'receipt', 'Other Income', 'Voluntary Contribution', 'தன்னார்வ நன்கொடை', 'REC_VOLUNTARY', 1, 'contributions_voluntary', 70),
(NULL, 'receipt', 'Other Income', 'Dumb box collections', 'உண்டியல் காணிக்கை', 'REC_DUMB_BOX', 1, 'contributions_dumb_box', 80),
(NULL, 'receipt', 'Other Income', 'Family Subscription', 'குடும்ப மாதச் சந்தா', 'REC_FAMILY_SUB', 1, 'contributions_family_sub', 90),
(NULL, 'receipt', 'Other Income', 'Feast Collections', 'திருவிழா காணிக்கை', 'REC_FEAST', 1, 'contributions_feast', 100),
(NULL, 'receipt', 'Other Income', 'Liturgical services', 'வழிபாட்டு சேவைகள்', 'REC_LITURGICAL', 1, NULL, 110),
(NULL, 'receipt', 'Other Income', 'Other Collections', 'இதர காணிக்கைகள்', 'REC_OTHER_COLL', 1, NULL, 120),
(NULL, 'receipt', 'Other Income', 'Travel allowance from substations', 'கிளைப்பங்கு பயணப்படி', 'REC_TRAVEL_ALLOW', 1, NULL, 130),
(NULL, 'receipt', 'Other Income', 'Priest Allowance (Village)', 'பங்குத்தந்தை படி (கிராமம்)', 'REC_PRIEST_ALLOW_VILL', 1, NULL, 140),
(NULL, 'receipt', 'Other Income', 'Priest Allowance (Dio)', 'பங்குத்தந்தை படி (மறைமாவட்டம்)', 'REC_PRIEST_ALLOW_DIO', 1, NULL, 150),
(NULL, 'receipt', 'Other Income', 'GST Received', 'பெறப்பட்ட ஜி.எஸ்.டி', 'REC_GST', 1, NULL, 160),
(NULL, 'receipt', 'Other Income', 'Shops & Hall Rent', 'கடைகள் மற்றும் மண்டப வாடகை', 'REC_SHOPS_HALL', 1, NULL, 170),
(NULL, 'receipt', 'Other Income', 'House Rent', 'வீட்டு வாடகை', 'REC_HOUSE_RENT', 1, NULL, 180),
(NULL, 'receipt', 'Other Income', 'Interest Received', 'வட்டி வருமானம்', 'REC_INTEREST', 1, NULL, 190),
(NULL, 'receipt', 'Other Income', 'Schools & Others', 'பள்ளி மற்றும் இதர வருமானம்', 'REC_SCHOOLS', 1, NULL, 200),
(NULL, 'receipt', 'Other Income', 'Sunday Collection', 'ஞாயிறு காணிக்கை', 'REC_SUNDAY_COLL', 1, 'contributions_sunday', 210),
(NULL, 'receipt', 'Other Income', 'Sale of Materials', 'பொருட்கள் விற்பனை', 'REC_SALE_MAT', 1, NULL, 220),
(NULL, 'receipt', 'Other Income', 'Sale of Gifts & Mass Offerings thru Auction', 'ஏல விற்பனை வருமானம்', 'REC_AUCTION', 1, NULL, 230),
(NULL, 'receipt', 'Payables', 'Mass Received from People', 'மக்களிடமிருந்து திருப்பலி காணிக்கை', 'REC_MASS_PEOPLE', 1, 'mass_intentions_people', 240),
(NULL, 'receipt', 'Payables', 'Mass Received from Dio', 'மறைமாவட்ட திருப்பலி காணிக்கை', 'REC_MASS_DIO', 1, NULL, 250),
(NULL, 'receipt', 'Payables', 'Stole Fee', 'ஸ்தோல கட்டணம்', 'REC_STOLE_FEE', 1, NULL, 260),
(NULL, 'receipt', 'Collections Made', 'African Mission', 'ஆப்பிரிக்க மிஷன்', 'REC_AFRICAN_MISSION', 1, NULL, 270),
(NULL, 'receipt', 'Collections Made', 'Bible Sunday Collection', 'விவிலிய ஞாயிறு', 'REC_BIBLE_SUNDAY', 1, NULL, 280),
(NULL, 'receipt', 'Collections Made', 'Good Friday Collection', 'புனித வெள்ளி', 'REC_GOOD_FRIDAY', 1, NULL, 290),
(NULL, 'receipt', 'Collections Made', 'Holy Childhood Collection', 'புனித குழந்தைப்பருவம்', 'REC_HOLY_CHILDHOOD', 1, NULL, 300),
(NULL, 'receipt', 'Collections Made', 'Holy Land Collection', 'புனித பூமி', 'REC_HOLY_LAND', 1, NULL, 310),
(NULL, 'receipt', 'Collections Made', 'Holy See', 'தூய பேதுரு நிதி (ரோம்)', 'REC_HOLY_SEE', 1, NULL, 320),
(NULL, 'receipt', 'Collections Made', 'Mission Sunday Collection', 'மிஷன் ஞாயிறு', 'REC_MISSION_SUNDAY', 1, NULL, 330),
(NULL, 'receipt', 'Collections Made', 'St. Peter Pence', 'தூய பேதுரு காணிக்கை', 'REC_ST_PETER_PENCE', 1, NULL, 340),
(NULL, 'receipt', 'Collections Made', 'St. Peter the Apostle', 'திருத்தூதர் பேதுரு', 'REC_ST_PETER_APOSTLE', 1, NULL, 350),
(NULL, 'receipt', 'Collections Made', 'Vocation Day Collection', 'அழைத்தல் நாள்', 'REC_VOCATION_DAY', 1, NULL, 360),
(NULL, 'receipt', 'Collections Made', 'Project Income / Diocese', 'திட்ட வருமானம் / மறைமாவட்டம்', 'REC_PROJECT_INCOME', 1, NULL, 370),
(NULL, 'receipt', 'Collections Made', 'Any Other Source', 'பிற மூலங்கள்', 'REC_OTHER_SOURCE', 1, NULL, 380),
(NULL, 'receipt', 'Collections Made', 'Loans Received', 'பெறப்பட்ட கடன்கள்', 'REC_LOANS_RECV', 1, NULL, 390),
(NULL, 'receipt', 'Collections Made', 'Advances Received', 'பெறப்பட்ட முன்பணம்', 'REC_ADV_RECV', 1, NULL, 400),
(NULL, 'payment', 'Administrative Expenses', 'Bank Charges', 'வங்கி கட்டணங்கள்', 'PAY_BANK_CHARGES', 1, NULL, 10),
(NULL, 'payment', 'Administrative Expenses', 'Books & Periodicals', 'புத்தகங்கள் மற்றும் இதழ்கள்', 'PAY_BOOKS', 1, NULL, 20),
(NULL, 'payment', 'Administrative Expenses', 'Charity & Donations', 'தர்மம் மற்றும் நன்கொடைகள்', 'PAY_CHARITY', 1, NULL, 30),
(NULL, 'payment', 'Administrative Expenses', 'Conveyance to guest priests', 'விருந்தினர் பங்குத்தந்தையர் பயணப்படி', 'PAY_GUEST_PRIESTS', 1, NULL, 40),
(NULL, 'payment', 'Administrative Expenses', 'Electricity, Telephone & Taxes', 'மின்சாரம், தொலைபேசி மற்றும் வரிகள்', 'PAY_EB_PHONE_TAX', 1, NULL, 50),
(NULL, 'payment', 'Administrative Expenses', 'Feast / Other Celebrations', 'திருவிழா மற்றும் பிற விழாக்கள்', 'PAY_FEAST_EXP', 1, NULL, 60),
(NULL, 'payment', 'Administrative Expenses', 'Liturgy', 'வழிபாட்டு செலவுகள்', 'PAY_LITURGY_EXP', 1, NULL, 70),
(NULL, 'payment', 'Administrative Expenses', 'Meeting expenses', 'கூட்டச் செலவுகள்', 'PAY_MEETING_EXP', 1, NULL, 80),
(NULL, 'payment', 'Administrative Expenses', 'Parish expenses', 'பங்கு நிர்வாகச் செலவுகள்', 'PAY_PARISH_EXP', 1, NULL, 90),
(NULL, 'payment', 'Administrative Expenses', 'Priest Allowance', 'பங்குத்தந்தை படி', 'PAY_PRIEST_ALLOW', 1, NULL, 100),
(NULL, 'payment', 'Administrative Expenses', 'Printing, Postage & Stationery', 'அச்சிடுதல், தபால் மற்றும் எழுதுபொருட்கள்', 'PAY_PRINTING', 1, NULL, 110),
(NULL, 'payment', 'Administrative Expenses', 'Purchase of Materials & Properties', 'பொருட்கள் மற்றும் சொத்துக்கள் வாங்குதல்', 'PAY_PURCHASE_MAT', 1, NULL, 120),
(NULL, 'payment', 'Administrative Expenses', 'School Expenses', 'பள்ளிச் செலவுகள்', 'PAY_SCHOOL_EXP', 1, NULL, 130),
(NULL, 'payment', 'Administrative Expenses', 'Travel expenses', 'பயணச் செலவுகள்', 'PAY_TRAVEL_EXP', 1, NULL, 140),
(NULL, 'payment', 'Administrative Expenses', 'Vehicle, Inverter & Generator', 'வாகனம், இன்வெர்ட்டர் & ஜெனரேட்டர்', 'PAY_VEHICLE_GEN', 1, NULL, 150),
(NULL, 'payment', 'Salary/Honorarium', 'Parish staff', 'பங்கு ஊழியர்கள் சம்பளம்', 'PAY_PARISH_STAFF', 1, NULL, 160),
(NULL, 'payment', 'Salary/Honorarium', 'School staff', 'பள்ளி ஊழியர்கள் சம்பளம்', 'PAY_SCHOOL_STAFF', 1, NULL, 170),
(NULL, 'payment', 'Masses', 'Mass paid to guest priests', 'விருந்தினர் தந்தையருக்கு திருப்பலி படி', 'PAY_MASS_GUEST', 1, NULL, 180),
(NULL, 'payment', 'Masses', 'Mass paid to Parish Priest', 'பங்குத்தந்தைக்கு திருப்பலி படி', 'PAY_MASS_PARISH_PRIEST', 1, NULL, 190),
(NULL, 'payment', 'Repairs & Maintenance', 'Maintenance of Substations', 'கிளைப்பங்கு பராமரிப்பு', 'PAY_MAINT_SUBSTATION', 1, NULL, 200),
(NULL, 'payment', 'Repairs & Maintenance', 'Church & Kurusadies', 'ஆலயம் மற்றும் குருசடி பராமரிப்பு', 'PAY_MAINT_CHURCH', 1, NULL, 210),
(NULL, 'payment', 'Repairs & Maintenance', 'Presbytery', 'இல்லப் பராமரிப்பு', 'PAY_MAINT_PRESBYTERY', 1, NULL, 220),
(NULL, 'payment', 'Repairs & Maintenance', 'School Buildings', 'பள்ளிக் கட்டிடப் பராமரிப்பு', 'PAY_MAINT_SCHOOL', 1, NULL, 230),
(NULL, 'payment', 'Repairs & Maintenance', 'Other Maintenance', 'இதர பராமரிப்பு செலவுகள்', 'PAY_MAINT_OTHER', 1, NULL, 240),
(NULL, 'payment', 'Collections remitted to Diocese', 'African Mission Paid', 'ஆப்பிரிக்க மிஷன் செலுத்தியது', 'PAY_REMIT_AFRICAN', 1, NULL, 250),
(NULL, 'payment', 'Collections remitted to Diocese', 'Bible Sunday Collection Paid', 'விவிலிய ஞாயிறு செலுத்தியது', 'PAY_REMIT_BIBLE', 1, NULL, 260),
(NULL, 'payment', 'Collections remitted to Diocese', 'Bination to Diocese', 'இரு திருப்பலி படி மறைமாவட்டத்திற்கு', 'PAY_REMIT_BINATION', 1, NULL, 270),
(NULL, 'payment', 'Collections remitted to Diocese', 'Extra Masses paid to Diocese', 'கூடுதல் திருப்பலி மறைமாவட்டத்திற்கு', 'PAY_REMIT_EXTRA_MASS', 1, NULL, 280),
(NULL, 'payment', 'Collections remitted to Diocese', 'Good Friday Collection Paid', 'புனித வெள்ளி செலுத்தியது', 'PAY_REMIT_GOOD_FRIDAY', 1, NULL, 290),
(NULL, 'payment', 'Collections remitted to Diocese', 'Holy Childhood Collection Paid', 'புனித குழந்தைப்பருவம் செலுத்தியது', 'PAY_REMIT_HOLY_CHILD', 1, NULL, 300),
(NULL, 'payment', 'Collections remitted to Diocese', 'Holy Land Collection Paid', 'புனித பூமி செலுத்தியது', 'PAY_REMIT_HOLY_LAND', 1, NULL, 310),
(NULL, 'payment', 'Collections remitted to Diocese', 'Holy See Paid', 'தூய பேதுரு நிதி செலுத்தியது', 'PAY_REMIT_HOLY_SEE', 1, NULL, 320),
(NULL, 'payment', 'Collections remitted to Diocese', 'Mission Sunday Collection Paid', 'மிஷன் ஞாயிறு செலுத்தியது', 'PAY_REMIT_MISSION_SUN', 1, NULL, 330),
(NULL, 'payment', 'Collections remitted to Diocese', 'Parish Contribution', 'பங்கு பங்குத்தொகை செலுத்தியது', 'PAY_REMIT_PARISH_CONTRIB', 1, NULL, 340),
(NULL, 'payment', 'Collections remitted to Diocese', 'GST Paid', 'செலுத்தப்பட்ட ஜி.எஸ்.டி', 'PAY_REMIT_GST', 1, NULL, 350),
(NULL, 'payment', 'Collections remitted to Diocese', 'Shrine Contribution', 'திருத்தல பங்குத்தொகை', 'PAY_REMIT_SHRINE', 1, NULL, 360),
(NULL, 'payment', 'Collections remitted to Diocese', 'St. Peter Pence Paid', 'தூய பேதுரு காணிக்கை செலுத்தியது', 'PAY_REMIT_ST_PETER_PENCE', 1, NULL, 370),
(NULL, 'payment', 'Collections remitted to Diocese', 'St. Peter the Apostle Paid', 'திருத்தூதர் பேதுரு செலுத்தியது', 'PAY_REMIT_ST_PETER_APOSTLE', 1, NULL, 380),
(NULL, 'payment', 'Collections remitted to Diocese', 'Vocation Day Collection Paid', 'அழைத்தல் நாள் செலுத்தியது', 'PAY_REMIT_VOCATION', 1, NULL, 390),
(NULL, 'payment', 'Collections remitted to Diocese', 'Stole fee', 'ஸ்தோல கட்டணம் செலுத்தியது', 'PAY_REMIT_STOLE', 1, NULL, 400),
(NULL, 'payment', 'Collections remitted to Diocese', 'Loans Paid', 'செலுத்தப்பட்ட கடன்கள்', 'PAY_LOANS_PAID', 1, NULL, 410),
(NULL, 'payment', 'Collections remitted to Diocese', 'Advances Paid', 'செலுத்தப்பட்ட முன்பணம்', 'PAY_ADV_PAID', 1, NULL, 420),
(NULL, 'payment', 'Collections remitted to Diocese', 'Project Money spent', 'திட்டச் செலவு', 'PAY_PROJECT_SPENT', 1, NULL, 430),
(NULL, 'payment', 'Collections remitted to Diocese', 'Any Others', 'பிற செலவுகள்', 'PAY_OTHER_PAY', 1, NULL, 440),
(NULL, 'payment', 'Closing Balance', 'Cash in hand', 'கையிருப்பு ரொக்கம்', 'PAY_CLOSE_CASH', 1, 'closing_cash', 450),
(NULL, 'payment', 'Closing Balance', 'Cash at bank', 'வங்கி இருப்பு', 'PAY_CLOSE_BANK', 1, 'closing_bank', 460),
(NULL, 'payment', 'Closing Balance', 'Fixed Deposits', 'வைப்பு நிதி', 'PAY_CLOSE_FD', 1, 'closing_fd', 470);


-- =============================================================================
-- 7. REGISTER ALL 49 MIGRATIONS IN SCHEMA_MIGRATIONS
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
  ('048_refunds_support_2026_10_03.sql'), ('049_church_expenses_and_accounts.sql');


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
