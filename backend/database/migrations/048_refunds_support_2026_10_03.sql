-- =============================================================================
-- Migration 048: Refunds support for Mass Intentions and Contributions
-- Date: 2026-10-03
-- =============================================================================

ALTER TABLE `prayer_intentions`
  ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
  ADD COLUMN `refunded_at` DATETIME NULL AFTER `is_refunded`,
  ADD COLUMN `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`,
  ADD COLUMN `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`,
  ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`,
  ADD KEY `idx_prayer_intentions_refunded` (`is_refunded`, `refunded_at`);

ALTER TABLE `contributions`
  ADD COLUMN `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`,
  ADD COLUMN `refunded_at` DATETIME NULL AFTER `is_refunded`,
  ADD COLUMN `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`,
  ADD COLUMN `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`,
  ADD COLUMN `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`,
  ADD KEY `idx_contributions_refunded` (`is_refunded`, `refunded_at`);
