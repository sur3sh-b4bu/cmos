'use strict';

const crypto = require('crypto');
const { pool } = require('../src/config/db');

async function seedDashboardMockData() {
  console.log('Generating rich mock data for September 2026 collections...');
  const churchId = 1;
  const userId = 1;

  // Let's get existing masses and intention masters
  const [masses] = await pool.query('SELECT id, name FROM masses WHERE church_id = ? ORDER BY id', [churchId]);
  const [intentions] = await pool.query('SELECT id, name FROM prayer_intention_master ORDER BY id');
  const [contributionTypes] = await pool.query('SELECT id, name FROM contribution_types WHERE is_deleted = 0 ORDER BY id');

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

  // Clean up any previously seeded mock data first
  await pool.query("DELETE pt FROM payment_transactions pt JOIN prayer_intentions pi ON pt.prayer_intention_id = pi.id WHERE pi.receipt_no LIKE 'RCT-MOCK-%'");
  await pool.query("DELETE cpt FROM contribution_payment_transactions cpt JOIN contributions c ON cpt.contribution_id = c.id WHERE c.receipt_no LIKE 'CON-MOCK-%'");
  await pool.query("DELETE FROM prayer_intentions WHERE receipt_no LIKE 'RCT-MOCK-%'");
  await pool.query("DELETE FROM contributions WHERE receipt_no LIKE 'CON-MOCK-%'");

  const daysData = [
    { day: 1, count: 4, baseAmount: 250, bump: 1.2 },
    { day: 2, count: 5, baseAmount: 500, bump: 1.5 },
    { day: 3, count: 3, baseAmount: 300, bump: 1.0 },
    { day: 4, count: 6, baseAmount: 400, bump: 1.8 },
    { day: 5, count: 8, baseAmount: 500, bump: 2.2 },
    { day: 6, count: 14, baseAmount: 600, bump: 4.5 }, // Sunday
    { day: 7, count: 4, baseAmount: 350, bump: 1.1 },
    { day: 8, count: 7, baseAmount: 500, bump: 2.0 }, // Feast day
    { day: 9, count: 5, baseAmount: 400, bump: 1.4 },
    { day: 10, count: 6, baseAmount: 300, bump: 1.6 },
    { day: 11, count: 5, baseAmount: 450, bump: 1.3 },
    { day: 12, count: 9, baseAmount: 500, bump: 2.5 },
    { day: 13, count: 16, baseAmount: 700, bump: 5.2 }, // Sunday
    { day: 14, count: 4, baseAmount: 300, bump: 1.0 },
    { day: 15, count: 6, baseAmount: 400, bump: 1.7 },
    { day: 16, count: 5, baseAmount: 350, bump: 1.3 },
    { day: 17, count: 7, baseAmount: 500, bump: 1.9 },
    { day: 18, count: 6, baseAmount: 400, bump: 1.5 },
    { day: 19, count: 10, baseAmount: 600, bump: 2.8 },
    { day: 20, count: 18, baseAmount: 750, bump: 6.0 }, // Sunday
    { day: 21, count: 5, baseAmount: 350, bump: 1.2 },
    { day: 22, count: 7, baseAmount: 450, bump: 1.8 },
    { day: 23, count: 6, baseAmount: 500, bump: 1.6 },
    { day: 24, count: 8, baseAmount: 400, bump: 2.1 },
    { day: 25, count: 5, baseAmount: 350, bump: 1.3 },
    { day: 26, count: 6, baseAmount: 400, bump: 1.5 },
    { day: 27, count: 18, baseAmount: 750, bump: 6.0 }, // Sunday
    { day: 28, count: 5, baseAmount: 350, bump: 1.2 },
    { day: 29, count: 7, baseAmount: 450, bump: 1.7 },
    { day: 30, count: 8, baseAmount: 500, bump: 2.0 },
  ];

  const methods = ['cash', 'upi', 'cheque', 'bank_transfer', 'cash', 'upi'];
  const pmIds = [1, 3, 4, 5, 1, 3];

  let receiptSeq = 100;
  let totalMiCount = 0;
  let totalContribCount = 0;

  for (const item of daysData) {
    const dayStr = String(item.day).padStart(2, '0');
    const dateStr = `2026-09-${dayStr}`;
    const dateTimeStr = `${dateStr} 09:30:00`;

    // Mass Intentions for this day
    for (let i = 0; i < item.count; i++) {
      receiptSeq++;
      const donor = donorNames[(receiptSeq + i) % donorNames.length];
      const mass = masses[i % masses.length] || { id: 1 };
      const intention = intentions[(receiptSeq * 3 + i) % intentions.length] || { id: 1 };
      const methodIdx = (receiptSeq + i) % methods.length;
      const method = methods[methodIdx];
      const pmId = pmIds[methodIdx];

      const amount = (item.baseAmount * ((i % 3) + 1) * (1 + (i % 2) * 0.5));
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
          `Intentions for ${dateStr}`,
          dateTimeStr,
          userId,
          dateTimeStr,
          userId,
        ]
      );

      const miId = res.insertId;

      // Add successful payment transaction
      const transRef = `MANUAL-MOCK-SEPT-${receiptSeq}-${crypto.randomBytes(4).toString('hex')}`;
      await pool.query(
        `INSERT INTO payment_transactions (
          prayer_intention_id, provider, method, transaction_ref, payment_date,
          amount, status, created_at, created_by, verified_at
        ) VALUES (?, 'manual', ?, ?, ?, ?, 'success', ?, ?, ?)`,
        [miId, method, transRef, dateStr, amount, dateTimeStr, userId, dateTimeStr]
      );

      totalMiCount++;
    }

    // Also add 1 or 2 Contributions on some days
    if (item.day % 2 === 0 || item.day % 3 === 0) {
      const contribDonor = donorNames[(receiptSeq + 7) % donorNames.length];
      const cType = contributionTypes[receiptSeq % contributionTypes.length] || { id: 1 };
      const cAmount = (1000 * ((item.day % 5) + 1));
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

      const cTransRef = `MANUAL-CON-SEPT-${receiptSeq}-${crypto.randomBytes(4).toString('hex')}`;
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

  console.log(`Successfully added ${totalMiCount} Mass Intentions and ${totalContribCount} Contributions across September 2026!`);
  process.exit(0);
}

seedDashboardMockData().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
