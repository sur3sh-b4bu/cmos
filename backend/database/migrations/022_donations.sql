-- =============================================================================
-- Migration 022: Donations -- a sibling module to Mass Intentions for money
-- given with no Mass/date booking attached (e.g. walk-in offertory, building
-- fund, charity). Deliberately NOT columns on prayer_intentions: a donation
-- has no prayer_date or mass_id, and forcing those NOT NULL columns to hold
-- meaningless values for donations would corrupt every Mass-Intention-only
-- query (register, dashboard "intentions by mass", restricted-date checks).
--
-- donation_type_id below references `donation_types`, a plain name/code/
-- description lookup that already existed (migration 002, pre-seeded with
-- General Offering/Mass Offering/Building Fund/Charity) -- nothing to create
-- here. It has no is_custom flag the way prayer_intention_master does; the
-- 'Others' row seed.js adds is matched by its fixed code ('OTHERS') instead,
-- same fixed-code pattern used for certificate types elsewhere.
--
-- donation_payment_transactions mirrors payment_transactions but FK'd to
-- donations(id) instead of prayer_intentions(id) -- kept as a separate table
-- rather than adding a nullable donation_id to the existing table so
-- "exactly one of these two FKs is set" never has to be enforced/trusted at
-- the application layer.
--
-- NOTE: this module was renamed "Contributions" at the application layer
-- (routes, permissions, UI, JS identifiers) without touching these
-- already-applied table/column names -- see migration 027 for why, and for
-- the one-time RENAME TABLE/CHANGE COLUMN that actually renames the live
-- schema to match.
-- =============================================================================

CREATE TABLE IF NOT EXISTS donations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  -- Shares the church's one receipt_series with Mass Intentions -- one
  -- physical receipt-number sequence per church, same as the office's own
  -- paper receipt book, rather than a second competing series.
  receipt_no VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NULL,
  donation_type_id INT UNSIGNED NULL,
  custom_donation_type TEXT NULL,
  donation_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method_id INT UNSIGNED NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_donations_receipt (receipt_no),
  KEY idx_donations_phone (phone),
  CONSTRAINT fk_don_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT fk_don_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_don_type FOREIGN KEY (donation_type_id) REFERENCES donation_types(id),
  CONSTRAINT fk_don_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  CONSTRAINT chk_don_amount_nonnegative CHECK (donation_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS donation_payment_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  donation_id INT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL,
  transaction_ref VARCHAR(100) NOT NULL,
  provider_transaction_id VARCHAR(100) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
  failure_reason VARCHAR(255) NULL,
  method ENUM('cash', 'upi', 'cheque', 'bank_transfer', 'other') NULL,
  reference_number VARCHAR(100) NULL,
  remarks VARCHAR(500) NULL,
  payment_date DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  verified_at DATETIME NULL,
  UNIQUE KEY uq_donation_payment_transactions_ref (transaction_ref),
  KEY idx_donation_payment_transactions_donation (donation_id),
  CONSTRAINT fk_donation_payment_transactions_donation FOREIGN KEY (donation_id) REFERENCES donations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
