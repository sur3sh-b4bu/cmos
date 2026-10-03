-- =============================================================================
-- DATABASE UPDATE SCRIPT: DEFAULT LANGUAGE & TABLE SETUP
-- DATE: 2026-10-03
--
-- Instructions:
-- Copy and execute this SQL script in your MySQL Database (e.g. phpMyAdmin /
-- MySQL Workbench / CLI) on any client machine to ensure the language table
-- and default settings are fully up-to-date.
-- =============================================================================

-- 1. Ensure `languages` table exists
CREATE TABLE IF NOT EXISTS `languages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `church_id` INT NULL,
  `name` VARCHAR(100) NOT NULL,
  `name_ta` VARCHAR(100) NULL,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` INT NULL,
  `updated_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_languages_church` (`church_id`),
  INDEX `idx_languages_active` (`is_active`, `is_deleted`),
  INDEX `idx_languages_default` (`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add `is_default` column if `languages` table already existed without it
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'languages'
    AND column_name = 'is_default'
);
SET @sql = IF(@col_exists = 0, 'ALTER TABLE `languages` ADD COLUMN `is_default` TINYINT(1) NOT NULL DEFAULT 0 AFTER `code`', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Insert or update standard Tamil and English language records
INSERT INTO `languages` (`name`, `name_ta`, `code`, `is_default`, `is_active`, `is_deleted`)
VALUES
  ('Tamil', 'தமிழ்', 'TA', 1, 1, 0),
  ('English', 'English', 'EN', 0, 1, 0)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `name_ta` = VALUES(`name_ta`),
  `is_active` = 1,
  `is_deleted` = 0;

-- 4. Set Tamil as default language (is_default = 1 for TA, 0 for other languages)
UPDATE `languages` SET `is_default` = 0 WHERE `is_deleted` = 0;
UPDATE `languages` SET `is_default` = 1 WHERE `code` IN ('TA', 'tam', 'tamil') AND `is_deleted` = 0 LIMIT 1;

-- 5. Refund Support for Mass Intentions (`prayer_intentions`)
SET @pi_refund_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'prayer_intentions' AND column_name = 'is_refunded'
);
SET @sql_pi = IF(@pi_refund_exists = 0,
  'ALTER TABLE `prayer_intentions`
     ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
     ADD COLUMN `refunded_at` DATETIME NULL AFTER `is_refunded`,
     ADD COLUMN `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`,
     ADD COLUMN `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`,
     ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`,
     ADD KEY `idx_prayer_intentions_refunded` (`is_refunded`, `refunded_at`)',
  'SELECT 1'
);
PREPARE stmt_pi FROM @sql_pi;
EXECUTE stmt_pi;
DEALLOCATE PREPARE stmt_pi;

-- 6. Refund Support for Contributions
SET @cont_table_name = IF((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'contributions') > 0, 'contributions', 'donations');
SET @don_refund_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = @cont_table_name AND column_name = 'is_refunded'
);
SET @sql_don = IF(@don_refund_exists = 0,
  CONCAT('ALTER TABLE `', @cont_table_name, '`
     ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
     ADD COLUMN `refunded_at` DATETIME NULL AFTER `is_refunded`,
     ADD COLUMN `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`,
     ADD COLUMN `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`,
     ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`,
     ADD KEY `idx_', @cont_table_name, '_refunded` (`is_refunded`, `refunded_at`)'),
  'SELECT 1'
);
PREPARE stmt_don FROM @sql_don;
EXECUTE stmt_don;
DEALLOCATE PREPARE stmt_don;

