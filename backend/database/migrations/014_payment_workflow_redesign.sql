-- =============================================================================
-- Migration 014: Payment workflow redesign
--
-- Old flow assumed money changes hands the instant a Mass Intention is saved
-- (a receipt was generated immediately, no matter the payment method). Real
-- offices take Cash, Cheque, UPI and bank transfers, often on different days
-- than the booking -- so payment is now a separate, explicit step recorded
-- against payment_transactions (already used for the UPI mock/gateway flow;
-- these columns extend it to also cover manual entries for every method).
--
-- "Paid" is now purely: does a payment_transactions row with status='success'
-- exist for this intention? No separate manual status is stored or needed --
-- exactly per spec ("the existence of a recorded payment is sufficient").
--
-- status_id becomes optional: the Pending/Completed/Cancelled workflow this
-- column drove is retired (superseded by the payment-existence check above).
-- The column itself is kept nullable rather than dropped, so historical
-- audit-log entries referencing old status values still resolve.
-- =============================================================================

ALTER TABLE payment_transactions
  ADD COLUMN method ENUM('cash', 'upi', 'cheque', 'bank_transfer', 'other') NULL AFTER provider,
  ADD COLUMN reference_number VARCHAR(100) NULL AFTER provider_transaction_id,
  ADD COLUMN remarks VARCHAR(500) NULL AFTER reference_number,
  ADD COLUMN payment_date DATE NULL AFTER remarks;

ALTER TABLE prayer_intentions
  MODIFY COLUMN status_id INT UNSIGNED NULL;
