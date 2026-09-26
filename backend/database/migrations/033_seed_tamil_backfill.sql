-- =============================================================================
-- Migration 033: Backfill Tamil names on already-seeded databases
-- =============================================================================
-- Migrations 029/030 UPDATE Masses/Mass Intention Presets/Contribution Types
-- by matching seed.js's default English names -- correct for a database that
-- was already seeded *before* those migrations ran (this app's own dev
-- database), but a no-op on a genuinely fresh `npm run db:setup`: that runs
-- `migrate` THEN `seed` (see backend/package.json), so 029/030 execute
-- against still-empty tables and match nothing, then seed.js inserts
-- English-only rows with no later step to backfill name_ta.
--
-- seed.js itself is now fixed to set name_ta directly at insert time, but
-- that only helps installs from this point forward -- a database that
-- already completed db:setup with the old seed.js (029/030 already marked
-- "applied", so simply re-running `npm run migrate` skips them even though
-- their UPDATEs would now actually match real rows) needs this repeated
-- here, in a new migration file that WILL actually run.
--
-- Every statement is safe to run against this app's own already-correct
-- database too (harmless re-assignment of the same values, and
-- INSERT IGNORE/WHERE name_ta IS NULL guards below skip anything already
-- customized by an administrator).
-- =============================================================================

UPDATE masses SET name_ta = 'காலை திருப்பலி' WHERE name = 'Weekday Morning Mass' AND name_ta IS NULL;
UPDATE masses SET name_ta = 'மாலை திருப்பலி' WHERE name = 'Weekday Evening Mass' AND name_ta IS NULL;
UPDATE masses SET name_ta = 'ஞாயிறு காலை திருப்பலி' WHERE name = 'Sunday Morning Mass' AND name_ta IS NULL;
UPDATE masses SET name_ta = 'ஞாயிறு மாலை திருப்பலி' WHERE name = 'Sunday Evening Mass' AND name_ta IS NULL;

UPDATE prayer_intention_master SET name_ta = 'நன்றி செலுத்துதல்' WHERE name = 'Thanksgiving' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'நல்ல ஆரோக்கியம்' WHERE name = 'Good Health' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'நோய் நீக்கம்' WHERE name = 'Healing from Illness' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'பிறந்தநாள் ஆசீர்வாதங்கள்' WHERE name = 'Birthday Blessings' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'திருமண ஆண்டு விழா' WHERE name = 'Wedding Anniversary' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'வெற்றிகரமான தேர்வு' WHERE name = 'Successful Examination' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'வேலைவாய்ப்பு / புதிய வேலை' WHERE name = 'Employment / New Job' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'பாதுகாப்பான பயணம்' WHERE name = 'Safe Travel' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'இறந்தோர் ஆன்மாக்களுக்காக' WHERE name = 'Souls of the Departed' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'குடும்ப ஆசீர்வாதங்கள்' WHERE name = 'Family Blessings' AND name_ta IS NULL;
UPDATE prayer_intention_master SET name_ta = 'மற்றவை' WHERE name = 'Others' AND name_ta IS NULL;

UPDATE contribution_types SET name_ta = 'பொது காணிக்கை' WHERE name = 'General Offering' AND name_ta IS NULL;
UPDATE contribution_types SET name_ta = 'திருப்பலி காணிக்கை' WHERE name = 'Mass Offering' AND name_ta IS NULL;
UPDATE contribution_types SET name_ta = 'கட்டிட நிதி' WHERE name = 'Building Fund' AND name_ta IS NULL;
UPDATE contribution_types SET name_ta = 'தொண்டு' WHERE name = 'Charity' AND name_ta IS NULL;
UPDATE contribution_types SET name_ta = 'மற்றவை' WHERE name = 'Others' AND name_ta IS NULL;

-- New default type (see seed.js) -- added here too so it exists on a
-- database that already ran db:setup before "Church Maintenance" was part
-- of that seed list.
INSERT IGNORE INTO contribution_types (name, name_ta, code, description)
VALUES ('Church Maintenance', 'தேவாலய பராமரிப்பு', 'CHURCH_MAINTENANCE', 'Upkeep and maintenance of church property');

-- The seed default church's own Tamil name/address (see seed.js's own
-- comment on why this is a demo default, not a real installation's actual
-- name) -- scoped to only the still-unrenamed seed default, so an
-- administrator who already renamed their church away from "St. Mary's
-- Church" is untouched; they enter their own via Masters > Churches.
UPDATE churches SET name_ta = 'புனித மரியாள் ஆலயம்' WHERE name = "St. Mary's Church" AND name_ta IS NULL;
UPDATE churches SET address_ta = '1 சர்ச் தெரு, சென்னை' WHERE name = "St. Mary's Church" AND address_ta IS NULL;
