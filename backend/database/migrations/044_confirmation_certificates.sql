-- =============================================================================
-- Migration 044: Confirmation Certificates
-- =============================================================================
-- Adds confirmation_certificates table, permissions, role permissions,
-- certificate series, and contribution type to support the
-- "Extract from Confirmation Register" certificate.
-- =============================================================================

CREATE TABLE IF NOT EXISTS confirmation_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  certificate_no VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  age VARCHAR(10) NULL,
  gender_id INT UNSIGNED NULL,
  parents VARCHAR(300) NULL,
  caste VARCHAR(100) NULL,
  sponsors VARCHAR(300) NULL,
  domicile VARCHAR(200) NULL,
  place_of_confirmation VARCHAR(200) NULL,
  date_of_confirmation DATE NOT NULL,
  bishop_name VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  custom_priest_name TEXT NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_confirmation_certificate_no (certificate_no),
  KEY idx_confirmation_name (name),
  CONSTRAINT fk_confirmation_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT fk_confirmation_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_confirmation_gender FOREIGN KEY (gender_id) REFERENCES genders(id),
  CONSTRAINT fk_confirmation_priest FOREIGN KEY (priest_id) REFERENCES priests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Permissions
INSERT IGNORE INTO permissions (module, action, code, description) VALUES
  ('confirmation_certificates', 'view', 'confirmation_certificates.view', 'view confirmation certificates'),
  ('confirmation_certificates', 'create', 'confirmation_certificates.create', 'create confirmation certificates'),
  ('confirmation_certificates', 'update', 'confirmation_certificates.update', 'update confirmation certificates'),
  ('confirmation_certificates', 'delete', 'confirmation_certificates.delete', 'delete confirmation certificates'),
  ('confirmation_certificates', 'print', 'confirmation_certificates.print', 'print confirmation certificates'),
  ('confirmation_certificates', 'export', 'confirmation_certificates.export', 'export confirmation certificates');

-- Assign to ADMIN
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'ADMIN'
   AND p.module = 'confirmation_certificates';

-- Assign to OFFICE_STAFF
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  CROSS JOIN permissions p
 WHERE r.code = 'OFFICE_STAFF'
   AND p.code IN (
     'confirmation_certificates.view',
     'confirmation_certificates.create',
     'confirmation_certificates.update',
     'confirmation_certificates.print',
     'confirmation_certificates.export'
   );

-- Seed default certificate series for all existing churches
INSERT IGNORE INTO certificate_series (church_id, certificate_type, prefix, next_number, number_padding)
SELECT c.id, 'Confirmation', 'CNF', 1, 4
  FROM churches c
 WHERE NOT EXISTS (
   SELECT 1 FROM certificate_series cs
    WHERE cs.church_id = c.id AND cs.certificate_type = 'Confirmation'
 );

-- Contribution type for Confirmation Certificate
INSERT INTO contribution_types (name, name_ta, code, description)
SELECT 'Confirmation Certificate', 'உறுதிப்பூசுதல் சான்றிதழ்', 'CONFIRMATION_CERTIFICATE', 'Contribution received for a Confirmation certificate'
  FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM contribution_types WHERE code = 'CONFIRMATION_CERTIFICATE');
