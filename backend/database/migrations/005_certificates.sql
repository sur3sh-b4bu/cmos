-- =============================================================================
-- Migration 005: Baptism, Marriage & Death certificates
-- =============================================================================

CREATE TABLE IF NOT EXISTS baptism_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  certificate_no VARCHAR(30) NOT NULL,
  child_name VARCHAR(150) NOT NULL,
  gender_id INT UNSIGNED NOT NULL,
  date_of_birth DATE NOT NULL,
  date_of_baptism DATE NOT NULL,
  father_name VARCHAR(150) NULL,
  mother_name VARCHAR(150) NULL,
  godfather_name VARCHAR(150) NULL,
  godmother_name VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_baptism_certificate_no (certificate_no),
  KEY idx_baptism_child_name (child_name),
  CONSTRAINT fk_baptism_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT fk_baptism_gender FOREIGN KEY (gender_id) REFERENCES genders(id),
  CONSTRAINT fk_baptism_priest FOREIGN KEY (priest_id) REFERENCES priests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS marriage_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  certificate_no VARCHAR(30) NOT NULL,
  bride_name VARCHAR(150) NOT NULL,
  groom_name VARCHAR(150) NOT NULL,
  marriage_date DATE NOT NULL,
  witness1_name VARCHAR(150) NULL,
  witness2_name VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_marriage_certificate_no (certificate_no),
  KEY idx_marriage_names (bride_name, groom_name),
  CONSTRAINT fk_marriage_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT fk_marriage_priest FOREIGN KEY (priest_id) REFERENCES priests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS death_certificates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  church_id INT UNSIGNED NOT NULL,
  certificate_no VARCHAR(30) NOT NULL,
  deceased_name VARCHAR(150) NOT NULL,
  date_of_death DATE NOT NULL,
  burial_date DATE NULL,
  cemetery VARCHAR(150) NULL,
  priest_id INT UNSIGNED NULL,
  family_contact VARCHAR(20) NULL,
  remarks VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_death_certificate_no (certificate_no),
  KEY idx_death_deceased_name (deceased_name),
  CONSTRAINT fk_death_church FOREIGN KEY (church_id) REFERENCES churches(id),
  CONSTRAINT fk_death_priest FOREIGN KEY (priest_id) REFERENCES priests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
