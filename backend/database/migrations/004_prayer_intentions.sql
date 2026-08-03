-- =============================================================================
-- Migration 004: Prayer Intentions (primary module) + Daily Prayer Register support
-- =============================================================================

CREATE TABLE IF NOT EXISTS prayer_intentions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  receipt_no VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NULL,
  prayer_date DATE NOT NULL,
  mass_id INT UNSIGNED NOT NULL,
  prayer_intention_master_id INT UNSIGNED NULL,
  custom_intention TEXT NULL,
  offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method_id INT UNSIGNED NULL,
  remarks VARCHAR(500) NULL,
  status_id INT UNSIGNED NOT NULL,
  completed_at DATETIME NULL,
  completed_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_prayer_intentions_receipt (receipt_no),
  KEY idx_prayer_intentions_date_mass (prayer_date, mass_id),
  KEY idx_prayer_intentions_status (status_id),
  KEY idx_prayer_intentions_phone (phone),
  CONSTRAINT fk_pi_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT fk_pi_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_pi_mass FOREIGN KEY (mass_id) REFERENCES masses(id),
  CONSTRAINT fk_pi_master FOREIGN KEY (prayer_intention_master_id) REFERENCES prayer_intention_master(id),
  CONSTRAINT fk_pi_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  CONSTRAINT fk_pi_status FOREIGN KEY (status_id) REFERENCES statuses(id),
  CONSTRAINT chk_pi_offering_nonnegative CHECK (offering_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
