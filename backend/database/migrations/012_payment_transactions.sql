-- =============================================================================
-- Migration 012: Payment transactions
--
-- Records every payment attempt against a prayer intention, regardless of
-- which PaymentProvider handled it (mock today; Razorpay/Cashfree/etc. later
-- -- see backend/src/payments/). Kept as its own table rather than columns on
-- prayer_intentions because one intention can have more than one attempt
-- (a failed try followed by a retry), and because "was this paid, and how"
-- is a distinct concern from "was the prayer said" (prayer_intentions.status_id).
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prayer_intention_id INT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL, -- 'mock' today; 'razorpay' / 'cashfree' / ... later
  transaction_ref VARCHAR(100) NOT NULL, -- our own reference, created at init time
  provider_transaction_id VARCHAR(100) NULL, -- the gateway's own id, once known
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  failure_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  verified_at DATETIME NULL,
  UNIQUE KEY uq_payment_transactions_ref (transaction_ref),
  KEY idx_payment_transactions_intention (prayer_intention_id),
  CONSTRAINT fk_payment_transactions_intention FOREIGN KEY (prayer_intention_id) REFERENCES prayer_intentions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
