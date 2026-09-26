-- =============================================================================
-- Migration 007: Public token for prayer intention receipts
--
-- The QR code printed on every receipt links to a public (unauthenticated)
-- page where the person who requested the prayer can add it to their own
-- calendar. That page must be reachable without a login, so it cannot be
-- keyed by the sequential `id` -- anyone could then enumerate every
-- parishioner's intention by counting upward. A random 32-char token makes
-- the URL unguessable while keeping the lookup a single indexed hit.
-- =============================================================================

ALTER TABLE prayer_intentions
  ADD COLUMN public_token CHAR(32) NULL AFTER receipt_no,
  ADD UNIQUE KEY uq_prayer_intentions_public_token (public_token);

-- Backfill rows created before this migration so their reprinted receipts
-- carry a working QR code too. MD5 of (id + receipt_no + a random seed)
-- yields exactly 32 hex chars and is unique per row.
UPDATE prayer_intentions
SET public_token = MD5(CONCAT(id, '|', receipt_no, '|', RAND(), '|', UNIX_TIMESTAMP()))
WHERE public_token IS NULL;
