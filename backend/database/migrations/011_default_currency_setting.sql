-- =============================================================================
-- Migration 011: Default currency setting
--
-- Every amount displayed in COMS (dashboard, reports, receipts, prayer
-- intention offerings) was already hardcoded to INR/'₹' -- there was no
-- competing currency anywhere, so this migration doesn't change behaviour.
-- It exists so "the default currency is INR" is a real, inspectable,
-- administrator-editable record (Masters -> System Settings) rather than an
-- assumption baked silently into source code.
-- =============================================================================

INSERT INTO system_settings (setting_key, setting_value, description)
SELECT 'DEFAULT_CURRENCY', 'INR', 'Default currency for offerings, receipts, reports and the dashboard'
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'DEFAULT_CURRENCY');
