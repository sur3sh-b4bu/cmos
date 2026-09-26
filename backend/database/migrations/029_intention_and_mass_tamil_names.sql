-- =============================================================================
-- Migration 029: Tamil names for Mass Intention presets and Masses
-- =============================================================================
-- Adds an optional `name_ta` alongside the existing English `name` on both
-- tables -- nullable, so untranslated rows (custom presets an admin adds
-- later, e.g.) fall back to the English name rather than showing blank; see
-- frontend/src/app/core/utils/localized-name.util.ts for that fallback.
--
-- The UPDATE statements below translate the presets/masses that already
-- exist on this (and any other already-seeded) database, matched by their
-- current English `name` -- safe/additive, same live-DB-safe pattern as
-- migration 028. New masters/masses seeded from now on should have name_ta
-- filled in directly via Masters > Mass Intention Presets / Masses.
-- =============================================================================

ALTER TABLE prayer_intention_master
  ADD COLUMN name_ta VARCHAR(150) NULL AFTER name;

ALTER TABLE masses
  ADD COLUMN name_ta VARCHAR(150) NULL AFTER name;

UPDATE prayer_intention_master SET name_ta = 'நன்றி செலுத்துதல்' WHERE name = 'Thanksgiving';
UPDATE prayer_intention_master SET name_ta = 'நல்ல ஆரோக்கியம்' WHERE name = 'Good Health';
UPDATE prayer_intention_master SET name_ta = 'நோய் நீக்கம்' WHERE name = 'Healing from Illness';
UPDATE prayer_intention_master SET name_ta = 'பிறந்தநாள் ஆசீர்வாதங்கள்' WHERE name = 'Birthday Blessings';
UPDATE prayer_intention_master SET name_ta = 'திருமண ஆண்டு விழா' WHERE name = 'Wedding Anniversary';
UPDATE prayer_intention_master SET name_ta = 'வெற்றிகரமான தேர்வு' WHERE name = 'Successful Examination';
UPDATE prayer_intention_master SET name_ta = 'வேலைவாய்ப்பு / புதிய வேலை' WHERE name = 'Employment / New Job';
UPDATE prayer_intention_master SET name_ta = 'பாதுகாப்பான பயணம்' WHERE name = 'Safe Travel';
UPDATE prayer_intention_master SET name_ta = 'இறந்தோர் ஆன்மாக்களுக்காக' WHERE name = 'Souls of the Departed';
UPDATE prayer_intention_master SET name_ta = 'குடும்ப ஆசீர்வாதங்கள்' WHERE name = 'Family Blessings';
UPDATE prayer_intention_master SET name_ta = 'மற்றவை' WHERE name = 'Others';

-- Seed.js's own defaults (a fresh install that hasn't renamed its Masses yet).
UPDATE masses SET name_ta = 'காலை திருப்பலி' WHERE name = 'Weekday Morning Mass';
UPDATE masses SET name_ta = 'மாலை திருப்பலி' WHERE name = 'Weekday Evening Mass';
UPDATE masses SET name_ta = 'ஞாயிறு காலை திருப்பலி' WHERE name = 'Sunday Morning Mass';
UPDATE masses SET name_ta = 'ஞாயிறு மாலை திருப்பலி' WHERE name = 'Sunday Evening Mass';

-- This database's actual (renamed) Masses -- TRIM handles the stray leading
-- space on the current " Evening Mass" row without having to match it exactly.
UPDATE masses SET name_ta = 'காலை 1வது திருப்பலி' WHERE TRIM(name) = 'Morning 1st Mass';
UPDATE masses SET name_ta = 'காலை 2வது திருப்பலி' WHERE TRIM(name) = 'Morning 2nd Mass';
UPDATE masses SET name_ta = 'காலை 3வது திருப்பலி' WHERE TRIM(name) = 'Morning 3rd Mass';
UPDATE masses SET name_ta = 'மாலை திருப்பலி' WHERE TRIM(name) = 'Evening Mass';
