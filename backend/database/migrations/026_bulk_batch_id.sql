-- =============================================================================
-- Migration 026: Bulk Mass Intention batch tracking
-- =============================================================================
-- Until now, a Bulk Mass Intention save left no trace of which rows were
-- created together -- each row became an ordinary Mass Intention
-- indistinguishable from a single-entry booking, so the combined receipt
-- printed right after saving could never be reprinted later (see
-- bulk-mass-intention-form.ts's own printBulkReceipt(), and the new "Show
-- Bulk Mass Intentions" list this enables).
--
-- bulk_batch_id is a client-generated UUID, set once per Bulk form save and
-- stamped on every row created in that one save -- NULL for every
-- single-entry booking (via mass-intention-form.ts or Excel import), same
-- as booked_by/phone being NULL there too. Deliberately just an opaque
-- grouping key, not a foreign key to a separate "batches" table: there is
-- no other data a batch needs to own (booked_by/phone/payment method are
-- already columns on every row it groups, identical across the batch by
-- construction), so a real parent table would be pure duplication.
-- =============================================================================

ALTER TABLE prayer_intentions
  ADD COLUMN bulk_batch_id VARCHAR(36) NULL AFTER public_token,
  ADD KEY idx_prayer_intentions_bulk_batch (bulk_batch_id);
