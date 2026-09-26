-- =============================================================================
-- Migration 027: Rename Donations -> Contributions (live schema)
-- =============================================================================
-- The "Donations" module was renamed "Contributions" across the whole
-- application (routes, permissions, UI copy, JS/TS identifiers) to match the
-- terminology the church office actually uses. Migrations 002/022/025 are
-- deliberately left describing the schema as it was originally created
-- (donations, donation_types, donation_payment_transactions) so they still
-- read as an accurate history of what ran -- same one-time-follow-up pattern
-- as 013_rename_to_mass_intentions.sql. Unlike that migration, this one also
-- renames the table/column names themselves (not just permission codes),
-- because RENAME TABLE / CHANGE COLUMN are metadata-only operations that
-- carry every existing row forward untouched -- there is no data-loss risk
-- that would justify leaving the live schema out of sync with the app.
-- =============================================================================

RENAME TABLE donation_types TO contribution_types;
RENAME TABLE donations TO contributions;
RENAME TABLE donation_payment_transactions TO contribution_payment_transactions;

ALTER TABLE contribution_types
  RENAME INDEX uq_donation_types_code TO uq_contribution_types_code;

ALTER TABLE contributions
  CHANGE COLUMN donation_type_id contribution_type_id INT UNSIGNED NULL,
  CHANGE COLUMN custom_donation_type custom_contribution_type TEXT NULL,
  CHANGE COLUMN donation_amount contribution_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  RENAME INDEX uq_donations_church_receipt TO uq_contributions_church_receipt,
  RENAME INDEX idx_donations_phone TO idx_contributions_phone,
  DROP FOREIGN KEY fk_don_church,
  DROP FOREIGN KEY fk_don_branch,
  DROP FOREIGN KEY fk_don_type,
  DROP FOREIGN KEY fk_don_payment_method,
  DROP CHECK chk_don_amount_nonnegative;

ALTER TABLE contributions
  ADD CONSTRAINT fk_cont_church FOREIGN KEY (church_id) REFERENCES churches(id),
  ADD CONSTRAINT fk_cont_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  ADD CONSTRAINT fk_cont_type FOREIGN KEY (contribution_type_id) REFERENCES contribution_types(id),
  ADD CONSTRAINT fk_cont_payment_method FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
  ADD CONSTRAINT chk_cont_amount_nonnegative CHECK (contribution_amount >= 0);

ALTER TABLE contribution_payment_transactions
  CHANGE COLUMN donation_id contribution_id INT UNSIGNED NOT NULL,
  RENAME INDEX uq_donation_payment_transactions_ref TO uq_contribution_payment_transactions_ref,
  RENAME INDEX idx_donation_payment_transactions_donation TO idx_contribution_payment_transactions_contribution,
  DROP FOREIGN KEY fk_donation_payment_transactions_donation;

ALTER TABLE contribution_payment_transactions
  ADD CONSTRAINT fk_contribution_payment_transactions_contribution
    FOREIGN KEY (contribution_id) REFERENCES contributions(id);

-- role_permissions links by permission_id, so renaming the code/module of an
-- existing permission row in place preserves every role's current grants.
UPDATE permissions
  SET module = 'contributions',
      code = REPLACE(code, 'donations.', 'contributions.')
  WHERE module = 'donations';
