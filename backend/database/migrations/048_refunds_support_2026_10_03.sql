-- =============================================================================
-- Migration 048: Refunds support for Mass Intentions and Contributions
-- Date: 2026-10-03
-- =============================================================================

-- 1. Add refund tracking columns to prayer_intentions if missing
DROP PROCEDURE IF EXISTS _migration_048_step;
DELIMITER $$
CREATE PROCEDURE _migration_048_step()
BEGIN
  -- prayer_intentions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'prayer_intentions' AND column_name = 'is_refunded'
  ) THEN
    ALTER TABLE `prayer_intentions`
      ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
      ADD COLUMN `refunded_at` DATETIME NULL AFTER `is_refunded`,
      ADD COLUMN `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`,
      ADD COLUMN `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`,
      ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`,
      ADD KEY `idx_prayer_intentions_refunded` (`is_refunded`, `refunded_at`);
  END IF;

  -- contributions / donations
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'contributions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'contributions' AND column_name = 'is_refunded'
    ) THEN
      ALTER TABLE `contributions`
        ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
        ADD COLUMN `refunded_at` DATETIME NULL AFTER `is_refunded`,
        ADD COLUMN `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`,
        ADD COLUMN `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`,
        ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`,
        ADD KEY `idx_contributions_refunded` (`is_refunded`, `refunded_at`);
    END IF;
  ELSEIF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'donations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'donations' AND column_name = 'is_refunded'
    ) THEN
      ALTER TABLE `donations`
        ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
        ADD COLUMN `refunded_at` DATETIME NULL AFTER `is_refunded`,
        ADD COLUMN `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`,
        ADD COLUMN `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`,
        ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`,
        ADD KEY `idx_donations_refunded` (`is_refunded`, `refunded_at`);
    END IF;
  END IF;
END $$
DELIMITER ;

CALL _migration_048_step();
DROP PROCEDURE IF EXISTS _migration_048_step;


