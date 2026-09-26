-- =============================================================================
-- Migration 036: Branch on Certificates
-- =============================================================================
-- Certificates were never scoped by branch at all -- only church_id -- so a
-- Baptism/Marriage/Death certificate created under one branch was visible to
-- every other branch of the same church, unlike Mass Intentions/Contributions
-- (see massIntentionRepository.js/contributionRepository.js's branch_id).
-- Nullable, same "NULL row is church-wide" convention as those tables: a
-- branch-restricted viewer (see utils/effectiveScope.js -- everyone except
-- ADMIN) sees their own branch's certificates plus any church-wide ones;
-- existing rows all land as NULL (church-wide) rather than silently
-- vanishing from every branch's view.
-- =============================================================================

ALTER TABLE baptism_certificates
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id,
  ADD CONSTRAINT fk_baptism_branch FOREIGN KEY (branch_id) REFERENCES branches(id);

ALTER TABLE marriage_certificates
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id,
  ADD CONSTRAINT fk_marriage_branch FOREIGN KEY (branch_id) REFERENCES branches(id);

ALTER TABLE death_certificates
  ADD COLUMN branch_id INT UNSIGNED NULL AFTER church_id,
  ADD CONSTRAINT fk_death_branch FOREIGN KEY (branch_id) REFERENCES branches(id);
