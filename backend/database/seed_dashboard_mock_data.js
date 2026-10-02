'use strict';

const crypto = require('crypto');
const { pool } = require('../src/config/db');

async function seedAllMockData() {
  console.log('--- Seeding Comprehensive Mock Data across COMS ---');
  const churchId = 1;
  const branchId = 1;
  const userId = 1;

  // 1. Priests Master
  console.log('1. Ensuring priests master data...');
  const extraPriests = [
    { name: 'Rev. Fr. Pratheep Selvaraj', title: 'Rev. Fr.', is_parish_priest: 0 },
    { name: 'Rev. Fr. Antony Raj V', title: 'Rev. Fr.', is_parish_priest: 0 },
    { name: 'Rev. Fr. Dominic Savio', title: 'Rev. Fr.', is_parish_priest: 0 },
    { name: 'Rev. Fr. Lawrence David', title: 'Rev. Fr.', is_parish_priest: 0 },
  ];
  for (const p of extraPriests) {
    const [exist] = await pool.query('SELECT id FROM priests WHERE church_id = ? AND name = ?', [churchId, p.name]);
    if (!exist.length) {
      await pool.query('INSERT INTO priests (church_id, name, title, is_parish_priest) VALUES (?,?,?,?)', [
        churchId, p.name, p.title, p.is_parish_priest,
      ]);
    }
  }

  const [priests] = await pool.query('SELECT id, name FROM priests WHERE church_id = ? ORDER BY id', [churchId]);
  const [masses] = await pool.query('SELECT id, name FROM masses WHERE church_id = ? ORDER BY id', [churchId]);
  const [intentions] = await pool.query('SELECT id, name FROM prayer_intention_master ORDER BY id');
  const [contributionTypes] = await pool.query('SELECT id, name FROM contribution_types WHERE is_deleted = 0 ORDER BY id');
  const [genders] = await pool.query('SELECT id, code FROM genders ORDER BY id');
  const maleGenderId = genders.find((g) => g.code === 'M')?.id || 1;
  const femaleGenderId = genders.find((g) => g.code === 'F')?.id || 2;

  // 2. Clear old mock data
  console.log('2. Cleaning previous mock data...');
  await pool.query("DELETE pt FROM payment_transactions pt JOIN prayer_intentions pi ON pt.prayer_intention_id = pi.id WHERE pi.receipt_no LIKE 'RCT-MOCK-%'");
  await pool.query("DELETE cpt FROM contribution_payment_transactions cpt JOIN contributions c ON cpt.contribution_id = c.id WHERE c.receipt_no LIKE 'CON-MOCK-%'");
  await pool.query("DELETE FROM prayer_intentions WHERE receipt_no LIKE 'RCT-MOCK-%'");
  await pool.query("DELETE FROM contributions WHERE receipt_no LIKE 'CON-MOCK-%'");
  await pool.query("DELETE FROM baptism_certificates WHERE certificate_no LIKE 'BAP-MOCK-%'");
  await pool.query("DELETE FROM marriage_certificates WHERE certificate_no LIKE 'MAR-MOCK-%'");
  await pool.query("DELETE FROM confirmation_certificates WHERE certificate_no LIKE 'CNF-MOCK-%'");
  await pool.query("DELETE FROM death_certificates WHERE certificate_no LIKE 'DTH-MOCK-%'");

  const donorNames = [
    { name: 'Joseph Anthony', bookedBy: 'Mary Joseph', phone: '9840112233' },
    { name: 'Maria Fernandez', bookedBy: 'Francis Fernandez', phone: '9841223344' },
    { name: 'Antony Raj', bookedBy: 'Selvi Antony', phone: '9842334455' },
    { name: 'Theresa Lawrence', bookedBy: 'Lawrence David', phone: '9843445566' },
    { name: 'Francis Xavier', bookedBy: 'Xavier Paul', phone: '9844556677' },
    { name: 'Stella Maris', bookedBy: 'Peter Stella', phone: '9845667788' },
    { name: 'John Paul', bookedBy: 'Grace John', phone: '9846778899' },
    { name: 'Agnes Rozario', bookedBy: 'Rozario Martin', phone: '9847889900' },
    { name: 'David Sundaram', bookedBy: 'Hannah David', phone: '9848990011' },
    { name: 'Rita Dominic', bookedBy: 'Dominic Savio', phone: '9849001122' },
    { name: 'Christopher Emmanuel', bookedBy: 'Emmanuel Raj', phone: '9850112233' },
    { name: 'Clara Philomena', bookedBy: 'Vincent Clara', phone: '9851223344' },
    { name: 'Augustine Cruz', bookedBy: 'Cruz Daniel', phone: '9852334455' },
    { name: 'Catherine Gomez', bookedBy: 'Gomez Robert', phone: '9853445566' },
    { name: 'Sebastian Varma', bookedBy: 'Varma James', phone: '9854556677' },
    { name: 'Benedict Alvares', bookedBy: 'Alvares George', phone: '9855667788' },
    { name: 'Pauline Dsouza', bookedBy: 'Dsouza Simon', phone: '9856778899' },
    { name: 'Michael Doss', bookedBy: 'Doss Victor', phone: '9857889900' },
    { name: 'Elizabeth Rani', bookedBy: 'Rani Charles', phone: '9858990011' },
    { name: 'Ignatius Loyola', bookedBy: 'Loyola Thomas', phone: '9859001122' },
    { name: 'ரோஸ்லின் மேரி', bookedBy: 'அந்தோணி', phone: '9860112233' },
    { name: 'சாமுவேல் ராஜ்', bookedBy: 'எலிசபெத்', phone: '9861223344' },
    { name: 'ஜான்சன் துரை', bookedBy: 'மரியாள்', phone: '9862334455' },
    { name: 'வின்சென்ட் பால்', bookedBy: 'திரேசா', phone: '9863445566' },
  ];

  // Allowed ENUM values: 'cash', 'upi', 'cheque', 'bank_transfer', 'other'
  const methods = ['cash', 'upi', 'cheque', 'bank_transfer', 'cash', 'upi', 'other'];
  const pmIds = [1, 3, 4, 5, 1, 3, 2];

  // 3. Mass Intentions across August, September, October 2026
  console.log('3. Seeding Mass Intentions & Payment Transactions...');
  const daysDistribution = [
    // August 2026
    { month: '2026-08', day: 15, count: 12, baseAmount: 500 }, // Feast
    { month: '2026-08', day: 23, count: 10, baseAmount: 400 },
    { month: '2026-08', day: 30, count: 11, baseAmount: 450 },
    // September 2026
    { month: '2026-09', day: 1, count: 4, baseAmount: 250 },
    { month: '2026-09', day: 2, count: 5, baseAmount: 500 },
    { month: '2026-09', day: 3, count: 4, baseAmount: 300 },
    { month: '2026-09', day: 4, count: 6, baseAmount: 400 },
    { month: '2026-09', day: 5, count: 8, baseAmount: 500 },
    { month: '2026-09', day: 6, count: 15, baseAmount: 600 }, // Sunday
    { month: '2026-09', day: 7, count: 5, baseAmount: 350 },
    { month: '2026-09', day: 8, count: 14, baseAmount: 500 }, // Feast day
    { month: '2026-09', day: 9, count: 5, baseAmount: 400 },
    { month: '2026-09', day: 10, count: 6, baseAmount: 300 },
    { month: '2026-09', day: 11, count: 6, baseAmount: 450 },
    { month: '2026-09', day: 12, count: 9, baseAmount: 500 },
    { month: '2026-09', day: 13, count: 16, baseAmount: 700 }, // Sunday
    { month: '2026-09', day: 14, count: 4, baseAmount: 300 },
    { month: '2026-09', day: 15, count: 6, baseAmount: 400 },
    { month: '2026-09', day: 16, count: 5, baseAmount: 350 },
    { month: '2026-09', day: 17, count: 7, baseAmount: 500 },
    { month: '2026-09', day: 18, count: 6, baseAmount: 400 },
    { month: '2026-09', day: 19, count: 10, baseAmount: 600 },
    { month: '2026-09', day: 20, count: 18, baseAmount: 750 }, // Sunday
    { month: '2026-09', day: 21, count: 5, baseAmount: 350 },
    { month: '2026-09', day: 22, count: 7, baseAmount: 450 },
    { month: '2026-09', day: 23, count: 6, baseAmount: 500 },
    { month: '2026-09', day: 24, count: 8, baseAmount: 400 },
    { month: '2026-09', day: 25, count: 5, baseAmount: 350 },
    { month: '2026-09', day: 26, count: 7, baseAmount: 400 },
    { month: '2026-09', day: 27, count: 18, baseAmount: 750 }, // Sunday
    { month: '2026-09', day: 28, count: 5, baseAmount: 350 },
    { month: '2026-09', day: 29, count: 7, baseAmount: 450 },
    { month: '2026-09', day: 30, count: 8, baseAmount: 500 },
    // October 2026
    { month: '2026-10', day: 1, count: 6, baseAmount: 400 },
    { month: '2026-10', day: 4, count: 14, baseAmount: 650 }, // Sunday
    { month: '2026-10', day: 11, count: 12, baseAmount: 600 }, // Sunday
  ];

  let receiptSeq = 100;
  let totalMiCount = 0;
  let totalContribCount = 0;

  for (const item of daysDistribution) {
    const dayStr = String(item.day).padStart(2, '0');
    const dateStr = `${item.month}-${dayStr}`;
    const dateTimeStr = `${dateStr} 09:15:00`;

    for (let i = 0; i < item.count; i++) {
      receiptSeq++;
      const donor = donorNames[(receiptSeq + i) % donorNames.length];
      const mass = masses[i % masses.length] || { id: 1 };
      const intention = intentions[(receiptSeq * 3 + i) % intentions.length] || { id: 1 };
      const methodIdx = (receiptSeq + i) % methods.length;
      const method = methods[methodIdx];
      const pmId = pmIds[methodIdx];

      const amount = item.baseAmount * ((i % 3) + 1) * (1 + (i % 2) * 0.5);
      const receiptNo = `RCT-MOCK-${String(receiptSeq).padStart(4, '0')}`;
      const token = crypto.randomBytes(16).toString('hex');

      const [res] = await pool.query(
        `INSERT INTO prayer_intentions (
          church_id, branch_id, receipt_no, booked_by, public_token, name, phone,
          prayer_date, mass_id, prayer_intention_master_id, offering_amount,
          payment_method_id, remarks, created_at, created_by, updated_at, updated_by, is_active, is_deleted
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [
          churchId,
          receiptNo,
          donor.bookedBy,
          token,
          donor.name,
          donor.phone,
          dateStr,
          mass.id,
          intention.id,
          amount,
          pmId,
          `Mass Intention for ${intention.name || 'Prayer'}`,
          dateTimeStr,
          userId,
          dateTimeStr,
          userId,
        ]
      );

      const miId = res.insertId;

      const transRef = `MANUAL-MOCK-${receiptSeq}-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO payment_transactions (
          prayer_intention_id, provider, method, transaction_ref, payment_date,
          amount, status, created_at, created_by, verified_at
        ) VALUES (?, 'manual', ?, ?, ?, ?, 'success', ?, ?, ?)`,
        [miId, method, transRef, dateStr, amount, dateTimeStr, userId, dateTimeStr]
      );

      totalMiCount++;
    }

    // Add Contributions
    if (item.day % 2 === 0 || item.day % 3 === 0) {
      const contribDonor = donorNames[(receiptSeq + 5) % donorNames.length];
      const cType = contributionTypes[receiptSeq % contributionTypes.length] || { id: 1, name: 'General Offering' };
      const cAmount = 500 * ((item.day % 6) + 1) + (item.day % 4 === 0 ? 5000 : 0);
      const cReceiptNo = `CON-MOCK-${String(receiptSeq).padStart(4, '0')}`;
      const methodIdx = receiptSeq % methods.length;
      const method = methods[methodIdx];
      const pmId = pmIds[methodIdx];

      const [cRes] = await pool.query(
        `INSERT INTO contributions (
          church_id, branch_id, receipt_no, name, phone, contribution_type_id,
          contribution_amount, payment_method_id, remarks, created_at, created_by,
          updated_at, updated_by, is_active, is_deleted
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [
          churchId,
          cReceiptNo,
          contribDonor.name,
          contribDonor.phone,
          cType.id,
          cAmount,
          pmId,
          `Contribution for ${cType.name}`,
          dateTimeStr,
          userId,
          dateTimeStr,
          userId,
        ]
      );

      const cId = cRes.insertId;

      const cTransRef = `MANUAL-CON-${receiptSeq}-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO contribution_payment_transactions (
          contribution_id, provider, transaction_ref, amount, status, method,
          payment_date, created_at, created_by, verified_at
        ) VALUES (?, 'manual', ?, ?, 'success', ?, ?, ?, ?, ?)`,
        [cId, cTransRef, cAmount, method, dateStr, dateTimeStr, userId, dateTimeStr]
      );

      totalContribCount++;
    }
  }

  // 4. Baptism Certificates (12 records)
  console.log('4. Seeding Baptism Certificates...');
  const baptismData = [
    {
      no: 'BAP-MOCK-0001',
      child: 'Jude Anthony Fernando',
      gender: maleGenderId,
      dob: '2026-01-15',
      doa: '2026-02-14',
      pob: "St. Mary's Church, Chennai",
      father: 'Anthony Fernando',
      mother: 'Maria Fernando',
      residence: '12 North Beach Road, Chennai',
      godfather: 'Joseph Rajan',
      godmother: 'Stella Joseph',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'First child, baptism performed during solemn high mass',
    },
    {
      no: 'BAP-MOCK-0002',
      child: 'Theresa Clara Doss',
      gender: femaleGenderId,
      dob: '2026-02-10',
      doa: '2026-03-08',
      pob: "St. Mary's Church, Chennai",
      father: 'Michael Doss',
      mother: 'Catherine Doss',
      residence: '45 St. Thomas Mount, Chennai',
      godfather: 'David Sundaram',
      godmother: 'Rita Dominic',
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'BAP-MOCK-0003',
      child: 'Francis Dominic Xavier',
      gender: maleGenderId,
      dob: '2025-11-20',
      doa: '2025-12-28',
      pob: 'Holy Redeemer Church, Madurai',
      father: 'Francis Xavier',
      mother: 'Philomena Xavier',
      residence: '78 Cathedral Road, Chennai',
      godfather: 'Christopher Emmanuel',
      godmother: 'Agnes Rozario',
      priestId: null,
      customPriest: 'Rev. Fr. Pratheep Selvaraj',
      remarks: 'Certificate issued for school admission',
    },
    {
      no: 'BAP-MOCK-0004',
      child: 'Agnes Philomena Varma',
      gender: femaleGenderId,
      dob: '2026-03-04',
      doa: '2026-04-12',
      pob: "St. Mary's Church, Chennai",
      father: 'Sebastian Varma',
      mother: 'Pauline Varma',
      residence: '22 Annai Nagar, Chennai',
      godfather: 'Benedict Alvares',
      godmother: 'Clara Philomena',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'BAP-MOCK-0005',
      child: 'Antony Lawrence Raj',
      gender: maleGenderId,
      dob: '2025-09-18',
      doa: '2025-10-25',
      pob: "St. Mary's Church, Chennai",
      father: 'Lawrence David',
      mother: 'Theresa Lawrence',
      residence: '89 Santhome High Road, Chennai',
      godfather: 'John Paul',
      godmother: 'Grace John',
      priestId: priests[2]?.id || null,
      customPriest: null,
      remarks: 'Twin baptism',
    },
    {
      no: 'BAP-MOCK-0006',
      child: 'Bernadette Mary Alvares',
      gender: femaleGenderId,
      dob: '2026-04-01',
      doa: '2026-05-03',
      pob: "St. Mary's Church, Chennai",
      father: 'Benedict Alvares',
      mother: 'Clara Alvares',
      residence: '5/12 Peters Road, Royapettah, Chennai',
      godfather: 'Ignatius Loyola',
      godmother: 'Elizabeth Rani',
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'BAP-MOCK-0007',
      child: 'Gabriel Joseph Sundaram',
      gender: maleGenderId,
      dob: '2026-05-14',
      doa: '2026-06-21',
      pob: "St. Mary's Church, Chennai",
      father: 'David Sundaram',
      mother: 'Hannah David',
      residence: '14 Luz Church Road, Mylapore, Chennai',
      godfather: 'Augustine Cruz',
      godmother: 'Catherine Gomez',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'BAP-MOCK-0008',
      child: 'Rosary Veronica Cruz',
      gender: femaleGenderId,
      dob: '2025-08-08',
      doa: '2025-09-12',
      pob: "St. Mary's Church, Chennai",
      father: 'Augustine Cruz',
      mother: 'Rita Cruz',
      residence: '31 Purasawalkam High Road, Chennai',
      godfather: 'Francis Xavier',
      godmother: 'Maria Fernandez',
      priestId: priests[3]?.id || null,
      customPriest: null,
      remarks: 'Godfather proxy stood by brother',
    },
    {
      no: 'BAP-MOCK-0009',
      child: 'Dominic Savio Emmanuel',
      gender: maleGenderId,
      dob: '2026-06-19',
      doa: '2026-07-26',
      pob: "St. Mary's Church, Chennai",
      father: 'Christopher Emmanuel',
      mother: 'Selvi Emmanuel',
      residence: '63 EVR Periyar Salai, Kilpauk, Chennai',
      godfather: 'Michael Doss',
      godmother: 'Pauline Dsouza',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'BAP-MOCK-0010',
      child: 'Celine Stella Martin',
      gender: femaleGenderId,
      dob: '2026-07-02',
      doa: '2026-08-09',
      pob: "St. Mary's Church, Chennai",
      father: 'Rozario Martin',
      mother: 'Agnes Rozario',
      residence: '92 Armenian Street, George Town, Chennai',
      godfather: 'Antony Raj',
      godmother: 'Mary Joseph',
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'BAP-MOCK-0011',
      child: 'Lucas Vincent Paul',
      gender: maleGenderId,
      dob: '2026-07-15',
      doa: '2026-08-23',
      pob: "St. Mary's Church, Chennai",
      father: 'Xavier Paul',
      mother: 'Grace Paul',
      residence: '17 East Mada Street, Mylapore, Chennai',
      godfather: 'Joseph Anthony',
      godmother: 'Stella Maris',
      priestId: null,
      customPriest: 'Rev. Fr. Dominic Savio',
      remarks: null,
    },
    {
      no: 'BAP-MOCK-0012',
      child: 'Maria Jennifer Gomez',
      gender: femaleGenderId,
      dob: '2026-08-01',
      doa: '2026-09-06',
      pob: "St. Mary's Church, Chennai",
      father: 'Gomez Robert',
      mother: 'Catherine Gomez',
      residence: '8 Marina Loop Road, Chennai',
      godfather: 'Lawrence David',
      godmother: 'Theresa Lawrence',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'Nativity novena baptism',
    },
  ];

  for (const b of baptismData) {
    await pool.query(
      `INSERT INTO baptism_certificates (
        church_id, branch_id, certificate_no, child_name, gender_id,
        date_of_birth, date_of_baptism, place_of_baptism, father_name,
        mother_name, parent_residence, godfather_name, godmother_name,
        priest_id, custom_priest_name, remarks, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        churchId,
        branchId,
        b.no,
        b.child,
        b.gender,
        b.dob,
        b.doa,
        b.pob,
        b.father,
        b.mother,
        b.residence,
        b.godfather,
        b.godmother,
        b.priestId,
        b.customPriest,
        b.remarks,
        userId,
        userId,
      ]
    );
  }

  // 5. Marriage Certificates (10 records with 2, 3, and 4 witnesses)
  console.log('5. Seeding Marriage Certificates (with 2, 3, and 4 witnesses)...');
  const marriageData = [
    {
      no: 'MAR-MOCK-0001',
      mDate: '2025-05-18',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'ANTONY RAJAN',
      bride: 'MARY STEPHANIE',
      gAge: '28',
      bAge: '25',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'SOFTWARE ENGINEER',
      bProf: 'ACCOUNTANT',
      gRes: 'SANTHOME, CHENNAI',
      bRes: 'ROYAPETTAH, CHENNAI',
      gFather: 'JOSEPH RAJAN',
      bFather: 'FRANCIS XAVIER',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'PETER STELLA',
      w2: 'AGNES ROZARIO',
      w3: 'LAWRENCE DAVID',
      w4: 'THERESA LAWRENCE',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'Solemnised with nuptial mass',
    },
    {
      no: 'MAR-MOCK-0002',
      mDate: '2025-09-08',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'MICHAEL JOHNSON',
      bride: 'CATHERINE DIANA',
      gAge: '31',
      bAge: '27',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'CIVIL ENGINEER',
      bProf: 'TEACHER',
      gRes: 'PURASAWALKAM, CHENNAI',
      bRes: 'MYLAPORE, CHENNAI',
      gFather: 'JOHNSON DURAI',
      bFather: 'ROBERT GOMEZ',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'DOMINIC SAVIO',
      w2: 'RITA DOMINIC',
      w3: 'CHRISTOPHER EMMANUEL',
      w4: null,
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'MAR-MOCK-0003',
      mDate: '2025-11-26',
      where: "ST. THOMAS BASILICA, CHENNAI",
      groom: 'DAVID SUNDARAM',
      bride: 'HANNAH MARIA',
      gAge: '30',
      bAge: '26',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'BANK OFFICER',
      bProf: 'HR MANAGER',
      gRes: 'KILPAUK, CHENNAI',
      bRes: 'GEORGE TOWN, CHENNAI',
      gFather: 'SUNDARAM SAMUEL',
      bFather: 'AUGUSTINE CRUZ',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'BENEDICT ALVARES',
      w2: 'CLARA PHILOMENA',
      w3: null,
      w4: null,
      priestId: null,
      customPriest: 'REV. FR. PRATHEEP SELVARAJ',
      remarks: 'Registered in Diocese Book Vol IV',
    },
    {
      no: 'MAR-MOCK-0004',
      mDate: '2026-01-18',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'FRANCIS XAVIER PAUL',
      bride: 'GRACE STELLA',
      gAge: '29',
      bAge: '26',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'BUSINESSMAN',
      bProf: 'NURSE',
      gRes: 'T. NAGAR, CHENNAI',
      bRes: 'ANNA NAGAR, CHENNAI',
      gFather: 'XAVIER PAUL',
      bFather: 'PETER STELLA',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'JOSEPH ANTHONY',
      w2: 'MARIA FERNANDEZ',
      w3: 'IGNATIUS LOYOLA',
      w4: 'ELIZABETH RANI',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'All 4 witnesses attested in register',
    },
    {
      no: 'MAR-MOCK-0005',
      mDate: '2026-02-14',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'SEBASTIAN VARMA',
      bride: 'PAULINE DSOUZA',
      gAge: '32',
      bAge: '28',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'ARCHITECT',
      bProf: 'GRAPHIC DESIGNER',
      gRes: 'VELACHERY, CHENNAI',
      bRes: 'ADYAR, CHENNAI',
      gFather: 'JAMES VARMA',
      bFather: 'SIMON DSOUZA',
      banns: 'BY LICENCE',
      imped: 'AFFINITY DISPENSED',
      w1: 'ROZARIO MARTIN',
      w2: 'AGNES ROZARIO',
      w3: 'VICTOR DOSS',
      w4: null,
      priestId: priests[2]?.id || null,
      customPriest: null,
      remarks: 'Diocesan dispensation granted on 02-02-2026',
    },
    {
      no: 'MAR-MOCK-0006',
      mDate: '2026-05-10',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'CHRISTOPHER EMMANUEL',
      bride: 'SELVI ANTONY',
      gAge: '33',
      bAge: '30',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'PHARMACIST',
      bProf: 'LECTURER',
      gRes: 'TAMBARAM, CHENNAI',
      bRes: 'CHROMEPET, CHENNAI',
      gFather: 'EMMANUEL RAJ',
      bFather: 'ANTONY RAJ',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'MICHAEL DOSS',
      w2: 'CATHERINE GOMEZ',
      w3: null,
      w4: null,
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'MAR-MOCK-0007',
      mDate: '2026-06-25',
      where: "OUR LADY OF LOURDES CHURCH, CHENNAI",
      groom: 'IGNATIUS LOYOLA',
      bride: 'ELIZABETH RANI',
      gAge: '34',
      bAge: '29',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'DATA ANALYST',
      bProf: 'DOCTOR',
      gRes: 'PERAMBUR, CHENNAI',
      bRes: 'KODAMBAKKAM, CHENNAI',
      gFather: 'LOYOLA THOMAS',
      bFather: 'CHARLES RANI',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'VINCENT CLARA',
      w2: 'CLARA PHILOMENA',
      w3: 'CRUZ DANIEL',
      w4: 'RITA DOMINIC',
      priestId: null,
      customPriest: 'REV. FR. ANTONY RAJ V',
      remarks: null,
    },
    {
      no: 'MAR-MOCK-0008',
      mDate: '2026-08-20',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'SRIDHER RAJA',
      bride: 'BELCIYA SATHISKUMAR',
      gAge: '36',
      bAge: '26',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'MERCHANT NAVY',
      bProf: 'PROFESSOR',
      gRes: 'THOOTHUKUDI',
      bRes: 'CHENNAI',
      gFather: 'RAJA',
      bFather: 'SATHISKUMAR',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'RATHNAM',
      w2: 'AROCKIA RAJAN',
      w3: 'SAVARIMUTHU',
      w4: 'MARIA PACKIAM',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'Cover page & 4 witnesses format verified',
    },
    {
      no: 'MAR-MOCK-0009',
      mDate: '2026-09-12',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'SAMUEL RAJ',
      bride: 'ELIZABETH MARY',
      gAge: '27',
      bAge: '24',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'MECHANICAL ENGINEER',
      bProf: 'RESEARCH SCHOLAR',
      gRes: 'EGMORE, CHENNAI',
      bRes: 'NUNGAMBAKKAM, CHENNAI',
      gFather: 'RAJENDRAN',
      bFather: 'VICTOR MANUEL',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'FRANCIS XAVIER',
      w2: 'STELLA MARIS',
      w3: null,
      w4: null,
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'MAR-MOCK-0010',
      mDate: '2026-09-24',
      where: "ST. MARY'S CHURCH, CHENNAI",
      groom: 'JOHNSON DURAI',
      bride: 'MARIAL THRESA',
      gAge: '30',
      bAge: '27',
      gCond: 'BACHELOR',
      bCond: 'SPINSTER',
      gProf: 'GOVERNMENT OFFICER',
      bProf: 'BANK OFFICER',
      gRes: 'GUINDY, CHENNAI',
      bRes: 'SAIDAPET, CHENNAI',
      gFather: 'DURAISAMY',
      bFather: 'JOSEPH FERNANDO',
      banns: 'BY BANNS',
      imped: 'NIL',
      w1: 'LAWRENCE DAVID',
      w2: 'THERESA LAWRENCE',
      w3: 'DOMINIC SAVIO',
      w4: null,
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
  ];

  for (const m of marriageData) {
    await pool.query(
      `INSERT INTO marriage_certificates (
        church_id, branch_id, certificate_no, marriage_date, where_married,
        groom_name, bride_name, groom_age, bride_age, groom_condition, bride_condition,
        groom_profession, bride_profession, groom_residence, bride_residence,
        groom_father_name, bride_father_name, banns_or_licence, impediments_dispensed,
        witness1_name, witness2_name, witness3_name, witness4_name,
        priest_id, custom_priest_name, remarks, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        churchId,
        branchId,
        m.no,
        m.mDate,
        m.where,
        m.groom,
        m.bride,
        m.gAge,
        m.bAge,
        m.gCond,
        m.bCond,
        m.gProf,
        m.bProf,
        m.gRes,
        m.bRes,
        m.gFather,
        m.bFather,
        m.banns,
        m.imped,
        m.w1,
        m.w2,
        m.w3,
        m.w4,
        m.priestId,
        m.customPriest,
        m.remarks,
        userId,
        userId,
      ]
    );
  }

  // 6. Death Certificates (10 records)
  console.log('6. Seeding Death Certificates...');
  const deathData = [
    {
      no: 'DTH-MOCK-0001',
      name: 'Josephine Mary Fernadez',
      age: '78',
      place: 'Chennai',
      prof: 'Homemaker',
      parents: 'Late Anthony & Philomena',
      dod: '2025-04-10',
      pod: 'Apollo Hospital, Chennai',
      cause: 'Cardio-respiratory Arrest',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2025-04-11',
      cemetery: 'St. Mary Catholic Cemetery, Chennai',
      priestId: priests[0]?.id || null,
      customPriest: null,
      contact: '9840112233',
      remarks: 'Parishioner of 45 years',
    },
    {
      no: 'DTH-MOCK-0002',
      name: 'Simon Peter Dsouza',
      age: '84',
      place: 'Chennai',
      prof: 'Retired Railway Officer',
      parents: 'Late Peter & Stella Dsouza',
      dod: '2025-07-22',
      pod: 'Residence, Royapettah',
      cause: 'Age Related Illness',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2025-07-23',
      cemetery: 'Quibble Island Cemetery, Santhome',
      priestId: priests[1]?.id || null,
      customPriest: null,
      contact: '9856778899',
      remarks: null,
    },
    {
      no: 'DTH-MOCK-0003',
      name: 'Philomena Vincent',
      age: '69',
      place: 'Chennai',
      prof: 'Retired Headmistress',
      parents: 'Late Vincent & Clara',
      dod: '2025-10-05',
      pod: 'MIOT Hospital, Chennai',
      cause: 'Kidney Failure',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2025-10-06',
      cemetery: 'St. Mary Catholic Cemetery, Chennai',
      priestId: null,
      customPriest: 'Rev. Fr. Lawrence David',
      contact: '9851223344',
      remarks: 'Burial service conducted in parish church',
    },
    {
      no: 'DTH-MOCK-0004',
      name: 'Victor Doss',
      age: '72',
      place: 'Chennai',
      prof: 'Retired Port Trust Engineer',
      parents: 'Late Michael & Elizabeth Doss',
      dod: '2025-12-14',
      pod: 'Port Trust Hospital, Chennai',
      cause: 'Heart Failure',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2025-12-15',
      cemetery: 'St. Mary Catholic Cemetery, Chennai',
      priestId: priests[0]?.id || null,
      customPriest: null,
      contact: '9857889900',
      remarks: null,
    },
    {
      no: 'DTH-MOCK-0005',
      name: 'Grace Emmanuel',
      age: '61',
      place: 'Chennai',
      prof: 'School Teacher',
      parents: 'Late Emmanuel Raj & Selvi',
      dod: '2026-02-18',
      pod: 'Kauvery Hospital, Chennai',
      cause: 'Pneumonia',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2026-02-19',
      cemetery: 'Quibble Island Cemetery, Santhome',
      priestId: priests[2]?.id || null,
      customPriest: null,
      contact: '9850112233',
      remarks: null,
    },
    {
      no: 'DTH-MOCK-0006',
      name: 'Charles Rani',
      age: '88',
      place: 'Chennai',
      prof: 'Advocate',
      parents: 'Late Rani & Joseph',
      dod: '2026-03-30',
      pod: 'Residence, Kilpauk',
      cause: 'Natural Causes',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2026-03-31',
      cemetery: 'St. Mary Catholic Cemetery, Chennai',
      priestId: priests[0]?.id || null,
      customPriest: null,
      contact: '9858990011',
      remarks: 'Longest serving member of parish council',
    },
    {
      no: 'DTH-MOCK-0007',
      name: 'Dominic Savio Thomas',
      age: '55',
      place: 'Chennai',
      prof: 'Accountant',
      parents: 'Late Thomas & Rita',
      dod: '2026-05-12',
      pod: 'Government General Hospital, Chennai',
      cause: 'Cardiac Arrest',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2026-05-13',
      cemetery: 'St. Patrick Cemetery, St. Thomas Mount',
      priestId: priests[1]?.id || null,
      customPriest: null,
      contact: '9849001122',
      remarks: null,
    },
    {
      no: 'DTH-MOCK-0008',
      name: 'Agnes Rozario Martin',
      age: '76',
      place: 'Chennai',
      prof: 'Homemaker',
      parents: 'Late Rozario & Catherine',
      dod: '2026-06-20',
      pod: 'St. Isabel Hospital, Mylapore',
      cause: 'Septicemia',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2026-06-21',
      cemetery: 'St. Mary Catholic Cemetery, Chennai',
      priestId: priests[0]?.id || null,
      customPriest: null,
      contact: '9847889900',
      remarks: null,
    },
    {
      no: 'DTH-MOCK-0009',
      name: 'Cruz Daniel Augustine',
      age: '82',
      place: 'Chennai',
      prof: 'Retired Telegraph Master',
      parents: 'Late Daniel & Maria',
      dod: '2026-08-05',
      pod: 'Residence, George Town',
      cause: 'Old Age Debility',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2026-08-06',
      cemetery: 'St. Mary Catholic Cemetery, Chennai',
      priestId: null,
      customPriest: 'Rev. Fr. Antony Raj V',
      contact: '9852334455',
      remarks: null,
    },
    {
      no: 'DTH-MOCK-0010',
      name: 'Francis Paul Xavier',
      age: '65',
      place: 'Chennai',
      prof: 'Customs Officer',
      parents: 'Late Xavier & Stella',
      dod: '2026-09-02',
      pod: 'Apollo Specialty Hospital, Chennai',
      cause: 'Multi Organ Dysfunction',
      conf: 'Received',
      viat: 'Received',
      ano: 'Received',
      burialDate: '2026-09-03',
      cemetery: 'Quibble Island Cemetery, Santhome',
      priestId: priests[0]?.id || null,
      customPriest: null,
      contact: '9844556677',
      remarks: null,
    },
  ];

  for (const d of deathData) {
    await pool.query(
      `INSERT INTO death_certificates (
        church_id, branch_id, certificate_no, deceased_name, age, place, profession,
        parents, date_of_death, place_of_death, cause, confession_received,
        viaticum_received, anointing_received, burial_date, cemetery,
        priest_id, custom_priest_name, family_contact, remarks, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        churchId,
        branchId,
        d.no,
        d.name,
        d.age,
        d.place,
        d.prof,
        d.parents,
        d.dod,
        d.pod,
        d.cause,
        d.conf,
        d.viat,
        d.ano,
        d.burialDate,
        d.cemetery,
        d.priestId,
        d.customPriest,
        d.contact,
        d.remarks,
        userId,
        userId,
      ]
    );
  }

  // 7. Confirmation Certificates (10 records)
  console.log('7. Seeding Confirmation Certificates...');
  const confirmationData = [
    {
      no: 'CNF-MOCK-0001',
      name: 'Maria Josephine Fernandez',
      age: '14',
      genderId: femaleGenderId,
      parents: 'Francis & Maria Fernandez',
      caste: 'RC Paravar',
      sponsors: 'Agnes Rozario',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2025-05-18',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'Confirmed during pastoral visitation',
    },
    {
      no: 'CNF-MOCK-0002',
      name: 'Antony Dominic Savio',
      age: '15',
      genderId: maleGenderId,
      parents: 'Joseph & Mary Anthony',
      caste: 'RC Paravar',
      sponsors: 'Dominic Savio Thomas',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2025-05-18',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'CNF-MOCK-0003',
      name: 'Theresa Stella Maris',
      age: '14',
      genderId: femaleGenderId,
      parents: 'Lawrence David',
      caste: 'RC Paravar',
      sponsors: 'Theresa Lawrence',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2025-05-18',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'CNF-MOCK-0004',
      name: 'Francis Xavier Paul',
      age: '16',
      genderId: maleGenderId,
      parents: 'Xavier & Philomena Paul & Antony Michael',
      caste: 'RC Paravar',
      sponsors: 'Francis Xavier',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2025-11-23',
      bishop: 'Most Rev. Bishop George Rajendran',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'Christ the King Feast Solemn Confirmation',
    },
    {
      no: 'CNF-MOCK-0005',
      name: 'Clara Philomena Vincent',
      age: '14',
      genderId: femaleGenderId,
      parents: 'Vincent & Clara',
      caste: 'RC Paravar',
      sponsors: 'Mary Stella',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2025-11-23',
      bishop: 'Most Rev. Bishop George Rajendran',
      priestId: null,
      customPriest: 'Rev. Fr. Lawrence David',
      remarks: null,
    },
    {
      no: 'CNF-MOCK-0006',
      name: 'Emmanuel Augustine Cruz',
      age: '15',
      genderId: maleGenderId,
      parents: 'Cruz & Selvi Daniel',
      caste: 'RC Paravar',
      sponsors: 'Augustine Cruz',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2026-05-24',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'Pentecost Sunday Confirmation',
    },
    {
      no: 'CNF-MOCK-0007',
      name: 'Catherine Gomez Robert',
      age: '14',
      genderId: femaleGenderId,
      parents: 'Gomez & Rita Robert',
      caste: 'RC Paravar',
      sponsors: 'Catherine Gomez',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2026-05-24',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[2]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'CNF-MOCK-0008',
      name: 'வின்சென்ட் பால் அந்தோணி',
      age: '15',
      genderId: maleGenderId,
      parents: 'அந்தோணி & ரோஸ்லின்',
      caste: 'RC Paravar',
      sponsors: 'சாமுவேல் ராஜ்',
      domicile: 'மரியாள் பங்கு, சென்னை',
      place: 'புனித மரியன்னை பேராலயம், சென்னை',
      doc: '2026-05-24',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: 'தமிழ் மறைக்கல்வி மாணவர்',
    },
    {
      no: 'CNF-MOCK-0009',
      name: 'திரேசா எலிசபெத் ராணி',
      age: '14',
      genderId: femaleGenderId,
      parents: 'சார்லஸ் & எலிசபெத் ராணி',
      caste: 'RC Paravar',
      sponsors: 'மரியாள் திரேசா',
      domicile: 'மரியாள் பங்கு, சென்னை',
      place: 'புனித மரியன்னை பேராலயம், சென்னை',
      doc: '2026-05-24',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[0]?.id || null,
      customPriest: null,
      remarks: null,
    },
    {
      no: 'CNF-MOCK-0010',
      name: 'Ignatius Loyola Doss',
      age: '15',
      genderId: maleGenderId,
      parents: 'Victor & Mary Doss',
      caste: 'RC Paravar',
      sponsors: 'Ignatius Loyola',
      domicile: 'St. Mary Parish, Chennai',
      place: "St. Mary's Church, Chennai",
      doc: '2026-05-24',
      bishop: 'Most Rev. Bishop Stephen Antony',
      priestId: priests[1]?.id || null,
      customPriest: null,
      remarks: null,
    },
  ];

  for (const c of confirmationData) {
    await pool.query(
      `INSERT INTO confirmation_certificates (
        church_id, branch_id, certificate_no, name, age, gender_id,
        parents, caste, sponsors, domicile, place_of_confirmation,
        date_of_confirmation, bishop_name, priest_id, custom_priest_name,
        remarks, created_by, updated_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        churchId,
        branchId,
        c.no,
        c.name,
        c.age,
        c.genderId,
        c.parents,
        c.caste,
        c.sponsors,
        c.domicile,
        c.place,
        c.doc,
        c.bishop,
        c.priestId,
        c.customPriest,
        c.remarks,
        userId,
        userId,
      ]
    );
  }

  // 8. Ensure certificate series numbers
  await pool.query("UPDATE certificate_series SET next_number = GREATEST(next_number, 20) WHERE church_id = ?", [churchId]);
  await pool.query("UPDATE receipt_series SET next_number = GREATEST(next_number, 500) WHERE church_id = ?", [churchId]);

  console.log('\n--- Mock Data Seeding Summary ---');
  console.log(`Mass Intentions: ${totalMiCount} across August, September, October 2026`);
  console.log(`Contributions: ${totalContribCount} across multiple categories`);
  console.log(`Baptism Certificates: ${baptismData.length} records`);
  console.log(`Marriage Certificates: ${marriageData.length} records (with 2, 3, 4 witnesses)`);
  console.log(`Confirmation Certificates: ${confirmationData.length} records`);
  console.log(`Death Certificates: ${deathData.length} records`);
  console.log('Successfully seeded all places mock data!');
  process.exit(0);
}

seedAllMockData().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
