-- =============================================================================
-- Migration 010: UPI payment settings
--
-- UPI_VPA is deliberately seeded empty -- there is no real payment address to
-- default to. Until an administrator sets one (Masters -> System Settings),
-- the UPI panel on the prayer intention form explains that instead of
-- generating a QR code nobody can actually pay.
-- =============================================================================

INSERT INTO system_settings (setting_key, setting_value, description)
SELECT 'UPI_VPA', '', 'Church''s UPI ID (VPA), e.g. parish@okhdfcbank -- required for the UPI QR on prayer intention receipts'
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'UPI_VPA');

INSERT INTO system_settings (setting_key, setting_value, description)
SELECT 'UPI_PAYEE_NAME', '', 'Payee name shown in the paying UPI app (defaults to the church name if left blank)'
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE setting_key = 'UPI_PAYEE_NAME');
