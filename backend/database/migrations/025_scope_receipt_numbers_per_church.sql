-- =============================================================================
-- Migration 025: Scope receipt/certificate number uniqueness per church
-- =============================================================================
-- Every one of these five UNIQUE KEYs was global (receipt_no / certificate_no
-- unique across ALL churches), not scoped to one church. But each church's
-- own receipt_series/certificate_series (see 010_receipt_certificate_series
-- or wherever it first appeared) numbers independently from 1 -- so two
-- churches sharing the same series prefix (the obvious/likely-default "RCT",
-- "BAP", "MAR", "DEA") inevitably re-mint an identical receipt_no/
-- certificate_no once their sequences overlap, e.g. both churches' first
-- Mass Intention ever is "RCT0001". The second church's save then fails
-- with a raw MySQL duplicate-entry error the instant that happens -- not a
-- validation problem, a schema problem: this exact collision is what broke
-- a second church's very first booking.
--
-- Scoping the uniqueness to (church_id, ...number) instead keeps the
-- guarantee that actually matters -- no two records of the SAME church ever
-- share a number -- without accidentally coupling separate churches'
-- counters together.
-- =============================================================================

ALTER TABLE prayer_intentions
  DROP INDEX uq_prayer_intentions_receipt,
  ADD UNIQUE KEY uq_prayer_intentions_church_receipt (church_id, receipt_no);

ALTER TABLE donations
  DROP INDEX uq_donations_receipt,
  ADD UNIQUE KEY uq_donations_church_receipt (church_id, receipt_no);

ALTER TABLE baptism_certificates
  DROP INDEX uq_baptism_certificate_no,
  ADD UNIQUE KEY uq_baptism_church_certificate_no (church_id, certificate_no);

ALTER TABLE marriage_certificates
  DROP INDEX uq_marriage_certificate_no,
  ADD UNIQUE KEY uq_marriage_church_certificate_no (church_id, certificate_no);

ALTER TABLE death_certificates
  DROP INDEX uq_death_certificate_no,
  ADD UNIQUE KEY uq_death_church_certificate_no (church_id, certificate_no);
