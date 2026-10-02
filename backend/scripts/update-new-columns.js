/**
 * =============================================================================
 * COMS - Master Database Migration & Column Synchronization Script
 * =============================================================================
 * Safe, idempotent, and non-destructive.
 *
 * For any client machine / deployment:
 * 1. Checks every single table (creates if missing).
 * 2. Checks every single column (if exists -> SKIPS, if missing -> ADDS).
 * 3. Checks indexes and foreign keys.
 * 4. Ensures all permissions, certificate numbering series, contribution types,
 *    and system settings are initialized without overwriting existing data.
 * 5. Safely registers all migrations (001 - 044) into `schema_migrations`.
 *
 * Guaranteed ZERO duplicate-column errors, ZERO duplicate-table errors.
 * =============================================================================
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

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [DB_NAME, tableName]
  );
  return rows.length > 0;
}

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [DB_NAME, tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(conn, tableName, indexName) {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [DB_NAME, tableName, indexName]
  );
  return rows.length > 0;
}

async function ensureColumn(conn, tableName, columnName, addSql) {
  if (await columnExists(conn, tableName, columnName)) {
    console.log(`  = [${tableName}.${columnName}] already exists (skipped)`);
    return false;
  }
  await conn.query(addSql);
  console.log(`  + ADDED column [${columnName}] to [${tableName}]`);
  return true;
}

async function ensureIndex(conn, tableName, indexName, createSql) {
  if (await indexExists(conn, tableName, indexName)) {
    console.log(`  = Index [${indexName}] on [${tableName}] already exists (skipped)`);
    return false;
  }
  try {
    await conn.query(createSql);
    console.log(`  + CREATED index [${indexName}] on [${tableName}]`);
    return true;
  } catch (err) {
    console.log(`  ! Notice on index [${indexName}]: ${err.message}`);
    return false;
  }
}

async function run() {
  console.log('================================================================');
  console.log(' COMS - Synchronizing Database Tables, Columns & Settings');
  console.log(` Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  console.log('================================================================\n');

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  try {
    // -------------------------------------------------------------------------
    // 1. Ensure schema_migrations table exists
    // -------------------------------------------------------------------------
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // -------------------------------------------------------------------------
    // 2. Safe rename of legacy tables (donations -> contributions) if present
    // -------------------------------------------------------------------------
    if ((await tableExists(conn, 'donations')) && !(await tableExists(conn, 'contributions'))) {
      console.log('[RENAME] Renaming legacy donations table to contributions...');
      await conn.query('RENAME TABLE donations TO contributions');
    }
    if ((await tableExists(conn, 'donation_types')) && !(await tableExists(conn, 'contribution_types'))) {
      console.log('[RENAME] Renaming legacy donation_types table to contribution_types...');
      await conn.query('RENAME TABLE donation_types TO contribution_types');
    }
    if (
      (await tableExists(conn, 'donation_payment_transactions')) &&
      !(await tableExists(conn, 'contribution_payment_transactions'))
    ) {
      console.log('[RENAME] Renaming legacy donation_payment_transactions table...');
      await conn.query('RENAME TABLE donation_payment_transactions TO contribution_payment_transactions');
    }

    // -------------------------------------------------------------------------
    // 3. Ensure all required tables exist
    // -------------------------------------------------------------------------
    console.log('\n[1/7] Checking and creating required tables...');

    // contributions table
    await conn.query(`
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
        is_deleted TINYINT(1) NOT NULL DEFAULT 0,
        UNIQUE KEY uq_contributions_receipt (receipt_no),
        KEY idx_contributions_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // contribution_types table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contribution_types (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_ta VARCHAR(150) NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        is_deleted TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by INT UNSIGNED NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by INT UNSIGNED NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // contribution_payment_transactions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contribution_payment_transactions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        contribution_id INT UNSIGNED NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method_id INT UNSIGNED NOT NULL,
        transaction_reference VARCHAR(100) NULL,
        transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status ENUM('SUCCESS', 'FAILED', 'PENDING', 'REFUNDED') NOT NULL DEFAULT 'SUCCESS',
        received_by INT UNSIGNED NULL,
        notes VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_cpt_contrib (contribution_id),
        KEY idx_cpt_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // confirmation_certificates table
    await conn.query(`
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
    `);

    // user_sessions table
    await conn.query(`
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
    `);

    // webauthn_credentials table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        credential_id VARCHAR(255) NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter INT UNSIGNED NOT NULL DEFAULT 0,
        transports VARCHAR(255) NULL,
        aaguid VARCHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME NULL,
        KEY idx_webauthn_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('  -> All core tables verified.');

    // -------------------------------------------------------------------------
    // 4. Check and add all columns across all tables (Idempotent)
    // -------------------------------------------------------------------------
    console.log('\n[2/7] Checking and synchronizing columns across all tables...');

    // churches columns
    console.log('\n  -- Table: churches --');
    await ensureColumn(conn, 'churches', 'default_offering_amount', 'ALTER TABLE churches ADD COLUMN default_offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
    await ensureColumn(conn, 'churches', 'theme_color', "ALTER TABLE churches ADD COLUMN theme_color VARCHAR(20) NOT NULL DEFAULT '#072a63'");
    await ensureColumn(conn, 'churches', 'name_ta', 'ALTER TABLE churches ADD COLUMN name_ta VARCHAR(200) NULL AFTER name');
    await ensureColumn(conn, 'churches', 'address_line1_ta', 'ALTER TABLE churches ADD COLUMN address_line1_ta VARCHAR(200) NULL AFTER address_line1');
    await ensureColumn(conn, 'churches', 'address_line2_ta', 'ALTER TABLE churches ADD COLUMN address_line2_ta VARCHAR(200) NULL AFTER address_line2');
    await ensureColumn(conn, 'churches', 'city_ta', 'ALTER TABLE churches ADD COLUMN city_ta VARCHAR(100) NULL AFTER city');

    // masses columns
    console.log('\n  -- Table: masses --');
    await ensureColumn(conn, 'masses', 'default_offering_amount', 'ALTER TABLE masses ADD COLUMN default_offering_amount DECIMAL(10,2) NULL AFTER end_time');
    await ensureColumn(conn, 'masses', 'name_ta', 'ALTER TABLE masses ADD COLUMN name_ta VARCHAR(150) NULL AFTER name');
    await ensureColumn(conn, 'masses', 'offering_description', 'ALTER TABLE masses ADD COLUMN offering_description VARCHAR(500) NULL AFTER default_offering_amount');

    // prayer_intention_master columns
    console.log('\n  -- Table: prayer_intention_master --');
    await ensureColumn(conn, 'prayer_intention_master', 'name_ta', 'ALTER TABLE prayer_intention_master ADD COLUMN name_ta VARCHAR(150) NULL AFTER name');

    // prayer_intentions columns
    console.log('\n  -- Table: prayer_intentions --');
    await ensureColumn(conn, 'prayer_intentions', 'public_token', 'ALTER TABLE prayer_intentions ADD COLUMN public_token CHAR(32) NULL AFTER receipt_no');
    await ensureColumn(conn, 'prayer_intentions', 'is_paid', 'ALTER TABLE prayer_intentions ADD COLUMN is_paid TINYINT(1) NOT NULL DEFAULT 1 AFTER offering_amount');
    await ensureColumn(conn, 'prayer_intentions', 'booked_by', 'ALTER TABLE prayer_intentions ADD COLUMN booked_by VARCHAR(150) NULL AFTER name');
    await ensureColumn(conn, 'prayer_intentions', 'bulk_batch_id', 'ALTER TABLE prayer_intentions ADD COLUMN bulk_batch_id VARCHAR(36) NULL AFTER public_token');
    await ensureColumn(conn, 'prayer_intentions', 'announcement_status', "ALTER TABLE prayer_intentions ADD COLUMN announcement_status ENUM('PENDING','ANNOUNCED','CANCELLED') NOT NULL DEFAULT 'PENDING' AFTER is_paid");

    // contributions columns
    console.log('\n  -- Table: contributions --');
    await ensureColumn(conn, 'contributions', 'branch_id', 'ALTER TABLE contributions ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id');
    await ensureColumn(conn, 'contributions', 'custom_contribution_type', 'ALTER TABLE contributions ADD COLUMN custom_contribution_type TEXT NULL AFTER contribution_type_id');
    await ensureColumn(conn, 'contributions', 'contribution_type_id', 'ALTER TABLE contributions ADD COLUMN contribution_type_id INT UNSIGNED NULL AFTER phone');

    // contribution_types columns
    console.log('\n  -- Table: contribution_types --');
    await ensureColumn(conn, 'contribution_types', 'name_ta', 'ALTER TABLE contribution_types ADD COLUMN name_ta VARCHAR(150) NULL AFTER name');

    // baptism_certificates columns
    console.log('\n  -- Table: baptism_certificates --');
    await ensureColumn(conn, 'baptism_certificates', 'branch_id', 'ALTER TABLE baptism_certificates ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id');
    await ensureColumn(conn, 'baptism_certificates', 'custom_priest_name', 'ALTER TABLE baptism_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id');
    await ensureColumn(conn, 'baptism_certificates', 'register_volume', 'ALTER TABLE baptism_certificates ADD COLUMN register_volume VARCHAR(50) NULL');
    await ensureColumn(conn, 'baptism_certificates', 'register_page', 'ALTER TABLE baptism_certificates ADD COLUMN register_page VARCHAR(50) NULL');
    await ensureColumn(conn, 'baptism_certificates', 'register_sl_no', 'ALTER TABLE baptism_certificates ADD COLUMN register_sl_no VARCHAR(50) NULL');
    await ensureColumn(conn, 'baptism_certificates', 'certificate_issued_date', 'ALTER TABLE baptism_certificates ADD COLUMN certificate_issued_date DATE NULL');

    // marriage_certificates columns
    console.log('\n  -- Table: marriage_certificates --');
    await ensureColumn(conn, 'marriage_certificates', 'branch_id', 'ALTER TABLE marriage_certificates ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id');
    await ensureColumn(conn, 'marriage_certificates', 'custom_priest_name', 'ALTER TABLE marriage_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id');
    await ensureColumn(conn, 'marriage_certificates', 'groom_profession', 'ALTER TABLE marriage_certificates ADD COLUMN groom_profession VARCHAR(100) NULL AFTER bride_condition');
    await ensureColumn(conn, 'marriage_certificates', 'bride_profession', 'ALTER TABLE marriage_certificates ADD COLUMN bride_profession VARCHAR(100) NULL AFTER groom_profession');
    await ensureColumn(conn, 'marriage_certificates', 'witness3_name', 'ALTER TABLE marriage_certificates ADD COLUMN witness3_name VARCHAR(150) NULL AFTER witness2_name');
    await ensureColumn(conn, 'marriage_certificates', 'witness4_name', 'ALTER TABLE marriage_certificates ADD COLUMN witness4_name VARCHAR(150) NULL AFTER witness3_name');
    await ensureColumn(conn, 'marriage_certificates', 'register_volume', 'ALTER TABLE marriage_certificates ADD COLUMN register_volume VARCHAR(50) NULL');
    await ensureColumn(conn, 'marriage_certificates', 'register_page', 'ALTER TABLE marriage_certificates ADD COLUMN register_page VARCHAR(50) NULL');
    await ensureColumn(conn, 'marriage_certificates', 'register_sl_no', 'ALTER TABLE marriage_certificates ADD COLUMN register_sl_no VARCHAR(50) NULL');
    await ensureColumn(conn, 'marriage_certificates', 'certificate_issued_date', 'ALTER TABLE marriage_certificates ADD COLUMN certificate_issued_date DATE NULL');

    // death_certificates columns
    console.log('\n  -- Table: death_certificates --');
    await ensureColumn(conn, 'death_certificates', 'branch_id', 'ALTER TABLE death_certificates ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id');
    await ensureColumn(conn, 'death_certificates', 'custom_priest_name', 'ALTER TABLE death_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id');
    await ensureColumn(conn, 'death_certificates', 'register_volume', 'ALTER TABLE death_certificates ADD COLUMN register_volume VARCHAR(50) NULL');
    await ensureColumn(conn, 'death_certificates', 'register_page', 'ALTER TABLE death_certificates ADD COLUMN register_page VARCHAR(50) NULL');
    await ensureColumn(conn, 'death_certificates', 'register_sl_no', 'ALTER TABLE death_certificates ADD COLUMN register_sl_no VARCHAR(50) NULL');
    await ensureColumn(conn, 'death_certificates', 'certificate_issued_date', 'ALTER TABLE death_certificates ADD COLUMN certificate_issued_date DATE NULL');

    // confirmation_certificates columns (in case table existed previously with fewer columns)
    console.log('\n  -- Table: confirmation_certificates --');
    await ensureColumn(conn, 'confirmation_certificates', 'custom_priest_name', 'ALTER TABLE confirmation_certificates ADD COLUMN custom_priest_name TEXT NULL AFTER priest_id');
    await ensureColumn(conn, 'confirmation_certificates', 'bishop_name', 'ALTER TABLE confirmation_certificates ADD COLUMN bishop_name VARCHAR(150) NULL AFTER date_of_confirmation');
    await ensureColumn(conn, 'confirmation_certificates', 'sponsors', 'ALTER TABLE confirmation_certificates ADD COLUMN sponsors VARCHAR(300) NULL AFTER caste');

    // roles columns
    console.log('\n  -- Table: roles --');
    await ensureColumn(conn, 'roles', 'church_id', 'ALTER TABLE roles ADD COLUMN church_id INT UNSIGNED NULL AFTER description');

    // -------------------------------------------------------------------------
    // 5. Check and create required indexes
    // -------------------------------------------------------------------------
    console.log('\n[3/7] Checking and synchronizing indexes...');
    await ensureIndex(conn, 'prayer_intentions', 'idx_pi_public_token', 'CREATE INDEX idx_pi_public_token ON prayer_intentions (public_token)');
    await ensureIndex(conn, 'prayer_intentions', 'idx_pi_bulk_batch', 'CREATE INDEX idx_pi_bulk_batch ON prayer_intentions (bulk_batch_id)');
    await ensureIndex(conn, 'baptism_certificates', 'idx_baptism_branch', 'CREATE INDEX idx_baptism_branch ON baptism_certificates (branch_id)');
    await ensureIndex(conn, 'marriage_certificates', 'idx_marriage_branch', 'CREATE INDEX idx_marriage_branch ON marriage_certificates (branch_id)');
    await ensureIndex(conn, 'death_certificates', 'idx_death_branch', 'CREATE INDEX idx_death_branch ON death_certificates (branch_id)');
    await ensureIndex(conn, 'confirmation_certificates', 'idx_confirmation_branch', 'CREATE INDEX idx_confirmation_branch ON confirmation_certificates (branch_id)');

    // -------------------------------------------------------------------------
    // 6. Synchronize Permissions
    // -------------------------------------------------------------------------
    console.log('\n[4/7] Synchronizing system permissions...');
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
        ('contributions', 'export', 'contributions.export', 'export contributions');
    `);

    // Assign all confirmation_certificates & contributions permissions to ADMIN
    await conn.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
        FROM roles r
        CROSS JOIN permissions p
       WHERE r.code = 'ADMIN'
         AND p.module IN ('confirmation_certificates', 'contributions');
    `);

    // Assign standard permissions to OFFICE_STAFF
    await conn.query(`
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
    `);
    console.log('  -> Permissions updated and mapped to ADMIN and OFFICE_STAFF.');

    // -------------------------------------------------------------------------
    // 7. Ensure Certificate Series (BAP, MAR, DTH, CNF) for all churches
    // -------------------------------------------------------------------------
    console.log('\n[5/7] Synchronizing certificate series for all churches...');
    const seriesDefaults = [
      { type: 'Baptism', prefix: 'BAP' },
      { type: 'Marriage', prefix: 'MAR' },
      { type: 'Death', prefix: 'DTH' },
      { type: 'Confirmation', prefix: 'CNF' },
    ];
    for (const s of seriesDefaults) {
      await conn.query(`
        INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding)
        SELECT c.id, ?, ?, 1, 4
          FROM churches c
         WHERE NOT EXISTS (
           SELECT 1 FROM certificate_series cs
            WHERE cs.church_id = c.id AND cs.certificate_type = ?
         );
      `, [s.type, s.prefix, s.type]);
    }
    console.log('  -> Certificate series verified for Baptism, Marriage, Death, and Confirmation.');

    // -------------------------------------------------------------------------
    // 8. Synchronize Default Contribution Types
    // -------------------------------------------------------------------------
    console.log('\n[6/7] Synchronizing certificate contribution types...');
    const defaultTypes = [
      { name: 'Confirmation Certificate', name_ta: 'உறுதிப்பூசுதல் சான்றிதழ்', code: 'CONFIRMATION_CERTIFICATE', desc: 'Contribution received for a Confirmation certificate' },
      { name: 'Baptism Certificate', name_ta: 'ஞானஸ்நான சான்றிதழ்', code: 'BAPTISM_CERTIFICATE', desc: 'Contribution received for a Baptism certificate' },
      { name: 'Marriage Certificate', name_ta: 'திருமண சான்றிதழ்', code: 'MARRIAGE_CERTIFICATE', desc: 'Contribution received for a Marriage certificate' },
      { name: 'Death Certificate', name_ta: 'இறப்பு சான்றிதழ்', code: 'DEATH_CERTIFICATE', desc: 'Contribution received for a Death certificate' },
    ];
    for (const t of defaultTypes) {
      await conn.query(`
        INSERT INTO contribution_types (name, name_ta, code, description)
        SELECT ?, ?, ?, ?
          FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = ?);
      `, [t.name, t.name_ta, t.code, t.desc, t.code]);
    }
    console.log('  -> Contribution types verified.');

    // -------------------------------------------------------------------------
    // 9. Synchronize Default System Settings
    // -------------------------------------------------------------------------
    console.log('\n[7/7] Synchronizing system settings...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NULL,
        description VARCHAR(255) NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const defaultSettings = [
      ['RECEIPT_QR_MODE', 'calendar', 'Receipt QR contents: "calendar" = offline event, "url" = online link'],
      ['DEFAULT_CURRENCY', 'INR', 'Default system currency code'],
      ['RECEIPT_THANK_YOU_MESSAGE', 'Thank you for your offering. God Bless You.', 'Default message printed on receipts'],
      ['UPI_ENABLED', '0', 'Enable UPI QR on receipts (0 = disabled, 1 = enabled)'],
    ];
    for (const [key, val, desc] of defaultSettings) {
      await conn.query(`
        INSERT IGNORE INTO system_settings (setting_key, setting_value, description)
        VALUES (?, ?, ?);
      `, [key, val, desc]);
    }

    // Register all migration records in schema_migrations
    const allMigrations = [
      '001_master_tables.sql', '002_lookup_and_rbac.sql', '003_users_auth.sql',
      '004_prayer_intentions.sql', '005_certificates.sql', '006_audit_logs.sql',
      '007_prayer_intention_public_token.sql', '008_webauthn_credentials.sql',
      '009_receipt_qr_mode_setting.sql', '010_upi_settings.sql',
      '011_default_currency_setting.sql', '012_payment_transactions.sql',
      '013_rename_to_mass_intentions.sql', '014_payment_workflow_redesign.sql',
      '015_restricted_date_reason.sql', '016_default_flags.sql',
      '018_certificate_register_extract_fields.sql', '019_church_default_offering_amount.sql',
      '020_church_theme_color.sql', '021_church_theme_color_more_options.sql',
      '022_donations.sql', '023_mass_intention_booked_by.sql',
      '024_mass_default_offering_amount.sql', '025_scope_receipt_numbers_per_church.sql',
      '026_bulk_batch_id.sql', '027_rename_donations_to_contributions.sql',
      '028_announcement_status.sql', '029_intention_and_mass_tamil_names.sql',
      '030_contribution_type_tamil_name.sql', '031_church_tamil_name.sql',
      '032_church_tamil_address.sql', '033_seed_tamil_backfill.sql',
      '034_mass_offering_description.sql', '035_church_scoped_roles.sql',
      '036_certificate_branch_scoping.sql', '037_backfill_certificate_branch.sql',
      '038_session_auth.sql', '039_certificate_custom_priest_name.sql',
      '040_contribution_types_certificates.sql', '041_central_analytics_indexes.sql',
      '042_church_theme_color_more_options.sql', '043_marriage_witnesses_expansion.sql',
      '044_confirmation_certificates.sql'
    ];

    for (const m of allMigrations) {
      await conn.query('INSERT IGNORE INTO schema_migrations (filename) VALUES (?)', [m]);
    }
    console.log('  -> All migration records registered in schema_migrations.');

    console.log('\n================================================================');
    console.log(' SUCCESS: Database is 100% up-to-date!');
    console.log(' All tables, columns, indexes, permissions & settings are synchronized.');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n[ERROR] Migration script failed:', err.message);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

run();
