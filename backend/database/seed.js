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
  SEED_MASTER_ADMIN_USERNAME = 'masteradmin',
  SEED_MASTER_ADMIN_PASSWORD = 'MasterAdmin@12345',
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
    // Cross-church superuser -- not given any role_permissions rows below;
    // authorize.js/auth.service.ts hard-code a bypass for this role_code so
    // its access can never be narrowed by editing Roles & Permissions. Has
    // no home church/branch (see the seeded user further down) -- acts as
    // whichever church/branch it selects via the Settings > Change Church &
    // Branch switcher.
    { name: 'Master Administrator', code: 'MASTER_ADMIN', description: 'Cross-church superuser -- acts as any church/branch via the switcher', is_system_role: 1 },
    { name: 'Administrator', code: 'ADMIN', description: 'Full system access', is_system_role: 1 },
    { name: 'Office Staff', code: 'OFFICE_STAFF', description: 'Day-to-day data entry: mass intentions, certificates, receipts', is_system_role: 0 },
    { name: 'Priest', code: 'PRIEST', description: 'Read-only access to the Mass register and reports', is_system_role: 0 },
    { name: 'Accountant', code: 'ACCOUNTANT', description: 'Views collections and financial reports', is_system_role: 0 },
  ]);

  const permissionDefs = {
    dashboard: ['view'],
    mass_intentions: ['view', 'create', 'update', 'delete', 'print'],
    contributions: ['view', 'create', 'update', 'delete', 'print'],
    prayer_register: ['view', 'print'],
    receipts: ['view', 'print'],
    baptism_certificates: ['view', 'create', 'update', 'delete', 'print', 'export'],
    marriage_certificates: ['view', 'create', 'update', 'delete', 'print', 'export'],
    death_certificates: ['view', 'create', 'update', 'delete', 'print', 'export'],
    masters: ['view', 'create', 'update', 'delete'],
    // print_all gates the "day-wise, ALL users" Reports print button (shows
    // who billed each row) -- ADMIN gets it automatically below along with
    // every other permission; reports.view alone (every other role) only
    // ever covers printing one's OWN billed transactions for a day.
    reports: ['view', 'export', 'print_all'],
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
      'mass_intentions.view', 'mass_intentions.create', 'mass_intentions.update', 'mass_intentions.delete', 'mass_intentions.print',
      'contributions.view', 'contributions.create', 'contributions.update', 'contributions.delete', 'contributions.print',
      'prayer_register.view', 'prayer_register.print',
      'receipts.view', 'receipts.print',
      'baptism_certificates.view', 'baptism_certificates.create', 'baptism_certificates.update', 'baptism_certificates.print', 'baptism_certificates.export',
      'marriage_certificates.view', 'marriage_certificates.create', 'marriage_certificates.update', 'marriage_certificates.print', 'marriage_certificates.export',
      'death_certificates.view', 'death_certificates.create', 'death_certificates.update', 'death_certificates.print', 'death_certificates.export',
      'reports.view', 'reports.export',
    ],
    PRIEST: ['dashboard.view', 'prayer_register.view', 'prayer_register.print', 'reports.view'],
    ACCOUNTANT: ['dashboard.view', 'reports.view', 'reports.export', 'mass_intentions.view', 'contributions.view'],
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
  // name_ta included directly -- same reasoning as masses/prayer_intention_master
  // above (see masses' own comment): migration 030's UPDATE only backfills
  // a database seeded before that migration existed, not a fresh db:setup.
  await insertIgnore(conn, 'contribution_types', ['name', 'name_ta', 'code', 'description'], [
    { name: 'General Offering', name_ta: 'பொது காணிக்கை', code: 'GENERAL', description: 'General church offering' },
    { name: 'Building Fund', name_ta: 'கட்டிட நிதி', code: 'BUILDING_FUND', description: 'Church building/renovation fund' },
    { name: 'Charity', name_ta: 'தொண்டு', code: 'CHARITY', description: 'Charity and outreach contributions' },
    { name: 'Church Maintenance', name_ta: 'தேவாலய பராமரிப்பு', code: 'CHURCH_MAINTENANCE', description: 'Upkeep and maintenance of church property' },
    // A Mass offering is recorded by a Mass Intention, so there is no "Mass Offering" type (retired in migration 040).
    { name: 'Baptism Certificate', name_ta: 'ஞானஸ்நான சான்றிதழ்', code: 'BAPTISM_CERTIFICATE', description: 'Contribution received for a Baptism certificate' },
    { name: 'Marriage Certificate', name_ta: 'திருமண சான்றிதழ்', code: 'MARRIAGE_CERTIFICATE', description: 'Contribution received for a Marriage certificate' },
    { name: 'Death Certificate', name_ta: 'இறப்பு சான்றிதழ்', code: 'DEATH_CERTIFICATE', description: 'Contribution received for a Death certificate' },
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
        (name, name_ta, registration_no, address_line1, address_ta, city, district_id, state_id, country_id, pincode, phone, email, established_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        "St. Mary's Church",
        // Demo default -- a real installation renames this to its own
        // church (see master-form.ts, Masters > Churches) and should
        // replace this with its own actual Tamil name at that point; this
        // just means a fresh install isn't blank/English-only on the
        // printed receipt/register/header the moment Tamil is switched on,
        // before anyone's touched Masters yet.
        'புனித மரியாள் ஆலயம்',
        'REG-0001',
        '1 Church Street',
        '1 சர்ச் தெரு, சென்னை',
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
    // name_ta set directly here (not left for migration 029's UPDATE to
    // backfill) -- db:setup runs migrate THEN seed, so on a genuinely
    // fresh install migration 029 ran against an empty masses table and
    // matched nothing; without this, Masses stayed English-only until
    // someone edited them by hand.
    await conn.query(
      `INSERT INTO masses (church_id, branch_id, name, name_ta, mass_time, day_type, sort_order) VALUES
        (?,?,?,?,?,?,?), (?,?,?,?,?,?,?), (?,?,?,?,?,?,?), (?,?,?,?,?,?,?)`,
      [
        churchId, branchId, 'Weekday Morning Mass', 'காலை திருப்பலி', '06:00:00', 'Daily', 1,
        churchId, branchId, 'Weekday Evening Mass', 'மாலை திருப்பலி', '18:00:00', 'Daily', 2,
        churchId, branchId, 'Sunday Morning Mass', 'ஞாயிறு காலை திருப்பலி', '08:00:00', 'Sunday', 3,
        churchId, branchId, 'Sunday Evening Mass', 'ஞாயிறு மாலை திருப்பலி', '17:30:00', 'Sunday', 4,
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
    // name_ta set directly here -- same reasoning as masses above (see its
    // own comment): migration 029's UPDATE only helps a database that was
    // already seeded before that migration ran, not a genuinely fresh
    // db:setup.
    const intentions = [
      ['Thanksgiving', 'நன்றி செலுத்துதல்', categoryIdByCode.GENERAL, 1, 0],
      ['Good Health', 'நல்ல ஆரோக்கியம்', categoryIdByCode.HEALTH, 2, 0],
      ['Healing from Illness', 'நோய் நீக்கம்', categoryIdByCode.HEALTH, 3, 0],
      ['Birthday Blessings', 'பிறந்தநாள் ஆசீர்வாதங்கள்', categoryIdByCode.OCCASION, 4, 0],
      ['Wedding Anniversary', 'திருமண ஆண்டு விழா', categoryIdByCode.OCCASION, 5, 0],
      ['Successful Examination', 'வெற்றிகரமான தேர்வு', categoryIdByCode.OCCASION, 6, 0],
      ['Employment / New Job', 'வேலைவாய்ப்பு / புதிய வேலை', categoryIdByCode.OCCASION, 7, 0],
      ['Safe Travel', 'பாதுகாப்பான பயணம்', categoryIdByCode.GENERAL, 8, 0],
      ['Souls of the Departed', 'இறந்தோர் ஆன்மாக்களுக்காக', categoryIdByCode.DEPARTED, 9, 0],
      ['Family Blessings', 'குடும்ப ஆசீர்வாதங்கள்', categoryIdByCode.FAMILY, 10, 0],
      ['Others', 'மற்றவை', null, 11, 1],
    ];
    for (const [name, nameTa, categoryId, sortOrder, isCustom] of intentions) {
      await conn.query(
        'INSERT INTO prayer_intention_master (category_id, name, name_ta, sort_order, is_custom) VALUES (?,?,?,?,?)',
        [categoryId, name, nameTa, sortOrder, isCustom]
      );
    }
  }

  // contribution_types (name/code/description) predates this feature -- already
  // seeded with General Offering/Building Fund/Charity. Adds
  // only the 'Others' row the Contribution form's custom-purpose text field
  // keys off of (by code, same way certificate/day-type fixed values are
  // matched elsewhere) -- insertIgnore so re-running this never duplicates
  // it or disturbs whatever an administrator has since edited.
  console.log('Seeding contribution type "Others" option...');
  await insertIgnore(conn, 'contribution_types', ['name', 'name_ta', 'code', 'description'], [
    { name: 'Others', name_ta: 'மற்றவை', code: 'OTHERS', description: 'Any other contribution purpose not listed above' },
  ]);

  console.log('Seeding system settings...');
  await insertIgnore(conn, 'system_settings', ['setting_key', 'setting_value', 'description'], [
    { setting_key: 'APP_NAME', setting_value: 'Church Office Management System', description: 'Application display name' },
    { setting_key: 'DEFAULT_CHURCH_ID', setting_value: String(churchId), description: 'Church shown by default in new records' },
    { setting_key: 'RECEIPT_THANK_YOU_MESSAGE', setting_value: 'Thank you for your offering. God Bless You.', description: 'Footer message on printed receipts' },
    { setting_key: 'DATE_FORMAT', setting_value: 'DD-MM-YYYY', description: 'Display date format across the app' },
    { setting_key: 'RECEIPT_QR_MODE', setting_value: 'calendar', description: 'Receipt QR contents: "calendar" = offline calendar event, "url" = link to the online page' },
    { setting_key: 'DEFAULT_CURRENCY', setting_value: 'INR', description: 'Default currency for offerings, receipts, reports and the dashboard' },
    { setting_key: 'UPI_VPA', setting_value: '', description: "Church's UPI ID (VPA), e.g. parish@okhdfcbank -- required for the UPI QR on prayer intention receipts" },
    { setting_key: 'UPI_PAYEE_NAME', setting_value: '', description: 'Payee name shown in the paying UPI app (defaults to the church name if left blank)' },
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

  // Not gated by tableEmpty (unlike the ADMIN user above) so re-running this
  // script on an existing database -- upgrading to add the Master
  // Administrator feature -- still creates the account. Guarded instead by
  // its own existence check so re-running never duplicates it or resets its
  // password. church_id/branch_id stay NULL: this role has no home church,
  // it acts as whichever church/branch it picks via Settings > Change
  // Church & Branch (see authenticate.js).
  console.log('Seeding master administrator user...');
  const [existingMasterAdmins] = await conn.query('SELECT id FROM users WHERE role_id = ? AND is_deleted = 0 LIMIT 1', [
    roleIdByCode.MASTER_ADMIN,
  ]);
  if (!existingMasterAdmins.length) {
    const masterAdminPasswordHash = await bcrypt.hash(SEED_MASTER_ADMIN_PASSWORD, 12);
    await conn.query(
      `INSERT INTO users
        (church_id, branch_id, role_id, employee_code, full_name, username, email, password_hash, must_change_password)
       VALUES (NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roleIdByCode.MASTER_ADMIN,
        'EMP-0000',
        'Master Administrator',
        SEED_MASTER_ADMIN_USERNAME,
        'masteradmin@coms.example.org',
        masterAdminPasswordHash,
        1,
      ]
    );
    console.log('----------------------------------------------------------');
    console.log(`Master Administrator login created -> username: ${SEED_MASTER_ADMIN_USERNAME}  password: ${SEED_MASTER_ADMIN_PASSWORD}`);
    console.log('You will be required to change this password on first login.');
    console.log('----------------------------------------------------------');
  } else {
    console.log('Master Administrator user already exists — skipping.');
  }

  console.log('Seeding sample marriage certificate...');
  if (await tableEmpty(conn, 'marriage_certificates')) {
    await conn.query(
      `INSERT INTO marriage_certificates (
        church_id, branch_id, certificate_no,
        marriage_date, where_married,
        groom_name, bride_name,
        groom_age, bride_age,
        groom_condition, bride_condition,
        groom_residence, bride_residence,
        groom_father_name, bride_father_name,
        banns_or_licence, impediments_dispensed,
        witness1_name, witness2_name,
        custom_priest_name
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        churchId,
        branchId,
        'MAR-0001',
        '2023-10-25',
        'ST.THOMAS CHURCH',
        'SRIDHER',
        'BELCIYA',
        '36',
        '19',
        'BACHELOR',
        'SPINSTER',
        'THOOTHUKUDI',
        'THOOTHUKUDI',
        'RAJA',
        'SATHISKUMAR',
        'BY BANNS',
        'NIL',
        'RATHNAM',
        'AROCKIA RAJAN',
        'REV. FR. PRATHEEP',
      ]
    );
    await conn.query("UPDATE certificate_series SET next_number = 2 WHERE church_id = ? AND certificate_type = 'Marriage'", [churchId]);
  }

  console.log('Seed complete.');
  await conn.end();
}

run().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
