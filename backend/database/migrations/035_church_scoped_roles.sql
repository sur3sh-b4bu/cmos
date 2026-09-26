-- =============================================================================
-- Migration 035: Church-scoped custom roles
-- =============================================================================
-- Lets a church admin (or Master Administrator, for whichever church it's
-- acting as) define their own custom role in Settings > Roles & Permissions,
-- in addition to the fixed system roles seeded in seed.js (ADMIN,
-- OFFICE_STAFF, PRIEST, ACCOUNTANT, MASTER_ADMIN). NULL means "system role,
-- visible to every church" -- the 5 seeded roles keep church_id NULL;
-- roleService.create() (backend) always sets it to the creating admin's own
-- effective church, never NULL, for anything created through that endpoint.
--
-- `code` keeps its existing global UNIQUE KEY (uq_roles_code) unchanged --
-- custom roles get a server-generated code (see roleService.js), so there's
-- no need to relax that to a per-church uniqueness rule.
-- =============================================================================

ALTER TABLE roles
  ADD COLUMN church_id INT UNSIGNED NULL AFTER description,
  ADD KEY idx_roles_church (church_id),
  ADD CONSTRAINT fk_roles_church FOREIGN KEY (church_id) REFERENCES churches(id);
