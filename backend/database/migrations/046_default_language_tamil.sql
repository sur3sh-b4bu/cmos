-- =============================================================================
-- Migration 046: Set Tamil as default language
-- =============================================================================

UPDATE languages SET is_default = 0;
UPDATE languages SET is_default = 1 WHERE code = 'TA';
