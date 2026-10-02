-- Migration 045: Certificate Print Templates per church
CREATE TABLE IF NOT EXISTS certificate_print_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  certificate_type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NULL,
  subheader_prefix VARCHAR(100) NULL,
  diocese_label VARCHAR(150) NULL,
  signatory_title VARCHAR(100) NULL,
  seal_label VARCHAR(50) NULL,
  field_labels JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_church_cert_type (church_id, certificate_type),
  INDEX idx_cert_templates_church (church_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
