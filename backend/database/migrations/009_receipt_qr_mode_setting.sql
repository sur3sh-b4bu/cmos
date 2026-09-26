-- =============================================================================
-- Migration 009: Receipt QR mode
--
-- 'calendar' (default) embeds the calendar event directly in the QR code, so
-- scanning a receipt works with no internet, no Wi-Fi and no server running --
-- the phone builds the entry from the printed code alone.
--
-- 'url' instead points at the public confirmation page. That needs the phone
-- to reach the server, but shows a proper "add to your calendar?" screen and
-- behaves identically on every phone, which the offline mode cannot guarantee
-- (some built-in camera apps show a raw event as plain text).
--
-- Editable in the app under Masters -> System Settings.
-- =============================================================================

INSERT INTO system_settings (setting_key, setting_value, description)
SELECT 'RECEIPT_QR_MODE', 'calendar',
       'Receipt QR contents: "calendar" = offline calendar event, "url" = link to the online page'
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings WHERE setting_key = 'RECEIPT_QR_MODE'
);
