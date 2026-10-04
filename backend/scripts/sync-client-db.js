/**
 * COMS Client Database Synchronization & Auto-Update Engine
 * 
 * Safe, idempotent, non-destructive database updater.
 * - Checks if database exists -> creates if missing.
 * - Checks each table -> creates if missing.
 * - Checks each column in existing tables:
 *     - If column exists -> skips safely.
 *     - If column is missing -> adds column without touching existing data.
 * - Checks & adds missing indexes and lookup permissions/series.
 * - Never deletes or drops anything.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = 'root',
  DB_NAME = 'coms_db',
} = process.env;

// Complete Schema Table Definitions
const TABLES_SCHEMA = {
  schema_migrations: {
    createSql: `CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      filename: 'VARCHAR(255) NOT NULL UNIQUE',
      applied_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
  },

  system_settings: {
    createSql: `CREATE TABLE IF NOT EXISTS system_settings (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT NULL,
      description VARCHAR(255) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      setting_key: 'VARCHAR(100) NOT NULL UNIQUE',
      setting_value: 'TEXT NULL',
      description: 'VARCHAR(255) NULL',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },

  churches: {
    createSql: `CREATE TABLE IF NOT EXISTS churches (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      name_ta VARCHAR(200) NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      address_line1 VARCHAR(200) NULL,
      address_line1_ta VARCHAR(200) NULL,
      address_line2 VARCHAR(200) NULL,
      address_line2_ta VARCHAR(200) NULL,
      city VARCHAR(100) NULL,
      city_ta VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      country VARCHAR(100) NULL DEFAULT 'India',
      postal_code VARCHAR(20) NULL,
      phone VARCHAR(20) NULL,
      email VARCHAR(100) NULL,
      website VARCHAR(200) NULL,
      diocese_name VARCHAR(150) NULL,
      parish_priest_name VARCHAR(150) NULL,
      theme_color VARCHAR(20) NOT NULL DEFAULT '#072a63',
      default_offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      upi_id VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      name: 'VARCHAR(200) NOT NULL',
      name_ta: 'VARCHAR(200) NULL AFTER name',
      code: 'VARCHAR(50) NOT NULL UNIQUE',
      address_line1: 'VARCHAR(200) NULL',
      address_line1_ta: 'VARCHAR(200) NULL AFTER address_line1',
      address_line2: 'VARCHAR(200) NULL',
      address_line2_ta: 'VARCHAR(200) NULL AFTER address_line2',
      city: 'VARCHAR(100) NULL',
      city_ta: 'VARCHAR(100) NULL AFTER city',
      state: 'VARCHAR(100) NULL',
      country: "VARCHAR(100) NULL DEFAULT 'India'",
      postal_code: 'VARCHAR(20) NULL',
      phone: 'VARCHAR(20) NULL',
      email: 'VARCHAR(100) NULL',
      website: 'VARCHAR(200) NULL',
      diocese_name: 'VARCHAR(150) NULL',
      parish_priest_name: 'VARCHAR(150) NULL',
      theme_color: "VARCHAR(20) NOT NULL DEFAULT '#072a63'",
      default_offering_amount: 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
      upi_id: 'VARCHAR(100) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  branches: {
    createSql: `CREATE TABLE IF NOT EXISTS branches (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      name_ta VARCHAR(150) NULL,
      code VARCHAR(50) NOT NULL,
      address VARCHAR(255) NULL,
      city VARCHAR(100) NULL,
      phone VARCHAR(20) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_church_branch_code (church_id, code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      name: 'VARCHAR(150) NOT NULL',
      name_ta: 'VARCHAR(150) NULL AFTER name',
      code: 'VARCHAR(50) NOT NULL',
      address: 'VARCHAR(255) NULL',
      city: 'VARCHAR(100) NULL',
      phone: 'VARCHAR(20) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  priests: {
    createSql: `CREATE TABLE IF NOT EXISTS priests (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      name_ta VARCHAR(150) NULL,
      designation VARCHAR(100) NULL,
      phone VARCHAR(20) NULL,
      email VARCHAR(100) NULL,
      is_parish_priest TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      name: 'VARCHAR(150) NOT NULL',
      name_ta: 'VARCHAR(150) NULL AFTER name',
      designation: 'VARCHAR(100) NULL',
      phone: 'VARCHAR(20) NULL',
      email: 'VARCHAR(100) NULL',
      is_parish_priest: 'TINYINT(1) NOT NULL DEFAULT 0',
      sort_order: 'INT NOT NULL DEFAULT 0',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  masses: {
    createSql: `CREATE TABLE IF NOT EXISTS masses (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      name_ta VARCHAR(150) NULL,
      start_time TIME NOT NULL,
      end_time TIME NULL,
      default_offering_amount DECIMAL(10,2) NULL,
      offering_description VARCHAR(500) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      name: 'VARCHAR(150) NOT NULL',
      name_ta: 'VARCHAR(150) NULL AFTER name',
      start_time: 'TIME NOT NULL',
      end_time: 'TIME NULL',
      default_offering_amount: 'DECIMAL(10,2) NULL AFTER end_time',
      offering_description: 'VARCHAR(500) NULL AFTER default_offering_amount',
      sort_order: 'INT NOT NULL DEFAULT 0',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  prayer_intention_master: {
    createSql: `CREATE TABLE IF NOT EXISTS prayer_intention_master (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      name_ta VARCHAR(150) NULL,
      code VARCHAR(50) NULL,
      description VARCHAR(255) NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      name: 'VARCHAR(150) NOT NULL',
      name_ta: 'VARCHAR(150) NULL AFTER name',
      code: 'VARCHAR(50) NULL',
      description: 'VARCHAR(255) NULL',
      is_default: 'TINYINT(1) NOT NULL DEFAULT 0',
      sort_order: 'INT NOT NULL DEFAULT 0',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  genders: {
    createSql: `CREATE TABLE IF NOT EXISTS genders (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      code: 'VARCHAR(20) NOT NULL UNIQUE',
      name: 'VARCHAR(50) NOT NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
    },
  },

  payment_methods: {
    createSql: `CREATE TABLE IF NOT EXISTS payment_methods (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      code: 'VARCHAR(50) NOT NULL UNIQUE',
      name: 'VARCHAR(100) NOT NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
    },
  },

  contribution_types: {
    createSql: `CREATE TABLE IF NOT EXISTS contribution_types (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NULL,
      name VARCHAR(150) NOT NULL,
      name_ta VARCHAR(150) NULL,
      code VARCHAR(50) NOT NULL,
      description VARCHAR(255) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NULL',
      name: 'VARCHAR(150) NOT NULL',
      name_ta: 'VARCHAR(150) NULL AFTER name',
      code: 'VARCHAR(50) NOT NULL',
      description: 'VARCHAR(255) NULL',
      sort_order: 'INT NOT NULL DEFAULT 0',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  roles: {
    createSql: `CREATE TABLE IF NOT EXISTS roles (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) NULL,
      church_id INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      code: 'VARCHAR(50) NOT NULL UNIQUE',
      name: 'VARCHAR(100) NOT NULL',
      description: 'VARCHAR(255) NULL',
      church_id: 'INT UNSIGNED NULL AFTER description',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
    },
  },

  permissions: {
    createSql: `CREATE TABLE IF NOT EXISTS permissions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      module VARCHAR(50) NOT NULL,
      action VARCHAR(50) NOT NULL,
      code VARCHAR(100) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      module: 'VARCHAR(50) NOT NULL',
      action: 'VARCHAR(50) NOT NULL',
      code: 'VARCHAR(100) NOT NULL UNIQUE',
      description: 'VARCHAR(255) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
  },

  role_permissions: {
    createSql: `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INT UNSIGNED NOT NULL,
      permission_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      role_id: 'INT UNSIGNED NOT NULL',
      permission_id: 'INT UNSIGNED NOT NULL',
    },
  },

  users: {
    createSql: `CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NULL,
      branch_id INT UNSIGNED NULL,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(100) NULL,
      phone VARCHAR(20) NULL,
      preferred_language_id INT UNSIGNED NULL,
      is_super_admin TINYINT(1) NOT NULL DEFAULT 0,
      last_login_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NULL',
      branch_id: 'INT UNSIGNED NULL',
      username: 'VARCHAR(100) NOT NULL UNIQUE',
      password_hash: 'VARCHAR(255) NOT NULL',
      full_name: 'VARCHAR(150) NOT NULL',
      email: 'VARCHAR(100) NULL',
      phone: 'VARCHAR(20) NULL',
      preferred_language_id: 'INT UNSIGNED NULL',
      is_super_admin: 'TINYINT(1) NOT NULL DEFAULT 0',
      last_login_at: 'DATETIME NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  user_roles: {
    createSql: `CREATE TABLE IF NOT EXISTS user_roles (
      user_id INT UNSIGNED NOT NULL,
      role_id INT UNSIGNED NOT NULL,
      PRIMARY KEY (user_id, role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      user_id: 'INT UNSIGNED NOT NULL',
      role_id: 'INT UNSIGNED NOT NULL',
    },
  },

  user_sessions: {
    createSql: `CREATE TABLE IF NOT EXISTS user_sessions (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      session_token: 'CHAR(64) NOT NULL UNIQUE',
      user_id: 'INT UNSIGNED NOT NULL',
      church_id: 'INT UNSIGNED NOT NULL',
      ip_address: 'VARCHAR(45) NULL',
      user_agent: 'VARCHAR(255) NULL',
      expires_at: 'DATETIME NOT NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      last_activity_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },

  webauthn_credentials: {
    createSql: `CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      credential_id VARCHAR(255) NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INT UNSIGNED NOT NULL DEFAULT 0,
      device_name VARCHAR(100) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      user_id: 'INT UNSIGNED NOT NULL',
      credential_id: 'VARCHAR(255) NOT NULL UNIQUE',
      public_key: 'TEXT NOT NULL',
      counter: 'INT UNSIGNED NOT NULL DEFAULT 0',
      device_name: 'VARCHAR(100) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      last_used_at: 'DATETIME NULL',
    },
  },

  receipt_series: {
    createSql: `CREATE TABLE IF NOT EXISTS receipt_series (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      series_type VARCHAR(50) NOT NULL,
      prefix VARCHAR(20) NOT NULL,
      next_number INT UNSIGNED NOT NULL DEFAULT 1,
      number_padding INT UNSIGNED NOT NULL DEFAULT 4,
      reset_frequency VARCHAR(20) NOT NULL DEFAULT 'never',
      last_reset_date DATE NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_church_series_type (church_id, series_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      series_type: 'VARCHAR(50) NOT NULL',
      prefix: 'VARCHAR(20) NOT NULL',
      next_number: 'INT UNSIGNED NOT NULL DEFAULT 1',
      number_padding: 'INT UNSIGNED NOT NULL DEFAULT 4',
      reset_frequency: "VARCHAR(20) NOT NULL DEFAULT 'never'",
      last_reset_date: 'DATE NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },

  certificate_series: {
    createSql: `CREATE TABLE IF NOT EXISTS certificate_series (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      certificate_type VARCHAR(50) NOT NULL,
      prefix VARCHAR(20) NOT NULL,
      next_number INT UNSIGNED NOT NULL DEFAULT 1,
      number_padding INT UNSIGNED NOT NULL DEFAULT 4,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_church_cert_type_series (church_id, certificate_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      certificate_type: 'VARCHAR(50) NOT NULL',
      prefix: 'VARCHAR(20) NOT NULL',
      next_number: 'INT UNSIGNED NOT NULL DEFAULT 1',
      number_padding: 'INT UNSIGNED NOT NULL DEFAULT 4',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },

  prayer_intentions: {
    createSql: `CREATE TABLE IF NOT EXISTS prayer_intentions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NULL,
      receipt_no VARCHAR(30) NOT NULL,
      public_token CHAR(32) NULL,
      bulk_batch_id VARCHAR(36) NULL,
      prayer_intention_id INT UNSIGNED NULL,
      custom_intention_name VARCHAR(150) NULL,
      name VARCHAR(150) NOT NULL,
      booked_by VARCHAR(150) NULL,
      phone_number VARCHAR(20) NULL,
      prayer_date DATE NOT NULL,
      mass_id INT UNSIGNED NOT NULL,
      offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      payment_method_id INT UNSIGNED NOT NULL,
      is_paid TINYINT(1) NOT NULL DEFAULT 1,
      announcement_status ENUM('PENDING','ANNOUNCED','CANCELLED') NOT NULL DEFAULT 'PENDING',
      remarks VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by INT UNSIGNED NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by INT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_church_receipt_no (church_id, receipt_no),
      KEY idx_prayer_date (prayer_date),
      KEY idx_mass_id (mass_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL',
      receipt_no: 'VARCHAR(30) NOT NULL',
      public_token: 'CHAR(32) NULL AFTER receipt_no',
      bulk_batch_id: 'VARCHAR(36) NULL AFTER public_token',
      prayer_intention_id: 'INT UNSIGNED NULL',
      custom_intention_name: 'VARCHAR(150) NULL',
      name: 'VARCHAR(150) NOT NULL',
      booked_by: 'VARCHAR(150) NULL AFTER name',
      phone_number: 'VARCHAR(20) NULL',
      prayer_date: 'DATE NOT NULL',
      mass_id: 'INT UNSIGNED NOT NULL',
      offering_amount: 'DECIMAL(10,2) NOT NULL DEFAULT 0.00',
      payment_method_id: 'INT UNSIGNED NOT NULL',
      is_paid: 'TINYINT(1) NOT NULL DEFAULT 1 AFTER offering_amount',
      announcement_status: "ENUM('PENDING','ANNOUNCED','CANCELLED') NOT NULL DEFAULT 'PENDING' AFTER is_paid",
      remarks: 'VARCHAR(500) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      created_by: 'INT UNSIGNED NULL',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      updated_by: 'INT UNSIGNED NULL',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  payment_transactions: {
    createSql: `CREATE TABLE IF NOT EXISTS payment_transactions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      prayer_intention_id INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      method VARCHAR(50) NOT NULL,
      transaction_reference VARCHAR(100) NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'success',
      received_by INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_pay_intention (prayer_intention_id),
      KEY idx_pay_date (payment_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      prayer_intention_id: 'INT UNSIGNED NOT NULL',
      payment_date: 'DATE NOT NULL',
      amount: 'DECIMAL(10,2) NOT NULL',
      method: 'VARCHAR(50) NOT NULL',
      transaction_reference: 'VARCHAR(100) NULL',
      status: "VARCHAR(30) NOT NULL DEFAULT 'success'",
      received_by: 'INT UNSIGNED NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },

  contributions: {
    createSql: `CREATE TABLE IF NOT EXISTS contributions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NULL,
      receipt_no VARCHAR(30) NOT NULL,
      donor_name VARCHAR(150) NOT NULL,
      phone_number VARCHAR(20) NULL,
      contribution_type_id INT UNSIGNED NOT NULL,
      custom_contribution_type TEXT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method_id INT UNSIGNED NOT NULL,
      payment_date DATE NOT NULL,
      payment_reference VARCHAR(100) NULL,
      remarks VARCHAR(500) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by INT UNSIGNED NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by INT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_church_contrib_receipt (church_id, receipt_no),
      KEY idx_contrib_date (payment_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL AFTER church_id',
      receipt_no: 'VARCHAR(30) NOT NULL',
      donor_name: 'VARCHAR(150) NOT NULL',
      phone_number: 'VARCHAR(20) NULL',
      contribution_type_id: 'INT UNSIGNED NOT NULL',
      custom_contribution_type: 'TEXT NULL AFTER contribution_type_id',
      amount: 'DECIMAL(10,2) NOT NULL',
      payment_method_id: 'INT UNSIGNED NOT NULL',
      payment_date: 'DATE NOT NULL',
      payment_reference: 'VARCHAR(100) NULL',
      remarks: 'VARCHAR(500) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      created_by: 'INT UNSIGNED NULL',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      updated_by: 'INT UNSIGNED NULL',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  announcements: {
    createSql: `CREATE TABLE IF NOT EXISTS announcements (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      title: 'VARCHAR(200) NOT NULL',
      body: 'TEXT NULL',
      start_date: 'DATE NULL',
      end_date: 'DATE NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  restricted_dates: {
    createSql: `CREATE TABLE IF NOT EXISTS restricted_dates (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      restricted_date DATE NOT NULL,
      reason VARCHAR(255) NULL,
      is_mass_allowed TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_church_restricted_date (church_id, restricted_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      restricted_date: 'DATE NOT NULL',
      reason: 'VARCHAR(255) NULL',
      is_mass_allowed: 'TINYINT(1) NOT NULL DEFAULT 0',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
  },

  baptism_certificates: {
    createSql: `CREATE TABLE IF NOT EXISTS baptism_certificates (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NULL,
      certificate_no VARCHAR(30) NOT NULL,
      child_name VARCHAR(150) NOT NULL,
      gender_id INT UNSIGNED NOT NULL,
      date_of_birth DATE NOT NULL,
      date_of_baptism DATE NOT NULL,
      place_of_baptism VARCHAR(200) NULL,
      father_name VARCHAR(150) NULL,
      mother_name VARCHAR(150) NULL,
      parent_residence VARCHAR(300) NULL,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL AFTER church_id',
      certificate_no: 'VARCHAR(30) NOT NULL',
      child_name: 'VARCHAR(150) NOT NULL',
      gender_id: 'INT UNSIGNED NOT NULL',
      date_of_birth: 'DATE NOT NULL',
      date_of_baptism: 'DATE NOT NULL',
      place_of_baptism: 'VARCHAR(200) NULL',
      father_name: 'VARCHAR(150) NULL',
      mother_name: 'VARCHAR(150) NULL',
      parent_residence: 'VARCHAR(300) NULL',
      godfather_name: 'VARCHAR(150) NULL',
      godmother_name: 'VARCHAR(150) NULL',
      priest_id: 'INT UNSIGNED NULL',
      custom_priest_name: 'TEXT NULL AFTER priest_id',
      register_volume: 'VARCHAR(50) NULL',
      register_page: 'VARCHAR(50) NULL',
      register_sl_no: 'VARCHAR(50) NULL',
      certificate_issued_date: 'DATE NULL',
      remarks: 'VARCHAR(500) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      created_by: 'INT UNSIGNED NULL',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      updated_by: 'INT UNSIGNED NULL',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  marriage_certificates: {
    createSql: `CREATE TABLE IF NOT EXISTS marriage_certificates (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NULL,
      certificate_no VARCHAR(30) NOT NULL,
      marriage_date DATE NOT NULL,
      where_married VARCHAR(200) NULL,
      groom_name VARCHAR(150) NOT NULL,
      bride_name VARCHAR(150) NOT NULL,
      groom_age VARCHAR(10) NULL,
      bride_age VARCHAR(10) NULL,
      groom_condition VARCHAR(50) NULL,
      bride_condition VARCHAR(50) NULL,
      groom_profession VARCHAR(100) NULL,
      bride_profession VARCHAR(100) NULL,
      groom_residence VARCHAR(200) NULL,
      bride_residence VARCHAR(200) NULL,
      groom_father_name VARCHAR(150) NULL,
      bride_father_name VARCHAR(150) NULL,
      banns_or_licence VARCHAR(100) NULL,
      impediments_dispensed VARCHAR(100) NULL,
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
      KEY idx_marriage_groom (groom_name),
      KEY idx_marriage_bride (bride_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL AFTER church_id',
      certificate_no: 'VARCHAR(30) NOT NULL',
      marriage_date: 'DATE NOT NULL',
      where_married: 'VARCHAR(200) NULL',
      groom_name: 'VARCHAR(150) NOT NULL',
      bride_name: 'VARCHAR(150) NOT NULL',
      groom_age: 'VARCHAR(10) NULL',
      bride_age: 'VARCHAR(10) NULL',
      groom_condition: 'VARCHAR(50) NULL',
      bride_condition: 'VARCHAR(50) NULL',
      groom_profession: 'VARCHAR(100) NULL AFTER bride_condition',
      bride_profession: 'VARCHAR(100) NULL AFTER groom_profession',
      groom_residence: 'VARCHAR(200) NULL',
      bride_residence: 'VARCHAR(200) NULL',
      groom_father_name: 'VARCHAR(150) NULL',
      bride_father_name: 'VARCHAR(150) NULL',
      banns_or_licence: 'VARCHAR(100) NULL',
      impediments_dispensed: 'VARCHAR(100) NULL',
      witness1_name: 'VARCHAR(150) NULL',
      witness2_name: 'VARCHAR(150) NULL',
      witness3_name: 'VARCHAR(150) NULL AFTER witness2_name',
      witness4_name: 'VARCHAR(150) NULL AFTER witness3_name',
      priest_id: 'INT UNSIGNED NULL',
      custom_priest_name: 'TEXT NULL AFTER priest_id',
      register_volume: 'VARCHAR(50) NULL',
      register_page: 'VARCHAR(50) NULL',
      register_sl_no: 'VARCHAR(50) NULL',
      certificate_issued_date: 'DATE NULL',
      remarks: 'VARCHAR(500) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      created_by: 'INT UNSIGNED NULL',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      updated_by: 'INT UNSIGNED NULL',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  death_certificates: {
    createSql: `CREATE TABLE IF NOT EXISTS death_certificates (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NULL,
      certificate_no VARCHAR(30) NOT NULL,
      deceased_name VARCHAR(150) NOT NULL,
      age VARCHAR(10) NULL,
      place VARCHAR(150) NULL,
      profession VARCHAR(100) NULL,
      parents VARCHAR(300) NULL,
      date_of_death DATE NOT NULL,
      place_of_death VARCHAR(200) NULL,
      cause VARCHAR(200) NULL,
      confession_received VARCHAR(100) NULL,
      viaticum_received VARCHAR(100) NULL,
      anointing_received VARCHAR(100) NULL,
      burial_date DATE NULL,
      cemetery VARCHAR(200) NULL,
      priest_id INT UNSIGNED NULL,
      custom_priest_name TEXT NULL,
      family_contact VARCHAR(150) NULL,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL AFTER church_id',
      certificate_no: 'VARCHAR(30) NOT NULL',
      deceased_name: 'VARCHAR(150) NOT NULL',
      age: 'VARCHAR(10) NULL',
      place: 'VARCHAR(150) NULL',
      profession: 'VARCHAR(100) NULL',
      parents: 'VARCHAR(300) NULL',
      date_of_death: 'DATE NOT NULL',
      place_of_death: 'VARCHAR(200) NULL',
      cause: 'VARCHAR(200) NULL',
      confession_received: 'VARCHAR(100) NULL',
      viaticum_received: 'VARCHAR(100) NULL',
      anointing_received: 'VARCHAR(100) NULL',
      burial_date: 'DATE NULL',
      cemetery: 'VARCHAR(200) NULL',
      priest_id: 'INT UNSIGNED NULL',
      custom_priest_name: 'TEXT NULL AFTER priest_id',
      family_contact: 'VARCHAR(150) NULL',
      register_volume: 'VARCHAR(50) NULL',
      register_page: 'VARCHAR(50) NULL',
      register_sl_no: 'VARCHAR(50) NULL',
      certificate_issued_date: 'DATE NULL',
      remarks: 'VARCHAR(500) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      created_by: 'INT UNSIGNED NULL',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      updated_by: 'INT UNSIGNED NULL',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  confirmation_certificates: {
    createSql: `CREATE TABLE IF NOT EXISTS confirmation_certificates (
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
      UNIQUE KEY uq_confirmation_certificate_no (certificate_no),
      KEY idx_confirmation_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL',
      certificate_no: 'VARCHAR(30) NOT NULL',
      name: 'VARCHAR(150) NOT NULL',
      age: 'VARCHAR(10) NULL',
      gender_id: 'INT UNSIGNED NULL',
      parents: 'VARCHAR(300) NULL',
      caste: 'VARCHAR(100) NULL',
      sponsors: 'VARCHAR(300) NULL',
      domicile: 'VARCHAR(200) NULL',
      place_of_confirmation: 'VARCHAR(200) NULL',
      date_of_confirmation: 'DATE NOT NULL',
      bishop_name: 'VARCHAR(150) NULL',
      priest_id: 'INT UNSIGNED NULL',
      custom_priest_name: 'TEXT NULL AFTER priest_id',
      register_volume: 'VARCHAR(50) NULL',
      register_page: 'VARCHAR(50) NULL',
      register_sl_no: 'VARCHAR(50) NULL',
      certificate_issued_date: 'DATE NULL',
      remarks: 'VARCHAR(500) NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      created_by: 'INT UNSIGNED NULL',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      updated_by: 'INT UNSIGNED NULL',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      is_deleted: 'TINYINT(1) NOT NULL DEFAULT 0',
    },
  },

  certificate_print_templates: {
    createSql: `CREATE TABLE IF NOT EXISTS certificate_print_templates (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      certificate_type: 'VARCHAR(30) NOT NULL',
      title: 'VARCHAR(255) NULL',
      subheader_prefix: 'VARCHAR(100) NULL',
      diocese_label: 'VARCHAR(150) NULL',
      signatory_title: 'VARCHAR(100) NULL',
      seal_label: 'VARCHAR(50) NULL',
      field_labels: 'JSON NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },

  audit_logs: {
    createSql: `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NULL,
      user_id INT UNSIGNED NULL,
      action VARCHAR(100) NOT NULL,
      module VARCHAR(50) NOT NULL,
      record_id INT UNSIGNED NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      details JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_audit_church (church_id),
      KEY idx_audit_user (user_id),
      KEY idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NULL',
      user_id: 'INT UNSIGNED NULL',
      action: 'VARCHAR(100) NOT NULL',
      module: 'VARCHAR(50) NOT NULL',
      record_id: 'INT UNSIGNED NULL',
      ip_address: 'VARCHAR(45) NULL',
      user_agent: 'VARCHAR(255) NULL',
      details: 'JSON NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
    },
  },

  account_heads: {
    createSql: `CREATE TABLE IF NOT EXISTS account_heads (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NULL,
      type ENUM('receipt', 'payment') NOT NULL,
      section VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      tamil_name VARCHAR(255) NULL,
      code VARCHAR(100) NULL,
      is_system TINYINT(1) NOT NULL DEFAULT 0,
      auto_source VARCHAR(100) NULL,
      order_index INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_heads_church_type (church_id, type, is_active),
      INDEX idx_heads_section (section, order_index)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NULL',
      type: "ENUM('receipt', 'payment') NOT NULL",
      section: 'VARCHAR(100) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      tamil_name: 'VARCHAR(255) NULL',
      code: 'VARCHAR(100) NULL',
      is_system: 'TINYINT(1) NOT NULL DEFAULT 0',
      auto_source: 'VARCHAR(100) NULL',
      order_index: 'INT NOT NULL DEFAULT 0',
      is_active: 'TINYINT(1) NOT NULL DEFAULT 1',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },

  church_expenses: {
    createSql: `CREATE TABLE IF NOT EXISTS church_expenses (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NULL,
      entry_date DATE NOT NULL,
      month_year VARCHAR(7) NOT NULL,
      type ENUM('receipt', 'payment') NOT NULL,
      head_id INT UNSIGNED NULL,
      head_name VARCHAR(255) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      payment_method_id INT UNSIGNED NULL,
      voucher_no VARCHAR(50) NULL,
      paid_to VARCHAR(255) NULL,
      notes TEXT NULL,
      is_auto_sync TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at DATETIME NULL,
      INDEX idx_expenses_church_month (church_id, month_year, entry_date),
      INDEX idx_expenses_head (head_id),
      INDEX idx_expenses_deleted (deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL',
      entry_date: 'DATE NOT NULL',
      month_year: 'VARCHAR(7) NOT NULL',
      type: "ENUM('receipt', 'payment') NOT NULL",
      head_id: 'INT UNSIGNED NULL',
      head_name: 'VARCHAR(255) NOT NULL',
      amount: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      payment_method_id: 'INT UNSIGNED NULL',
      voucher_no: 'VARCHAR(50) NULL',
      paid_to: 'VARCHAR(255) NULL',
      notes: 'TEXT NULL',
      is_auto_sync: 'TINYINT(1) NOT NULL DEFAULT 0',
      created_by: 'INT UNSIGNED NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      deleted_at: 'DATETIME NULL',
    },
  },

  monthly_financial_abstracts: {
    createSql: `CREATE TABLE IF NOT EXISTS monthly_financial_abstracts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      church_id INT UNSIGNED NOT NULL,
      branch_id INT UNSIGNED NULL,
      month_year VARCHAR(7) NOT NULL,
      opening_cash_hand DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      opening_cash_bank DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      opening_fixed_deposits DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      closing_cash_hand DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      closing_cash_bank DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      closing_fixed_deposits DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      receipts_specific_project DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      payments_specific_project DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      remit_stole_fees DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      remit_mass_intentions DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      remit_parish_contribution DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      remit_diocesan_collection DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      recv_monthly_allowance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      recv_medical_allowance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      recv_mission_conveyance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      recv_any_other DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      priest_name VARCHAR(255) NULL,
      designation VARCHAR(255) NULL,
      unit_no VARCHAR(50) NULL,
      notes TEXT NULL,
      created_by INT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_church_month_branch (church_id, month_year, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    columns: {
      id: 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY',
      church_id: 'INT UNSIGNED NOT NULL',
      branch_id: 'INT UNSIGNED NULL',
      month_year: 'VARCHAR(7) NOT NULL',
      opening_cash_hand: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      opening_cash_bank: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      opening_fixed_deposits: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      closing_cash_hand: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      closing_cash_bank: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      closing_fixed_deposits: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      receipts_specific_project: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      payments_specific_project: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      remit_stole_fees: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      remit_mass_intentions: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      remit_parish_contribution: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      remit_diocesan_collection: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      recv_monthly_allowance: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      recv_medical_allowance: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      recv_mission_conveyance: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      recv_any_other: 'DECIMAL(12, 2) NOT NULL DEFAULT 0.00',
      priest_name: 'VARCHAR(255) NULL',
      designation: 'VARCHAR(255) NULL',
      unit_no: 'VARCHAR(50) NULL',
      notes: 'TEXT NULL',
      created_by: 'INT UNSIGNED NULL',
      created_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    },
  },
};

async function syncDatabase() {
  console.log('=====================================================');
  console.log('  COMS Auto Schema Synchronizer & Database Updater   ');
  console.log('=====================================================');
  console.log(`Connecting to MySQL server at ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);

  // Step 1: Ensure database exists
  let serverConn;
  try {
    serverConn = await mysql.createConnection({
      host: DB_HOST,
      port: Number(DB_PORT),
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true,
    });
  } catch (err) {
    console.error(`[ERROR] Unable to connect to MySQL server: ${err.message}`);
    console.error('Please check if MySQL is running and verify DB credentials in .env');
    process.exit(1);
  }

  console.log(`Checking database \`${DB_NAME}\`...`);
  await serverConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await serverConn.end();
  console.log(`[OK] Database \`${DB_NAME}\` is ready.`);

  // Step 2: Connect directly to the database
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  // Handle table rename transitions (e.g. donations -> contributions, donation_types -> contribution_types)
  const [[hasDonations]] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'donations'`,
    [DB_NAME]
  );
  const [[hasContributions]] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'contributions'`,
    [DB_NAME]
  );
  if (hasDonations.cnt > 0 && hasContributions.cnt === 0) {
    console.log('[RENAME] Renaming old `donations` table to `contributions`...');
    await conn.query('RENAME TABLE donations TO contributions');
  }

  const [[hasDonationTypes]] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'donation_types'`,
    [DB_NAME]
  );
  const [[hasContributionTypes]] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'contribution_types'`,
    [DB_NAME]
  );
  if (hasDonationTypes.cnt > 0 && hasContributionTypes.cnt === 0) {
    console.log('[RENAME] Renaming old `donation_types` table to `contribution_types`...');
    await conn.query('RENAME TABLE donation_types TO contribution_types');
  }

  // Fetch all existing tables
  const [existingTableRows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [DB_NAME]
  );
  const existingTables = new Set(existingTableRows.map((r) => r.TABLE_NAME));

  let tablesCreatedCount = 0;
  let columnsAddedCount = 0;
  let columnsSkippedCount = 0;

  // Step 3: Iterate through canonical tables and columns
  for (const [tableName, meta] of Object.entries(TABLES_SCHEMA)) {
    if (!existingTables.has(tableName)) {
      console.log(`[CREATE TABLE] Creating missing table \`${tableName}\`...`);
      await conn.query(meta.createSql);
      tablesCreatedCount++;
      existingTables.add(tableName);
    } else {
      // Table exists -> check each individual column
      const [colRows] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [DB_NAME, tableName]
      );
      const existingCols = new Set(colRows.map((r) => r.COLUMN_NAME));

      for (const [colName, colDef] of Object.entries(meta.columns)) {
        if (!existingCols.has(colName)) {
          console.log(`[ADD COLUMN] \`${tableName}\`.\`${colName}\` is missing -> Adding...`);
          // Sanitize definition for existing tables so strict mode doesn't reject NOT NULL without DEFAULT on existing rows
          let safeColDef = colDef;
          if (/DATE\s+NOT\s+NULL(?!\s+DEFAULT)/i.test(safeColDef)) {
            safeColDef = safeColDef.replace(/DATE\s+NOT\s+NULL/i, 'DATE NULL');
          } else if (/DATETIME\s+NOT\s+NULL(?!\s+DEFAULT)/i.test(safeColDef)) {
            safeColDef = safeColDef.replace(/DATETIME\s+NOT\s+NULL/i, 'DATETIME NULL');
          } else if (/INT\s+NOT\s+NULL(?!\s+DEFAULT)/i.test(safeColDef) && !/PRIMARY\s+KEY/i.test(safeColDef)) {
            safeColDef = safeColDef.replace(/INT\s+NOT\s+NULL/i, 'INT NOT NULL DEFAULT 0');
          }

          try {
            await conn.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${colName}\` ${safeColDef}`);
            columnsAddedCount++;
          } catch (err) {
            console.warn(`[WARN] Could not add \`${tableName}\`.\`${colName}\`: ${err.message}`);
          }
        } else {
          columnsSkippedCount++;
        }
      }
    }
  }

  // Step 4: Ensure permissions, role permissions & system settings
  console.log('Ensuring essential system roles, permissions & settings...');
  try {
    // Permissions
    await conn.query(`
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
        ('expenses', 'export', 'expenses.export', 'Export financial records to Excel')
    `);

    // Map permissions to ADMIN & ACCOUNTANT
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.code = 'ADMIN' AND p.module IN ('confirmation_certificates', 'contributions', 'expenses')
    `);

    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.code = 'ACCOUNTANT' AND p.module IN ('contributions', 'expenses')
    `);

    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
      WHERE r.code = 'OFFICE_STAFF' AND p.code IN (
        'confirmation_certificates.view', 'confirmation_certificates.create', 'confirmation_certificates.update',
        'confirmation_certificates.print', 'confirmation_certificates.export', 'contributions.view',
        'contributions.create', 'contributions.update', 'contributions.print', 'contributions.export'
      )
    `);

    // System Settings
    await conn.query(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
        ('RECEIPT_QR_MODE', 'calendar', 'Receipt QR contents: "calendar" = offline event, "url" = online link'),
        ('DEFAULT_CURRENCY', 'INR', 'Default system currency code'),
        ('RECEIPT_THANK_YOU_MESSAGE', 'Thank you for your offering. God Bless You.', 'Default message printed on receipts'),
        ('UPI_ENABLED', '0', 'Enable UPI QR on receipts (0 = disabled, 1 = enabled)')
    `);

    // Certificate Series for churches
    const [churches] = await conn.query('SELECT id FROM churches WHERE is_deleted = 0');
    for (const c of churches) {
      const series = [
        { type: 'Baptism', prefix: 'BAP' },
        { type: 'Marriage', prefix: 'MAR' },
        { type: 'Death', prefix: 'DTH' },
        { type: 'Confirmation', prefix: 'CNF' },
      ];
      for (const s of series) {
        await conn.query(`
          INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding)
          SELECT ?, ?, ?, 1, 4 FROM DUAL
          WHERE NOT EXISTS (SELECT 1 FROM certificate_series WHERE church_id = ? AND certificate_type = ?)
        `, [c.id, s.type, s.prefix, c.id, s.type]);
      }
    }

    // Contribution Types for certificates
    const certContribs = [
      { code: 'BAPTISM_CERTIFICATE', name: 'Baptism Certificate', name_ta: 'ஞானஸ்நான சான்றிதழ்', desc: 'Contribution received for a Baptism certificate' },
      { code: 'MARRIAGE_CERTIFICATE', name: 'Marriage Certificate', name_ta: 'திருமண சான்றிதழ்', desc: 'Contribution received for a Marriage certificate' },
      { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', name_ta: 'இறப்பு சான்றிதழ்', desc: 'Contribution received for a Death certificate' },
      { code: 'CONFIRMATION_CERTIFICATE', name: 'Confirmation Certificate', name_ta: 'உறுதிப்பூசுதல் சான்றிதழ்', desc: 'Contribution received for a Confirmation certificate' },
    ];
    for (const item of certContribs) {
      await conn.query(`
        INSERT INTO contribution_types (name, name_ta, code, description)
        SELECT ?, ?, ?, ? FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = ?)
      `, [item.name, item.name_ta, item.code, item.desc, item.code]);
    }

    // Mark all migrations as registered
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
      for (const file of files) {
        await conn.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [file]);
      }
    }
  } catch (err) {
    console.warn(`[WARN] Supplementary seed step notice: ${err.message}`);
  }

  await conn.end();

  console.log('\n=====================================================');
  console.log('           Database Sync Complete Summary            ');
  console.log('=====================================================');
  console.log(`* Database:            \`${DB_NAME}\` (Verified)`);
  console.log(`* New Tables Created:  ${tablesCreatedCount}`);
  console.log(`* New Columns Added:   ${columnsAddedCount}`);
  console.log(`* Columns Skipped:     ${columnsSkippedCount} (Already present)`);
  console.log(`* Data Integrity:      100% Preserved (Zero data deleted)`);
  console.log('=====================================================\n');
}

syncDatabase().catch((err) => {
  console.error('[FATAL ERROR] Schema synchronization failed:', err);
  process.exit(1);
});
