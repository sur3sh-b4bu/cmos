-- Migration 050: Parish Families, Members, Wards/Anbiams & Census Management

CREATE TABLE IF NOT EXISTS wards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  name_ta VARCHAR(150) NULL,
  code VARCHAR(50) NULL,
  leader_name VARCHAR(150) NULL,
  leader_phone VARCHAR(20) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_wards_church (church_id),
  KEY idx_wards_branch (branch_id),
  CONSTRAINT fk_wards_church FOREIGN KEY (church_id) REFERENCES churches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS families (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  branch_id INT UNSIGNED NULL,
  family_code VARCHAR(50) NOT NULL,
  family_name VARCHAR(200) NOT NULL,
  family_name_ta VARCHAR(200) NULL,
  ward_id INT UNSIGNED NULL,
  head_member_id INT UNSIGNED NULL,
  parent_family_id INT UNSIGNED NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  address_ta VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  pincode VARCHAR(20) NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  marriage_date DATE NULL,
  status ENUM('ACTIVE', 'MIGRATED_OUT', 'MIGRATED_IN', 'DIVIDED', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  migration_date DATE NULL,
  migration_reason VARCHAR(255) NULL,
  migrated_to_parish VARCHAR(200) NULL,
  migrated_from_parish VARCHAR(200) NULL,
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_families_church (church_id),
  KEY idx_families_branch (branch_id),
  KEY idx_families_ward (ward_id),
  KEY idx_families_parent (parent_family_id),
  KEY idx_families_code (family_code),
  CONSTRAINT fk_families_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT fk_families_ward FOREIGN KEY (ward_id) REFERENCES wards(id),
  CONSTRAINT fk_families_parent FOREIGN KEY (parent_family_id) REFERENCES families(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  family_id INT UNSIGNED NOT NULL,
  first_name VARCHAR(150) NOT NULL,
  last_name VARCHAR(150) NULL,
  name_ta VARCHAR(150) NULL,
  relationship_to_head ENUM('HEAD', 'SPOUSE', 'SON', 'DAUGHTER', 'FATHER', 'MOTHER', 'BROTHER', 'SISTER', 'GRANDFATHER', 'GRANDMOTHER', 'SON_IN_LAW', 'DAUGHTER_IN_LAW', 'GRANDSON', 'GRANDDAUGHTER', 'OTHER') NOT NULL DEFAULT 'OTHER',
  gender ENUM('M', 'F', 'OTHER') NOT NULL DEFAULT 'M',
  dob DATE NULL,
  phone VARCHAR(30) NULL,
  email VARCHAR(150) NULL,
  blood_group VARCHAR(10) NULL,
  occupation VARCHAR(150) NULL,
  education VARCHAR(150) NULL,
  marital_status ENUM('SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED', 'CLERGY') NOT NULL DEFAULT 'SINGLE',
  is_baptised TINYINT(1) NOT NULL DEFAULT 0,
  baptism_date DATE NULL,
  baptism_certificate_no VARCHAR(100) NULL,
  is_communion_received TINYINT(1) NOT NULL DEFAULT 0,
  communion_date DATE NULL,
  is_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  confirmation_date DATE NULL,
  marriage_date DATE NULL,
  marriage_certificate_no VARCHAR(100) NULL,
  is_alive TINYINT(1) NOT NULL DEFAULT 1,
  deceased_date DATE NULL,
  is_head TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_members_family (family_id),
  KEY idx_members_church (church_id),
  CONSTRAINT fk_members_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  CONSTRAINT fk_members_church FOREIGN KEY (church_id) REFERENCES churches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_events_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  family_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NULL,
  event_type ENUM('CREATED', 'MEMBER_ADDED', 'MEMBER_UPDATED', 'MEMBER_REMOVED', 'FAMILY_SPLIT', 'MIGRATED_OUT', 'MIGRATED_IN', 'HEAD_CHANGED', 'STATUS_CHANGED', 'DECEASED') NOT NULL,
  description VARCHAR(500) NOT NULL,
  details_json TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  KEY idx_feh_family (family_id),
  KEY idx_feh_church (church_id),
  CONSTRAINT fk_feh_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  CONSTRAINT fk_feh_church FOREIGN KEY (church_id) REFERENCES churches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions for Families & Census
INSERT IGNORE INTO permissions (module, action, code, description) VALUES
  ('families', 'view', 'families.view', 'View parish families and census'),
  ('families', 'create', 'families.create', 'Add new parish families and members'),
  ('families', 'update', 'families.update', 'Update family details, members and split families'),
  ('families', 'delete', 'families.delete', 'Delete family records'),
  ('families', 'print', 'families.print', 'Print family cards, census and directory'),
  ('families', 'export', 'families.export', 'Export family census data to Excel');

-- Map permissions to roles
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r
JOIN permissions p ON p.module = 'families'
WHERE r.code IN ('ADMIN', 'OFFICE_STAFF', 'PRIEST');
