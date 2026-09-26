-- =============================================================================
-- Migration 028: Announcement status (Permanent / Temporary)
-- =============================================================================
-- 'temporary' (the default, matching every existing row's current behaviour)
-- keeps auto-expiring once end_date has passed -- see
-- lookupRepository.getActiveAnnouncements' upcomingOnly filter.
-- 'permanent' announcements are never filtered out by end_date; they stay on
-- the Dashboard until a user with masters.delete explicitly removes them
-- (either from the Dashboard's own remove button or the Masters screen --
-- both go through the same generic soft-delete).
-- =============================================================================

ALTER TABLE announcements
  ADD COLUMN status ENUM('permanent', 'temporary') NOT NULL DEFAULT 'temporary' AFTER end_date;
