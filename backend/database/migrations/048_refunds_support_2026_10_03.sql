-- =============================================================================
-- Migration 048: Refunds support for Mass Intentions and Contributions
-- Date: 2026-10-03
-- =============================================================================

-- 1. Add refund tracking columns to prayer_intentions
ALTER TABLE prayer_intentions
  ADD COLUMN is_refunded TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN refunded_at DATETIME NULL AFTER is_refunded,
  ADD COLUMN refunded_by INT UNSIGNED NULL AFTER refunded_at,
  ADD COLUMN refund_reason VARCHAR(500) NULL AFTER refunded_by,
  ADD COLUMN refund_amount DECIMAL(10,2) NULL AFTER refund_reason;

-- Add index for fast querying on refunded items
ALTER TABLE prayer_intentions
  ADD KEY idx_prayer_intentions_refunded (is_refunded, refunded_at);

-- 2. Add refund tracking columns to contributions
SET @cont_table = IF((SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'contributions') > 0, 'contributions', 'donations');

SET @sql_cont = CONCAT(
  'ALTER TABLE `', @cont_table, '` ',
  'ADD COLUMN IF NOT EXISTS `is_refunded` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`, ',
  'ADD COLUMN IF NOT EXISTS `refunded_at` DATETIME NULL AFTER `is_refunded`, ',
  'ADD COLUMN IF NOT EXISTS `refunded_by` INT UNSIGNED NULL AFTER `refunded_at`, ',
  'ADD COLUMN IF NOT EXISTS `refund_reason` VARCHAR(500) NULL AFTER `refunded_by`, ',
  'ADD COLUMN IF NOT EXISTS `refund_amount` DECIMAL(10,2) NULL AFTER `refund_reason`'
);
PREPARE stmt_cont FROM @sql_cont;
EXECUTE stmt_cont;
DEALLOCATE PREPARE stmt_cont;

