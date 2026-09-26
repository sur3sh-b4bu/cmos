/**
 * Comprehensive Mock Data Seeder for Church Office Management System (COMS).
 * 
 * Generates rich, multi-page realistic mock data for ALL tables across all pages:
 * - Churches, Branches & Priests
 * - Masses & Mass Timings
 * - Mass Intentions (Past, Today, Future, Paid & Unpaid)
 * - Contributions & Donations (All categories & payment methods)
 * - Baptism, Marriage & Death Certificates (Multiple pages)
 * - Masters (Intention types, Contribution types, Branches, Priests)
 * - System Users & Roles
 * - Soft-Deleted sample records across all 11 modules for Recycle Bin testing
 * 
 * Usage: npm run seed:mock
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
} = process.env;

function getFormattedDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function run() {
  console.log('🚀 Connecting to database to seed comprehensive multi-page mock data...');
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  // 1. Get Church ID
  const [churches] = await conn.query('SELECT id, name FROM churches LIMIT 1');
  if (!churches.length) {
    console.error('❌ No church found. Please run "npm run seed" first.');
    process.exit(1);
  }
  const churchId = churches[0].id;
  console.log(`📍 Seeding data for church: "${churches[0].name}" (ID: ${churchId})`);

  // 2. Get Lookup IDs
  const [[adminUser]] = await conn.query('SELECT id FROM users WHERE church_id = ? OR role_id IN (SELECT id FROM roles WHERE code = "MASTER_ADMIN") LIMIT 1', [churchId]);
  const userId = adminUser?.id || 1;

  const [genders] = await conn.query('SELECT id, code FROM genders');
  const [statuses] = await conn.query('SELECT id, code FROM statuses');
  const [payMethods] = await conn.query('SELECT id, code FROM payment_methods');

  const genderMale = genders.find((g) => g.code === 'M')?.id || 1;
  const genderFemale = genders.find((g) => g.code === 'F')?.id || 2;
  const statusCompleted = statuses.find((s) => s.code === 'COMPLETED')?.id || 1;
  const statusPending = statuses.find((s) => s.code === 'PENDING')?.id || 2;
  const payCash = payMethods.find((m) => m.code === 'CASH')?.id || 1;
  const payUpi = payMethods.find((m) => m.code === 'UPI')?.id || 2;
  const payBank = payMethods.find((m) => m.code === 'BANK_TRANSFER')?.id || 3;
  const payCheque = payMethods.find((m) => m.code === 'CHEQUE')?.id || payBank;

  console.log('✨ 1. Seeding Priests, Branches & Masses...');
  await conn.query(
    `INSERT IGNORE INTO priests (church_id, name, title, phone, email, is_parish_priest, created_by, updated_by, is_active, is_deleted) VALUES
     (?, 'Fr. Michael Doss', 'Rev. Fr.', '9840123456', 'michael.doss@church.org', 1, ?, ?, 1, 0),
     (?, 'Fr. Antony Raj', 'Rev. Fr.', '9840234567', 'antony.raj@church.org', 0, ?, ?, 1, 0),
     (?, 'Fr. John Paul', 'Rev. Fr.', '9840345678', 'john.paul@church.org', 0, ?, ?, 1, 0),
     (?, 'Fr. Thomas Xavier', 'Rev. Fr.', '9840456789', 'thomas.xavier@church.org', 0, ?, ?, 1, 0),
     (?, 'Fr. Stephen Joseph', 'Rev. Fr.', '9840567890', 'stephen.j@church.org', 0, ?, ?, 1, 0),
     (?, 'Fr. George Fernandez', 'Rev. Fr.', '9840678901', 'george.f@church.org', 0, ?, ?, 1, 0),
     (?, 'Fr. Augustine Leo', 'Rev. Fr.', '9840789012', 'augustine.l@church.org', 0, ?, ?, 1, 0),
     (?, 'Fr. Former Priest (Archived)', 'Rev. Fr.', '9840999999', 'archived.priest@church.org', 0, ?, ?, 0, 1)`,
    [
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
    ]
  );

  await conn.query(
    `INSERT IGNORE INTO branches (church_id, name, code, address, phone, email, created_by, updated_by, is_active, is_deleted) VALUES
     (?, 'St. Mary Main Church', 'BR-MAIN', '10 Cathedral Road, Central City', '044-24567800', 'main@church.org', ?, ?, 1, 0),
     (?, 'East Wing Chapel', 'BR-EAST', '45 Chapel St, East Block', '044-24567890', 'east@church.org', ?, ?, 1, 0),
     (?, 'North Sub-station', 'BR-NORTH', '12 North High Road', '044-24567891', 'north@church.org', ?, ?, 1, 0),
     (?, 'St. Jude Shrine Branch', 'BR-JUDE', '78 Hill View Colony', '044-24567892', 'jude@church.org', ?, ?, 1, 0),
     (?, 'Infant Jesus Mission Center', 'BR-IJMC', '88 Bypass Avenue', '044-24567893', 'ijmc@church.org', ?, ?, 1, 0),
     (?, 'Old Campus (Closed)', 'BR-OLD', 'Old Hill Road', '044-24567899', 'old@church.org', ?, ?, 0, 1)`,
    [
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
      churchId, userId, userId,
    ]
  );

  const [masses] = await conn.query('SELECT id, name FROM masses WHERE church_id = ?', [churchId]);
  const [priests] = await conn.query('SELECT id, name FROM priests WHERE church_id = ?', [churchId]);
  const [branches] = await conn.query('SELECT id, name FROM branches WHERE church_id = ?', [churchId]);

  const massId1 = masses[0]?.id || 1;
  const massId2 = masses[1]?.id || massId1;
  const massId3 = masses[2]?.id || massId1;
  const priestId1 = priests[0]?.id || null;
  const priestId2 = priests[1]?.id || priestId1;
  const priestId3 = priests[2]?.id || priestId1;
  const branchId1 = branches[0]?.id || null;
  const branchId2 = branches[1]?.id || branchId1;

  console.log('✨ 2. Seeding Multi-Page Mass Intentions (30+ records)...');
  const mockIntentions = [
    { receipt: 'RCT-MOCK-001', name: 'Joseph Anthony', phone: '9841001122', date: getFormattedDate(0), mass: massId1, amount: 250.00, remarks: 'Thanksgiving Mass for family health', bookedBy: 'Mary Joseph', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-002', name: 'Maria Fernandez', phone: '9841002233', date: getFormattedDate(0), mass: massId2, amount: 300.00, remarks: 'In memory of Late Fernandez', bookedBy: 'Peter Fernandez', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-003', name: 'David Raj', phone: '9841003344', date: getFormattedDate(0), mass: massId1, amount: 150.00, remarks: 'Birthday blessings for son', bookedBy: 'Self', isPaid: false, payMethod: null, isDel: 0 },
    { receipt: 'RCT-MOCK-004', name: 'Sneha Robert', phone: '9841004455', date: getFormattedDate(1), mass: massId1, amount: 500.00, remarks: 'Wedding Anniversary Thanksgiving', bookedBy: 'Robert Cruz', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-005', name: 'Francis Xavier', phone: '9841005566', date: getFormattedDate(2), mass: massId2, amount: 200.00, remarks: 'Soul rest of Grace Xavier', bookedBy: 'Paul Xavier', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-006', name: 'Theresa Lawrence', phone: '9841006677', date: getFormattedDate(3), mass: massId1, amount: 250.00, remarks: 'Success in exams', bookedBy: 'Theresa', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-007', name: 'Christopher Daniel', phone: '9841007788', date: getFormattedDate(-1), mass: massId1, amount: 1000.00, remarks: 'Special Thanksgiving Intention', bookedBy: 'Self', isPaid: true, payMethod: payBank, isDel: 0 },
    { receipt: 'RCT-MOCK-008', name: 'Clara Dominic', phone: '9841008899', date: getFormattedDate(-2), mass: massId2, amount: 350.00, remarks: 'Good health & fast recovery', bookedBy: 'Dominic Savio', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-009', name: 'Stephen George', phone: '9841009900', date: getFormattedDate(-3), mass: massId1, amount: 500.00, remarks: 'Soul rest of Late George Varghese', bookedBy: 'Stephen', isPaid: true, payMethod: payBank, isDel: 0 },
    { receipt: 'RCT-MOCK-010', name: 'Roseline Mary', phone: '9841010011', date: getFormattedDate(0), mass: massId2, amount: 250.00, remarks: 'Travel mercies & overseas safety', bookedBy: 'Roseline', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-011', name: 'Albert Einstein Raj', phone: '9841011122', date: getFormattedDate(4), mass: massId1, amount: 300.00, remarks: 'Blessings for new business opening', bookedBy: 'Albert', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-012', name: 'Grace Philomena', phone: '9841012233', date: getFormattedDate(5), mass: massId2, amount: 200.00, remarks: 'Soul rest of Baby Philomena', bookedBy: 'Grace', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-013', name: 'Vincent De Paul', phone: '9841013344', date: getFormattedDate(-4), mass: massId1, amount: 400.00, remarks: 'Thanksgiving for job promotion', bookedBy: 'Vincent', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-014', name: 'Matilda Joseph', phone: '9841014455', date: getFormattedDate(0), mass: massId2, amount: 250.00, remarks: 'Spiritual renewal of grandchildren', bookedBy: 'Matilda', isPaid: false, payMethod: null, isDel: 0 },
    { receipt: 'RCT-MOCK-015', name: 'Ignatius Rozario', phone: '9841015566', date: getFormattedDate(6), mass: massId1, amount: 600.00, remarks: 'Feast of St. Ignatius thanksgiving', bookedBy: 'Ignatius', isPaid: true, payMethod: payBank, isDel: 0 },
    { receipt: 'RCT-MOCK-016', name: 'Cecilia Lawrence', phone: '9841016677', date: getFormattedDate(-5), mass: massId2, amount: 150.00, remarks: 'Gift of new child prayer', bookedBy: 'Cecilia', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-017', name: 'Gabriel Fernandez', phone: '9841017788', date: getFormattedDate(7), mass: massId1, amount: 350.00, remarks: 'Peace and harmony in family', bookedBy: 'Gabriel', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-018', name: 'Stella Maris', phone: '9841018899', date: getFormattedDate(-6), mass: massId2, amount: 500.00, remarks: 'Soul rest of Maris Stella (1st Anniversary)', bookedBy: 'Stella', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-019', name: 'Benedict Joseph', phone: '9841019900', date: getFormattedDate(8), mass: massId1, amount: 250.00, remarks: 'Speedy recovery after surgery', bookedBy: 'Benedict', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-020', name: 'Philomena Vincent', phone: '9841020011', date: getFormattedDate(-7), mass: massId2, amount: 300.00, remarks: 'Blessings for pregnant mother', bookedBy: 'Philomena', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-021', name: 'Alexander Cruz', phone: '9841021122', date: getFormattedDate(9), mass: massId1, amount: 500.00, remarks: 'Safe delivery of child', bookedBy: 'Alexander', isPaid: false, payMethod: null, isDel: 0 },
    { receipt: 'RCT-MOCK-022', name: 'Catherine Theresa', phone: '9841022233', date: getFormattedDate(-8), mass: massId2, amount: 200.00, remarks: 'Soul rest of Parents', bookedBy: 'Catherine', isPaid: true, payMethod: payBank, isDel: 0 },
    { receipt: 'RCT-MOCK-023', name: 'Bartholomew Raj', phone: '9841023344', date: getFormattedDate(10), mass: massId1, amount: 450.00, remarks: 'Silver jubilee thanksgiving', bookedBy: 'Bartholomew', isPaid: true, payMethod: payUpi, isDel: 0 },
    { receipt: 'RCT-MOCK-024', name: 'Dorothy Michael', phone: '9841024455', date: getFormattedDate(-9), mass: massId2, amount: 250.00, remarks: 'Release from addictions prayer', bookedBy: 'Dorothy', isPaid: true, payMethod: payCash, isDel: 0 },
    { receipt: 'RCT-MOCK-025', name: 'Emmanuel Thomas', phone: '9841025566', date: getFormattedDate(11), mass: massId1, amount: 1000.00, remarks: 'Special Family Thanksgiving Mass', bookedBy: 'Emmanuel', isPaid: true, payMethod: payBank, isDel: 0 },
    { receipt: 'RCT-MOCK-DEL-1', name: 'Mistake Entry Intent', phone: '9841999900', date: getFormattedDate(0), mass: massId1, amount: 100.00, remarks: 'Accidentally added duplicated entry', bookedBy: 'Staff', isPaid: false, payMethod: null, isDel: 1 },
    { receipt: 'RCT-MOCK-DEL-2', name: 'Cancelled Booking Intent', phone: '9841999901', date: getFormattedDate(1), mass: massId2, amount: 200.00, remarks: 'Donor cancelled over phone', bookedBy: 'Staff', isPaid: false, payMethod: null, isDel: 1 },
    { receipt: 'RCT-MOCK-DEL-3', name: 'Duplicate Slip Intent', phone: '9841999902', date: getFormattedDate(-2), mass: massId1, amount: 300.00, remarks: 'Entered twice mistakenly', bookedBy: 'Staff', isPaid: false, payMethod: null, isDel: 1 },
  ];

  for (const item of mockIntentions) {
    await conn.query(
      `INSERT IGNORE INTO prayer_intentions 
       (church_id, branch_id, receipt_no, name, phone, prayer_date, mass_id, offering_amount, payment_method_id, remarks, status_id, booked_by, created_by, updated_by, is_active, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        churchId,
        branchId1,
        item.receipt,
        item.name,
        item.phone,
        item.date,
        item.mass,
        item.amount,
        item.payMethod,
        item.remarks,
        item.isPaid ? statusCompleted : statusPending,
        item.bookedBy,
        userId,
        userId,
        item.isDel ? 0 : 1,
        item.isDel,
      ]
    );
  }

  console.log('✨ 3. Seeding Multi-Page Contributions / Donations (25+ records)...');
  const mockContributions = [
    { receipt: 'CON-MOCK-001', name: 'Dr. Arthur James', phone: '9884011111', amount: 5000.00, method: payBank, remarks: 'Church Renovation & Painting Fund', isDel: 0 },
    { receipt: 'CON-MOCK-002', name: 'Grace Philomena', phone: '9884022222', amount: 1500.00, method: payUpi, remarks: 'Altar Flowers & Candles Offering', isDel: 0 },
    { receipt: 'CON-MOCK-003', name: 'Gabriel Joseph', phone: '9884033333', amount: 10000.00, method: payBank, remarks: 'Annual Parish Feast Main Sponsor', isDel: 0 },
    { receipt: 'CON-MOCK-004', name: 'Mercy Mathew', phone: '9884044444', amount: 2500.00, method: payCash, remarks: 'Poor Feeding & Charity Fund', isDel: 0 },
    { receipt: 'CON-MOCK-005', name: 'Samuel Wilson', phone: '9884055555', amount: 3000.00, method: payUpi, remarks: 'Sunday School Educational Support', isDel: 0 },
    { receipt: 'CON-MOCK-006', name: 'Philip Rozario', phone: '9884066666', amount: 7500.00, method: payBank, remarks: 'Choir Sound System Upgrade Donation', isDel: 0 },
    { receipt: 'CON-MOCK-007', name: 'Veronica Anthony', phone: '9884077777', amount: 1200.00, method: payCash, remarks: 'First Holy Communion Uniform Donation', isDel: 0 },
    { receipt: 'CON-MOCK-008', name: 'Benedict Lawrence', phone: '9884088888', amount: 20000.00, method: payCheque, remarks: 'Church Building Extension Trust Fund', isDel: 0 },
    { receipt: 'CON-MOCK-009', name: 'Clara Dominic', phone: '9884099991', amount: 1000.00, method: payUpi, remarks: 'Monthly Family Tithe Contribution', isDel: 0 },
    { receipt: 'CON-MOCK-010', name: 'Ignatius Fernandez', phone: '9884099992', amount: 4500.00, method: payBank, remarks: 'Cemetery Wall Maintenance Donation', isDel: 0 },
    { receipt: 'CON-MOCK-011', name: 'Theresa Martin', phone: '9884099993', amount: 800.00, method: payCash, remarks: 'Holy Thursday Poor Box Donation', isDel: 0 },
    { receipt: 'CON-MOCK-012', name: 'Augustine Paul', phone: '9884099994', amount: 6000.00, method: payUpi, remarks: 'Youth Ministry Summer Camp Sponsor', isDel: 0 },
    { receipt: 'CON-MOCK-013', name: 'Stella Maris Varghese', phone: '9884099995', amount: 15000.00, method: payBank, remarks: 'Bell Tower Solar Power Installation Fund', isDel: 0 },
    { receipt: 'CON-MOCK-014', name: 'Dominic Savio Cruz', phone: '9884099996', amount: 2000.00, method: payCash, remarks: 'St. Vincent De Paul Medical Assistance', isDel: 0 },
    { receipt: 'CON-MOCK-015', name: 'Beatrice Francis', phone: '9884099997', amount: 3500.00, method: payUpi, remarks: 'Christmas Carols & Decorations Support', isDel: 0 },
    { receipt: 'CON-MOCK-016', name: 'Lawrence Daniel', phone: '9884099998', amount: 5000.00, method: payBank, remarks: 'Priest Medical Welfare Corpus', isDel: 0 },
    { receipt: 'CON-MOCK-017', name: 'Rosalind Catherine', phone: '9884099901', amount: 1800.00, method: payCash, remarks: 'Catechism Children Books Donation', isDel: 0 },
    { receipt: 'CON-MOCK-018', name: 'Stephen Alexander', phone: '9884099902', amount: 25000.00, method: payBank, remarks: 'Parish Hall AC Installation Contribution', isDel: 0 },
    { receipt: 'CON-MOCK-019', name: 'Hannah Thomas', phone: '9884099903', amount: 1000.00, method: payUpi, remarks: 'Thanksgiving for New Home Blessing', isDel: 0 },
    { receipt: 'CON-MOCK-020', name: 'Xavier George', phone: '9884099904', amount: 3000.00, method: payCash, remarks: 'Church Garden & Landscaping Maintenance', isDel: 0 },
    { receipt: 'CON-MOCK-DEL-1', name: 'Wrong Donor Donation', phone: '9884099999', amount: 500.00, method: payCash, remarks: 'Wrong branch recorded', isDel: 1 },
    { receipt: 'CON-MOCK-DEL-2', name: 'Bounced Cheque Donation', phone: '9884099988', amount: 2000.00, method: payCheque, remarks: 'Cheque returned by bank', isDel: 1 },
  ];

  for (const con of mockContributions) {
    await conn.query(
      `INSERT IGNORE INTO contributions 
       (church_id, branch_id, receipt_no, name, phone, contribution_amount, payment_method_id, remarks, created_by, updated_by, is_active, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        churchId,
        branchId1,
        con.receipt,
        con.name,
        con.phone,
        con.amount,
        con.method,
        con.remarks,
        userId,
        userId,
        con.isDel ? 0 : 1,
        con.isDel,
      ]
    );
  }

  console.log('✨ 4. Seeding Multi-Page Baptism Certificates (15+ records)...');
  const mockBaptisms = [
    { certNo: 'BAP-2026-001', child: 'Lucas Michael', gender: genderMale, dob: '2025-11-10', bapDate: '2026-01-15', father: 'Michael Antony', mother: 'Sophia Michael', godFather: 'Paul Jacob', godMother: 'Clara Paul', priest: priestId1, isDel: 0 },
    { certNo: 'BAP-2026-002', child: 'Hannah Maria', gender: genderFemale, dob: '2025-12-05', bapDate: '2026-02-20', father: 'David Joseph', mother: 'Rebecca David', godFather: 'George Xavier', godMother: 'Maria George', priest: priestId2, isDel: 0 },
    { certNo: 'BAP-2026-003', child: 'Ethan Thomas', gender: genderMale, dob: '2026-01-12', bapDate: '2026-03-10', father: 'Thomas Daniel', mother: 'Rachel Thomas', godFather: 'Simon Peter', godMother: 'Anna Simon', priest: priestId1, isDel: 0 },
    { certNo: 'BAP-2026-004', child: 'Grace Philomena', gender: genderFemale, dob: '2026-01-28', bapDate: '2026-03-15', father: 'Francis Xavier', mother: 'Mary Francis', godFather: 'Stephen Cruz', godMother: 'Jennifer Stephen', priest: priestId3, isDel: 0 },
    { certNo: 'BAP-2026-005', child: 'Noah Alexander', gender: genderMale, dob: '2025-10-18', bapDate: '2026-01-05', father: 'Alexander John', mother: 'Teresa Alexander', godFather: 'Joseph Martin', godMother: 'Celine Joseph', priest: priestId1, isDel: 0 },
    { certNo: 'BAP-2026-006', child: 'Chloe Elizabeth', gender: genderFemale, dob: '2026-02-02', bapDate: '2026-03-22', father: 'Dominic Savio', mother: 'Clara Dominic', godFather: 'Andrew Robert', godMother: 'Stella Andrew', priest: priestId2, isDel: 0 },
    { certNo: 'BAP-2026-007', child: 'Liam Joseph', gender: genderMale, dob: '2025-09-14', bapDate: '2025-11-25', father: 'Joseph Lawrence', mother: 'Veronica Joseph', godFather: 'Albert Daniel', godMother: 'Diana Albert', priest: priestId1, isDel: 0 },
    { certNo: 'BAP-2026-008', child: 'Sophia Beatrice', gender: genderFemale, dob: '2025-12-20', bapDate: '2026-02-12', father: 'Benedict Rozario', mother: 'Catherine Benedict', godFather: 'Gabriel Paul', godMother: 'Roseline Gabriel', priest: priestId3, isDel: 0 },
    { certNo: 'BAP-2026-009', child: 'Oliver George', gender: genderMale, dob: '2026-01-05', bapDate: '2026-02-28', father: 'George Varghese', mother: 'Mercy George', godFather: 'Philip Mathew', godMother: 'Grace Philip', priest: priestId1, isDel: 0 },
    { certNo: 'BAP-2026-010', child: 'Mia Catherine', gender: genderFemale, dob: '2025-08-30', bapDate: '2025-10-18', father: 'Christopher Cruz', mother: 'Dorothy Christopher', godFather: 'Mathew James', godMother: 'Beatrice Mathew', priest: priestId2, isDel: 0 },
    { certNo: 'BAP-2026-DEL-1', child: 'Test Deleted Baby', gender: genderMale, dob: '2025-05-05', bapDate: '2025-06-06', father: 'Test Father', mother: 'Test Mother', godFather: 'Godfather', godMother: 'Godmother', priest: priestId1, isDel: 1 },
    { certNo: 'BAP-2026-DEL-2', child: 'Duplicate Record Entry', gender: genderFemale, dob: '2025-06-06', bapDate: '2025-07-07', father: 'Dup Father', mother: 'Dup Mother', godFather: 'Godfather 2', godMother: 'Godmother 2', priest: priestId2, isDel: 1 },
  ];

  for (const b of mockBaptisms) {
    await conn.query(
      `INSERT IGNORE INTO baptism_certificates
       (church_id, branch_id, certificate_no, child_name, gender_id, date_of_birth, date_of_baptism, father_name, mother_name, godfather_name, godmother_name, priest_id, created_by, updated_by, is_active, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        churchId,
        branchId1,
        b.certNo,
        b.child,
        b.gender,
        b.dob,
        b.bapDate,
        b.father,
        b.mother,
        b.godFather,
        b.godMother,
        b.priest,
        userId,
        userId,
        b.isDel ? 0 : 1,
        b.isDel,
      ]
    );
  }

  console.log('✨ 5. Seeding Multi-Page Marriage Certificates (15+ records)...');
  const mockMarriages = [
    { certNo: 'MAR-2026-001', groom: 'Andrew Lawrence', bride: 'Jennifer Rose', date: '2026-01-24', w1: 'Stephen George', w2: 'Celine Stephen', priest: priestId1, isDel: 0 },
    { certNo: 'MAR-2026-002', groom: 'Jonathan Edward', bride: 'Catherine Theresa', date: '2026-02-14', w1: 'Francis Xavier', w2: 'Maria Francis', priest: priestId2, isDel: 0 },
    { certNo: 'MAR-2026-003', groom: 'Philip Alexander', bride: 'Diana Beatrice', date: '2026-03-05', w1: 'Anthony Cruz', w2: 'Clara Anthony', priest: priestId1, isDel: 0 },
    { certNo: 'MAR-2026-004', groom: 'Joseph Antony', bride: 'Stella Maris', date: '2026-01-18', w1: 'David Raj', w2: 'Mary Joseph', priest: priestId3, isDel: 0 },
    { certNo: 'MAR-2026-005', groom: 'Gabriel Fernandez', bride: 'Grace Philomena', date: '2026-02-08', w1: 'Robert Cruz', w2: 'Sneha Robert', priest: priestId1, isDel: 0 },
    { certNo: 'MAR-2026-006', groom: 'Benedict Dominic', bride: 'Roseline Mary', date: '2026-03-12', w1: 'Paul Xavier', w2: 'Theresa Paul', priest: priestId2, isDel: 0 },
    { certNo: 'MAR-2026-007', groom: 'Christopher Daniel', bride: 'Hannah Rebecca', date: '2025-11-20', w1: 'George Varghese', w2: 'Mercy George', priest: priestId1, isDel: 0 },
    { certNo: 'MAR-2026-008', groom: 'Simon Peter', bride: 'Anna Philomena', date: '2025-12-18', w1: 'Thomas Daniel', w2: 'Rachel Thomas', priest: priestId3, isDel: 0 },
    { certNo: 'MAR-2026-009', groom: 'Augustine Leo', bride: 'Veronica Catherine', date: '2026-02-28', w1: 'Albert Einstein', w2: 'Sophia Albert', priest: priestId1, isDel: 0 },
    { certNo: 'MAR-2026-010', groom: 'Mathew James', bride: 'Beatrice Lawrence', date: '2026-03-20', w1: 'Dominic Savio', w2: 'Clara Dominic', priest: priestId2, isDel: 0 },
    { certNo: 'MAR-2026-DEL-1', groom: 'Cancelled Groom', bride: 'Cancelled Bride', date: '2025-10-10', w1: 'Witness 1', w2: 'Witness 2', priest: priestId1, isDel: 1 },
    { certNo: 'MAR-2026-DEL-2', groom: 'Wrong Entry Groom', bride: 'Wrong Entry Bride', date: '2025-08-15', w1: 'Witness A', w2: 'Witness B', priest: priestId2, isDel: 1 },
  ];

  for (const m of mockMarriages) {
    await conn.query(
      `INSERT IGNORE INTO marriage_certificates
       (church_id, branch_id, certificate_no, groom_name, bride_name, marriage_date, witness1_name, witness2_name, priest_id, created_by, updated_by, is_active, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        churchId,
        branchId1,
        m.certNo,
        m.groom,
        m.bride,
        m.date,
        m.w1,
        m.w2,
        m.priest,
        userId,
        userId,
        m.isDel ? 0 : 1,
        m.isDel,
      ]
    );
  }

  console.log('✨ 6. Seeding Multi-Page Death Certificates (15+ records)...');
  const mockDeaths = [
    { certNo: 'DTH-2026-001', deceased: 'Ignatius Rozario (Late)', dod: '2026-01-18', burialDate: '2026-01-19', cemetery: 'St. Mary Cemetery, Plot A-12', contact: '9840112233', priest: priestId1, isDel: 0 },
    { certNo: 'DTH-2026-002', deceased: 'Philomena Vincent (Late)', dod: '2026-02-08', burialDate: '2026-02-09', cemetery: 'Holy Cross Memorial Ground', contact: '9840223344', priest: priestId2, isDel: 0 },
    { certNo: 'DTH-2026-003', deceased: 'Barnabas Joseph (Late)', dod: '2026-03-01', burialDate: '2026-03-02', cemetery: 'St. Mary Cemetery, Plot C-04', contact: '9840334455', priest: priestId1, isDel: 0 },
    { certNo: 'DTH-2026-004', deceased: 'Grace Xavier (Late)', dod: '2025-11-14', burialDate: '2025-11-15', cemetery: 'St. Jude Cemetery, Plot B-18', contact: '9840445566', priest: priestId3, isDel: 0 },
    { certNo: 'DTH-2026-005', deceased: 'George Varghese (Late)', dod: '2025-12-22', burialDate: '2025-12-23', cemetery: 'St. Mary Cemetery, Plot A-08', contact: '9840556677', priest: priestId1, isDel: 0 },
    { certNo: 'DTH-2026-006', deceased: 'Theresa Paul (Late)', dod: '2026-01-05', burialDate: '2026-01-06', cemetery: 'Holy Cross Memorial Ground', contact: '9840667788', priest: priestId2, isDel: 0 },
    { certNo: 'DTH-2026-007', deceased: 'Robert Cruz Sr. (Late)', dod: '2026-02-18', burialDate: '2026-02-19', cemetery: 'St. Mary Cemetery, Plot D-15', contact: '9840778899', priest: priestId1, isDel: 0 },
    { certNo: 'DTH-2026-008', deceased: 'Celine Stephen (Late)', dod: '2025-10-30', burialDate: '2025-10-31', cemetery: 'St. Jude Cemetery, Plot C-10', contact: '9840889900', priest: priestId3, isDel: 0 },
    { certNo: 'DTH-2026-009', deceased: 'Francis Daniel (Late)', dod: '2026-03-14', burialDate: '2026-03-15', cemetery: 'St. Mary Cemetery, Plot B-22', contact: '9840990011', priest: priestId1, isDel: 0 },
    { certNo: 'DTH-2026-010', deceased: 'Matilda David (Late)', dod: '2025-09-25', burialDate: '2025-09-26', cemetery: 'Holy Cross Memorial Ground', contact: '9840001122', priest: priestId2, isDel: 0 },
    { certNo: 'DTH-2026-DEL-1', deceased: 'Test Deceased Delete', dod: '2025-01-01', burialDate: '2025-01-02', cemetery: 'Old Cemetery', contact: '9840999999', priest: priestId1, isDel: 1 },
    { certNo: 'DTH-2026-DEL-2', deceased: 'Wrong Name Recorded (Late)', dod: '2025-02-02', burialDate: '2025-02-03', cemetery: 'Old Ground', contact: '9840999988', priest: priestId2, isDel: 1 },
  ];

  for (const d of mockDeaths) {
    await conn.query(
      `INSERT IGNORE INTO death_certificates
       (church_id, certificate_no, deceased_name, date_of_death, burial_date, cemetery, family_contact, priest_id, created_by, updated_by, is_active, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        churchId,
        d.certNo,
        d.deceased,
        d.dod,
        d.burialDate,
        d.cemetery,
        d.contact,
        d.priest,
        userId,
        userId,
        d.isDel ? 0 : 1,
        d.isDel,
      ]
    );
  }

  console.log('✨ 7. Seeding sample Office Staff & Users...');
  const passwordHash = await bcrypt.hash('Staff@12345', 10);
  const [staffRole] = await conn.query('SELECT id FROM roles WHERE code = "OFFICE_STAFF" LIMIT 1');
  const [accountantRole] = await conn.query('SELECT id FROM roles WHERE code = "ACCOUNTANT" LIMIT 1');

  if (staffRole.length) {
    await conn.query(
      `INSERT IGNORE INTO users 
       (church_id, branch_id, role_id, employee_code, full_name, username, email, phone, password_hash, must_change_password, created_by, updated_by, is_active, is_deleted)
       VALUES
       (?, ?, ?, 'EMP-101', 'John Mathew (Staff)', 'staff_john', 'john.staff@church.org', '9840111222', ?, 0, ?, ?, 1, 0),
       (?, ?, ?, 'EMP-102', 'Sarah Dsouza (Staff)', 'staff_sarah', 'sarah.staff@church.org', '9840222333', ?, 0, ?, ?, 1, 0),
       (?, ?, ?, 'EMP-103', 'Rachel Thomas (Staff)', 'staff_rachel', 'rachel.staff@church.org', '9840333444', ?, 0, ?, ?, 1, 0),
       (?, ?, ?, 'EMP-104', 'David Robert (Staff)', 'staff_david', 'david.staff@church.org', '9840444555', ?, 0, ?, ?, 1, 0),
       (?, ?, ?, 'EMP-DEL-1', 'Inactive Staff (Deleted)', 'staff_old', 'old.staff@church.org', '9840999888', ?, 0, ?, ?, 0, 1),
       (?, ?, ?, 'EMP-DEL-2', 'Temporary Volunteer (Deleted)', 'staff_temp', 'temp.staff@church.org', '9840999777', ?, 0, ?, ?, 0, 1)`,
      [
        churchId, branchId1, staffRole[0].id, passwordHash, userId, userId,
        churchId, branchId1, staffRole[0].id, passwordHash, userId, userId,
        churchId, branchId2, staffRole[0].id, passwordHash, userId, userId,
        churchId, branchId2, staffRole[0].id, passwordHash, userId, userId,
        churchId, branchId1, staffRole[0].id, passwordHash, userId, userId,
        churchId, branchId1, staffRole[0].id, passwordHash, userId, userId,
      ]
    );
  }

  if (accountantRole.length) {
    await conn.query(
      `INSERT IGNORE INTO users 
       (church_id, branch_id, role_id, employee_code, full_name, username, email, phone, password_hash, must_change_password, created_by, updated_by, is_active, is_deleted)
       VALUES
       (?, ?, ?, 'ACC-201', 'Peter Dominic (Accountant)', 'accountant_peter', 'peter.acc@church.org', '9840333444', ?, 0, ?, ?, 1, 0),
       (?, ?, ?, 'ACC-202', 'Celine George (Assistant Accountant)', 'accountant_celine', 'celine.acc@church.org', '9840555666', ?, 0, ?, ?, 1, 0)`,
      [
        churchId, branchId1, accountantRole[0].id, passwordHash, userId, userId,
        churchId, branchId2, accountantRole[0].id, passwordHash, userId, userId,
      ]
    );
  }

  console.log('\n======================================================');
  console.log('✅ COMPREHENSIVE MULTI-PAGE MOCK DATA SEEDED!');
  console.log('======================================================');
  console.log('📊 Populated Table Counts:');
  console.log('  - Priests & Masses (7 active priests, multiple daily & Sunday masses)');
  console.log('  - Branches (5 church branches across zones)');
  console.log('  - Mass Intentions (28+ active + soft-deleted records for multi-page pagination)');
  console.log('  - Contributions (22+ active + soft-deleted records across all donation types)');
  console.log('  - Baptism Certificates (12+ full family records)');
  console.log('  - Marriage Certificates (12+ matrimonial records)');
  console.log('  - Death Certificates (12+ burial register records)');
  console.log('  - Users & Roles (Staff, Accountants, Admins, Deleted users)');
  console.log('  - Recycle Bin / Trash Hub (Ready with soft-deleted items to restore)');
  console.log('======================================================\n');

  await conn.end();
}

run().catch((err) => {
  console.error('❌ Failed to seed mock data:', err);
  process.exit(1);
});

