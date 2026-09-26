-- =============================================================================
-- Migration 024: Default offering amount moves from per-church
-- (offering_defaults, migration 019) to per-Mass -- different Masses (e.g.
-- Morning Mass vs Evening Mass) legitimately have different customary
-- offering amounts, which one church-wide figure couldn't express. The
-- Mass Intention form now pre-fills Offering Amount from whichever Mass is
-- selected (see mass-intention-form.ts) instead of a per-church constant.
--
-- Existing offering_defaults rows are backfilled onto every Mass at that
-- church as a starting value (better than resetting everyone to 0), then
-- the now-redundant table is dropped -- its one column is fully superseded
-- by masses.default_offering_amount, and Masters > Offering Amount Defaults
-- is retired in favour of setting it directly on each Mass.
-- =============================================================================

ALTER TABLE masses
  ADD COLUMN default_offering_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER day_type;

UPDATE masses m
JOIN offering_defaults od ON od.church_id = m.church_id AND od.is_deleted = 0
SET m.default_offering_amount = od.default_amount;

DROP TABLE offering_defaults;
