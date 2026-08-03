/**
 * Idempotent seed script. Safe to re-run: each block checks for existing
 * data before inserting. Populates master tables with the minimum data
 * needed for the app to be usable out of the box (roles/permissions,
 * one church, masses, prayer intention dropdown, and an admin login).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = 'root',
  DB_NAME = 'coms_db',
  SEED_ADMIN_USERNAME = 'admin',
  SEED_ADMIN_PASSWORD = 'Admin@12345',
} = process.env;

async function tableEmpty(conn, table) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
  return rows[0].c === 0;
}

async function insertIgnore(conn, table, columns, rows) {
  if (!rows.length) return;
  const placeholders = `(${columns.map(() => '?').join(',')})`;
  const sql = `INSERT IGNORE INTO \`${table}\` (${columns.join(',')}) VALUES ${rows
    .map(() => placeholders)
    .join(',')}`;
  const flat = rows.flatMap((r) => columns.map((c) => r[c]));
  await conn.query(sql, flat);
}

async function getIdMap(conn, table, keyCol, valCol = 'id') {
  const [rows] = await conn.query(`SELECT ${keyCol}, ${valCol} FROM \`${table}\``);
  const map = {};
  rows.forEach((r) => (map[r[keyCol]] = r[valCol]));
  return map;
}

async function run() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  console.log('Seeding roles & permissions...');
  await insertIgnore(conn, 'roles', ['name', 'code', 'description', 'is_system_role'], [
    { name: 'Administrator', code: 'ADMIN', description: 'Full system access', is_system_role: 1 },
    { name: 'Office Staff', code: 'OFFICE_STAFF', description: 'Day-to-day data entry: prayer intentions, certificates, receipts', is_system_role: 0 },
    { name: 'Priest', code: 'PRIEST', description: 'Read-only access to the prayer register and reports', is_system_role: 0 },
    { name: 'Accountant', code: 'ACCOUNTANT', description: 'Views collections and financial reports', is_system_role: 0 },
  ]);

  const permissionDefs = {
    dashboard: ['view'],
    prayer_intentions: ['view', 'create', 'update', 'delete', 'print'],
    prayer_register: ['view', 'print'],
    receipts: ['view', 'print'],
    baptism_certificates: ['view', 'create', 'update', 'delete', 'print', 'export'],
    marriage_certificates: ['view', 'create', 'update', 'delete', 'print', 'export'],
    death_certificates: ['view', 'create', 'update', 'delete', 'print', 'export'],
    masters: ['view', 'create', 'update', 'delete'],
    reports: ['view', 'export'],
    users: ['view', 'create', 'update', 'delete'],
    roles: ['view', 'create', 'update', 'delete'],
    settings: ['view', 'update'],
    audit_logs: ['view'],
  };
  const permissionRows = [];
  for (const [module, actions] of Object.entries(permissionDefs)) {
    for (const action of actions) {
      permissionRows.push({
        module,
        action,
        code: `${module}.${action}`,
        description: `${action} ${module.replace(/_/g, ' ')}`,
      });
    }
  }
  await insertIgnore(conn, 'permissions', ['module', 'action', 'code', 'description'], permissionRows);

  const roleIdByCode = await getIdMap(conn, 'roles', 'code');
  const permIdByCode = await getIdMap(conn, 'permissions', 'code');

  const rolePermCodes = {
    ADMIN: Object.keys(permIdByCode), // every permission
    OFFICE_STAFF: [
      'dashboard.view',
      'prayer_intentions.view', 'prayer_intentions.create', 'prayer_intentions.update', 'prayer_intentions.delete', 'prayer_intentions.print',
      'prayer_register.view', 'prayer_register.print',
      'receipts.view', 'receipts.print',
      'baptism_certificates.view', 'baptism_certificates.create', 'baptism_certificates.update', 'baptism_certificates.print', 'baptism_certificates.export',
      'marriage_certificates.view', 'marriage_certificates.create', 'marriage_certificates.update', 'marriage_certificates.print', 'marriage_certificates.export',
      'death_certificates.view', 'death_certificates.create', 'death_certificates.update', 'death_certificates.print', 'death_certificates.export',
      'reports.view', 'reports.export',
    ],
    PRIEST: ['dashboard.view', 'prayer_register.view', 'prayer_register.print', 'reports.view'],
    ACCOUNTANT: ['dashboard.view', 'reports.view', 'reports.export', 'prayer_intentions.view'],
  };
  const rolePermRows = [];
  for (const [roleCode, permCodes] of Object.entries(rolePermCodes)) {
    for (const permCode of permCodes) {
      rolePermRows.push({ role_id: roleIdByCode[roleCode], permission_id: permIdByCode[permCode] });
    }
  }
  await insertIgnore(conn, 'role_permissions', ['role_id', 'permission_id'], rolePermRows);

  console.log('Seeding lookup masters...');
  await insertIgnore(conn, 'statuses', ['entity_type', 'code', 'label', 'color', 'sort_order'], [
    { entity_type: 'prayer_intention', code: 'PENDING', label: 'Pending', color: '#F5A623', sort_order: 1 },
    { entity_type: 'prayer_intention', code: 'COMPLETED', label: 'Completed', color: '#2E7D32', sort_order: 2 },
    { entity_type: 'prayer_intention', code: 'CANCELLED', label: 'Cancelled', color: '#C62828', sort_order: 3 },
  ]);
  await insertIgnore(conn, 'genders', ['name', 'code'], [
    { name: 'Male', code: 'M' },
    { name: 'Female', code: 'F' },
  ]);
  await insertIgnore(conn, 'departments', ['name', 'code'], [
    { name: 'Administration', code: 'ADMIN' },
    { name: 'Accounts', code: 'ACCOUNTS' },
    { name: 'Sacristy', code: 'SACRISTY' },
  ]);
  await insertIgnore(conn, 'languages', ['name', 'code'], [
    { name: 'English', code: 'EN' },
    { name: 'Hindi', code: 'HI' },
    { name: 'Tamil', code: 'TA' },
  ]);
  await insertIgnore(conn, 'currencies', ['name', 'code', 'symbol'], [
    { name: 'Indian Rupee', code: 'INR', symbol: '₹' },
    { name: 'US Dollar', code: 'USD', symbol: '$' },
  ]);
  await insertIgnore(conn, 'payment_methods', ['name', 'code'], [
    { name: 'Cash', code: 'CASH' },
    { name: 'Card', code: 'CARD' },
    { name: 'UPI', code: 'UPI' },
    { name: 'Cheque', code: 'CHEQUE' },
    { name: 'Bank Transfer', code: 'BANK_TRANSFER' },
  ]);
  await insertIgnore(conn, 'donation_types', ['name', 'code', 'description'], [
    { name: 'General Offering', code: 'GENERAL', description: 'General church offering' },
    { name: 'Mass Offering', code: 'MASS_OFFERING', description: 'Offering tied to a prayer intention' },
    { name: 'Building Fund', code: 'BUILDING_FUND', description: 'Church building/renovation fund' },
    { name: 'Charity', code: 'CHARITY', description: 'Charity and outreach donations' },
  ]);
  await insertIgnore(conn, 'document_types', ['name', 'code'], [
    { name: 'ID Proof', code: 'ID_PROOF' },
    { name: 'Address Proof', code: 'ADDRESS_PROOF' },
  ]);
  await insertIgnore(conn, 'countries', ['name', 'iso_code', 'phone_code'], [
    { name: 'India', iso_code: 'IN', phone_code: '+91' },
    { name: 'United States', iso_code: 'US', phone_code: '+1' },
    { name: 'United Kingdom', iso_code: 'GB', phone_code: '+44' },
    { name: 'Philippines', iso_code: 'PH', phone_code: '+63' },
  ]);

  const countryIdByIso = await getIdMap(conn, 'countries', 'iso_code');

  if (await tableEmpty(conn, 'states')) {
    await conn.query(
      'INSERT INTO states (country_id, name, code) VALUES (?,?,?), (?,?,?)',
      [countryIdByIso.IN, 'Tamil Nadu', 'TN', countryIdByIso.IN, 'Kerala', 'KL']
    );
  }
  const [stateRows] = await conn.query('SELECT id, name FROM states');
  const stateIdByName = Object.fromEntries(stateRows.map((r) => [r.name, r.id]));

  if (await tableEmpty(conn, 'districts')) {
    await conn.query(
      'INSERT INTO districts (state_id, name, code) VALUES (?,?,?), (?,?,?)',
      [stateIdByName['Tamil Nadu'], 'Chennai', 'CHN', stateIdByName['Kerala'], 'Ernakulam', 'EKM']
    );
  }
  const [districtRows] = await conn.query('SELECT id, name FROM districts');
  const districtIdByName = Object.fromEntries(districtRows.map((r) => [r.name, r.id]));

  console.log('Seeding default church, branch, priest & masses...');
  let churchId;
  if (await tableEmpty(conn, 'churches')) {
    const [result] = await conn.query(
      `INSERT INTO churches
        (name, registration_no, address_line1, city, district_id, state_id, country_id, pincode, phone, email, established_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        "St. Mary's Church",
        'REG-0001',
        '1 Church Street',
        'Chennai',
        districtIdByName['Chennai'],
        stateIdByName['Tamil Nadu'],
        countryIdByIso.IN,
        '600001',
        '+91 44 0000 0000',
        'office@stmarys.example.org',
        '1950-01-01',
      ]
    );
    churchId = result.insertId;
  } else {
    const [rows] = await conn.query('SELECT id FROM churches ORDER BY id LIMIT 1');
    churchId = rows[0].id;
  }

  let branchId;
  if (await tableEmpty(conn, 'branches')) {
    const [result] = await conn.query(
      'INSERT INTO branches (church_id, name, code, address) VALUES (?,?,?,?)',
      [churchId, 'Main Church', 'MAIN', '1 Church Street, Chennai']
    );
    branchId = result.insertId;
  } else {
    const [rows] = await conn.query('SELECT id FROM branches ORDER BY id LIMIT 1');
    branchId = rows[0].id;
  }

  if (await tableEmpty(conn, 'priests')) {
    await conn.query(
      'INSERT INTO priests (church_id, name, title, is_parish_priest) VALUES (?,?,?,?)',
      [churchId, 'Rev. Fr. John Fernandes', 'Rev. Fr.', 1]
    );
  }

  if (await tableEmpty(conn, 'masses')) {
    await conn.query(
      `INSERT INTO masses (church_id, branch_id, name, mass_time, day_type, sort_order) VALUES
        (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?), (?,?,?,?,?,?)`,
      [
        churchId, branchId, 'Weekday Morning Mass', '06:00:00', 'Daily', 1,
        churchId, branchId, 'Weekday Evening Mass', '18:00:00', 'Daily', 2,
        churchId, branchId, 'Sunday Morning Mass', '08:00:00', 'Sunday', 3,
        churchId, branchId, 'Sunday Evening Mass', '17:30:00', 'Sunday', 4,
      ]
    );
  }

  if (await tableEmpty(conn, 'receipt_series')) {
    await conn.query(
      'INSERT INTO receipt_series (church_id, series_name, prefix, next_number, number_padding) VALUES (?,?,?,?,?)',
      [churchId, 'Default Receipt Series', 'RCT', 1, 4]
    );
  }

  if (await tableEmpty(conn, 'certificate_series')) {
    await conn.query(
      `INSERT INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding) VALUES
        (?,?,?,?,?), (?,?,?,?,?), (?,?,?,?,?)`,
      [
        churchId, 'Baptism', 'BAP', 1, 4,
        churchId, 'Marriage', 'MAR', 1, 4,
        churchId, 'Death', 'DTH', 1, 4,
      ]
    );
  }

  console.log('Seeding prayer intention dropdown...');
  await insertIgnore(conn, 'prayer_categories', ['name', 'code', 'sort_order'], [
    { name: 'General', code: 'GENERAL', sort_order: 1 },
    { name: 'Health & Healing', code: 'HEALTH', sort_order: 2 },
    { name: 'Family & Relationships', code: 'FAMILY', sort_order: 3 },
    { name: 'Special Occasions', code: 'OCCASION', sort_order: 4 },
    { name: 'Departed Souls', code: 'DEPARTED', sort_order: 5 },
  ]);
  const categoryIdByCode = await getIdMap(conn, 'prayer_categories', 'code');

  if (await tableEmpty(conn, 'prayer_intention_master')) {
    const intentions = [
      ['Thanksgiving', categoryIdByCode.GENERAL, 1, 0],
      ['Good Health', categoryIdByCode.HEALTH, 2, 0],
      ['Healing from Illness', categoryIdByCode.HEALTH, 3, 0],
      ['Birthday Blessings', categoryIdByCode.OCCASION, 4, 0],
      ['Wedding Anniversary', categoryIdByCode.OCCASION, 5, 0],
      ['Successful Examination', categoryIdByCode.OCCASION, 6, 0],
      ['Employment / New Job', categoryIdByCode.OCCASION, 7, 0],
      ['Safe Travel', categoryIdByCode.GENERAL, 8, 0],
      ['Souls of the Departed', categoryIdByCode.DEPARTED, 9, 0],
      ['Family Blessings', categoryIdByCode.FAMILY, 10, 0],
      ['Others', null, 11, 1],
    ];
    for (const [name, categoryId, sortOrder, isCustom] of intentions) {
      await conn.query(
        'INSERT INTO prayer_intention_master (category_id, name, sort_order, is_custom) VALUES (?,?,?,?)',
        [categoryId, name, sortOrder, isCustom]
      );
    }
  }

  console.log('Seeding system settings...');
  await insertIgnore(conn, 'system_settings', ['setting_key', 'setting_value', 'description'], [
    { setting_key: 'APP_NAME', setting_value: 'Church Office Management System', description: 'Application display name' },
    { setting_key: 'DEFAULT_CHURCH_ID', setting_value: String(churchId), description: 'Church shown by default in new records' },
    { setting_key: 'RECEIPT_THANK_YOU_MESSAGE', setting_value: 'Thank you for your offering. God Bless You.', description: 'Footer message on printed receipts' },
    { setting_key: 'DATE_FORMAT', setting_value: 'DD-MM-YYYY', description: 'Display date format across the app' },
  ]);

  console.log('Seeding admin user...');
  if (await tableEmpty(conn, 'users')) {
    const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);
    await conn.query(
      `INSERT INTO users
        (church_id, branch_id, role_id, employee_code, full_name, username, email, password_hash, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        churchId,
        branchId,
        roleIdByCode.ADMIN,
        'EMP-0001',
        'System Administrator',
        SEED_ADMIN_USERNAME,
        'admin@stmarys.example.org',
        passwordHash,
        1,
      ]
    );
    console.log('----------------------------------------------------------');
    console.log(`Admin login created -> username: ${SEED_ADMIN_USERNAME}  password: ${SEED_ADMIN_PASSWORD}`);
    console.log('You will be required to change this password on first login.');
    console.log('----------------------------------------------------------');
  } else {
    console.log('Users table already has data — skipping admin creation.');
  }

  console.log('Seed complete.');
  await conn.end();
}

run().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
