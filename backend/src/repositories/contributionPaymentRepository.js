const { pool } = require('../config/db');

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM contribution_payment_transactions WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

/**
 * Records a manually-confirmed payment (Cash/UPI/Cheque/Bank Transfer/Other)
 * against a contribution. Same "written straight to success, no pending step"
 * reasoning as paymentRepository.createManual -- the operator is recording
 * money already received, not initiating an online transaction.
 */
async function createManual({ contributionId, transactionRef, amount, method, referenceNumber, remarks, paymentDate, userId }) {
  const [result] = await pool.query(
    `INSERT INTO contribution_payment_transactions
       (contribution_id, provider, transaction_ref, amount, status, method, reference_number, remarks, payment_date, created_by, verified_at)
     VALUES (?, 'manual', ?, ?, 'success', ?, ?, ?, ?, ?, NOW())`,
    [contributionId, transactionRef, amount, method, referenceNumber || null, remarks || null, paymentDate, userId]
  );
  return getById(result.insertId);
}

module.exports = { getById, createManual };
