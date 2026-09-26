-- =============================================================================
-- Migration 023: "Booked By" on Mass Intentions -- the person who came to
-- the office and made the booking, which can differ from `name` (who the
-- Mass is offered for/by -- e.g. a family member booking on behalf of a
-- sick relative). Captured on the form, shown in the list right after
-- Receipt No., and printed on the receipt -- see mass-intention-form.ts,
-- mass-intentions-list.ts, and receiptPdf.js.
-- =============================================================================

ALTER TABLE prayer_intentions
  ADD COLUMN booked_by VARCHAR(150) NULL AFTER receipt_no;
