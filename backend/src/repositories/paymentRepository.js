const { pool } = require('../config/db');

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM payment_transactions WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

/**
 * Records a manually-confirmed payment (Cash/UPI/Cheque/Bank Transfer/Other)
 * against a mass intention. Written straight to 'success' -- there is no
 * pending/init step for this flow, since the operator is recording money
 * already received, not initiating an online transaction. `transaction_ref`
 * is still populated (it's the table's unique key) but is our own
 * internally-generated id, not a gateway reference.
 */
async function createManual({ massIntentionId, transactionRef, amount, method, referenceNumber, remarks, paymentDate, userId }) {
  const [result] = await pool.query(
    `INSERT INTO payment_transactions
       (prayer_intention_id, provider, transaction_ref, amount, status, method, reference_number, remarks, payment_date, created_by, verified_at)
     VALUES (?, 'manual', ?, ?, 'success', ?, ?, ?, ?, ?, NOW())`,
    [massIntentionId, transactionRef, amount, method, referenceNumber || null, remarks || null, paymentDate, userId]
  );
  return getById(result.insertId);
}

module.exports = { getById, createManual };
