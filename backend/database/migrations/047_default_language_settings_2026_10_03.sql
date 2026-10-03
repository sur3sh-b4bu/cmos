-- =============================================================================
-- Migration 047 / Database Update Script: Default Language & Master Setup
-- Date: 2026-10-03
-- Purpose: Ensures the `languages` table exists with `is_default` column,
--          ensures standard Tamil (TA) and English (EN) language records exist,
--          and sets Tamil (TA) as the default language.
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

-- 3. Insert or update Tamil and English language records
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
