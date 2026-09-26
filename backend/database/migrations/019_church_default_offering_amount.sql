-- =============================================================================
-- Migration 019: Per-church default Mass Intention offering amount, as its
-- own master table (not a column on `churches`) -- configurable in
-- Masters > Offering Amount Defaults. The Mass Intention form pre-fills
-- Offering Amount from the current user's church instead of a hardcoded 0.
-- One row per church, enforced by the UNIQUE constraint below.
-- =============================================================================

CREATE TABLE IF NOT EXISTS offering_defaults (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  default_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_offering_defaults_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT uq_offering_defaults_church UNIQUE (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
