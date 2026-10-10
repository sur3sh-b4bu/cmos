/**
 * Declarative registry of every "master table" exposed through the generic
 * /api/masters/:masterKey CRUD engine. Adding a new master table anywhere in
 * the app means adding one entry here -- no new controller/route code.
 *
 * columns:    editable columns (excludes id + standard audit columns)
 * required:   columns that must be non-empty on create
 * searchable: columns matched by the free-text `search` query param
 * joins:      FK columns resolved to a human-readable label for list display
 * hasSortOrder: enables the /reorder endpoint for drag-and-drop ordering
 */
const registry = {
  countries: {
    table: 'countries',
    columns: ['name', 'iso_code', 'phone_code'],
    required: ['name', 'iso_code'],
    searchable: ['name', 'iso_code'],
  },
  states: {
    table: 'states',
    columns: ['country_id', 'name', 'code'],
    required: ['country_id', 'name'],
    searchable: ['name', 'code'],
    joins: [{ column: 'country_id', table: 'countries', labelColumn: 'name', alias: 'country_name' }],
  },
  districts: {
    table: 'districts',
    columns: ['state_id', 'name', 'code'],
    required: ['state_id', 'name'],
    searchable: ['name', 'code'],
    joins: [{ column: 'state_id', table: 'states', labelColumn: 'name', alias: 'state_name' }],
  },
  churches: {
    table: 'churches',
    columns: [
      // Optional -- shown instead of `name` on printed receipts/registers
      // and the app header when the site's language is Tamil (see
      // localized-name.util.ts); falls back to `name` when blank. Same
      // pattern as Masses/Mass Intention Presets/Contribution Types' own
      // name_ta. Deliberately NOT used on certificates or the always-
      // English collections reports -- see migration 031's own comment.
      'name', 'name_ta', 'diocese', 'registration_no', 'address_line1', 'address_line2',
      // Optional single-line Tamil override for the printed address_line1 +
      // city combo (see receiptPdf.js/contributionReceiptPdf.js) -- see
      // migration 032's own comment for why it's one free-text field rather
      // than per-field _ta columns.
      'address_ta', 'city',
      'district_id', 'state_id', 'country_id', 'pincode', 'phone', 'email',
      'website', 'established_date',
      // Drives the sidebar/header/button color scheme for this church's users
      // -- see _tokens.scss's [data-brand-theme] overrides and
      // AuthService/CurrentUser.churchThemeColor on the frontend.
      'theme_color',
      // Not on the regular edit form (see master-config.ts) -- set only via
      // the dedicated logo upload endpoint (mastersController.uploadChurchLogo),
      // same reasoning as is_default on languages/currencies above.
      'logo_url',
    ],
    required: ['name'],
    searchable: ['name', 'city', 'registration_no'],
    // Not a `church_id` column -- churches are the tenant itself, so the
    // row's own `id` is what's scoped: a plain admin sees/edits only their
    // own church's info row, Master Administrator sees/creates any.
    churchScope: 'self',
  },
  branches: {
    table: 'branches',
    columns: ['church_id', 'name', 'code', 'address', 'phone', 'email'],
    required: ['church_id', 'name'],
    searchable: ['name', 'code'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
    churchScope: 'strict',
  },
  priests: {
    table: 'priests',
    columns: ['church_id', 'name', 'title', 'phone', 'email', 'is_parish_priest'],
    required: ['church_id', 'name'],
    searchable: ['name'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
    churchScope: 'strict',
  },
  masses: {
    table: 'masses',
    // default_offering_amount drives the Mass Intention form's Offering
    // Amount pre-fill on selecting this Mass (see mass-intention-form.ts) --
    // replaces the old per-church offering_defaults master (migration 024),
    // since different Masses legitimately have different customary amounts.
    columns: ['church_id', 'branch_id', 'name', 'name_ta', 'mass_time', 'day_type', 'default_offering_amount', 'offering_description', 'sort_order'],
    required: ['church_id', 'name', 'mass_time', 'day_type'],
    searchable: ['name'],
    hasSortOrder: true,
    joins: [
      { column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' },
      { column: 'branch_id', table: 'branches', labelColumn: 'name', alias: 'branch_name' },
    ],
    churchScope: 'strict',
    // branch_id is nullable -- a NULL row is a church-wide Mass, visible to
    // every branch (same "NULL row is shared" convention as churchScope
    // 'nullable' above, one dimension deeper). A branch-restricted viewer
    // (see utils/effectiveScope.js -- everyone except ADMIN) only sees their
    // own branch's Masses plus these church-wide ones.
    branchScope: 'nullable',
  },
  genders: {
    table: 'genders',
    columns: ['name', 'code'],
    required: ['name', 'code'],
    searchable: ['name'],
  },
  departments: {
    table: 'departments',
    columns: ['name', 'code'],
    required: ['name', 'code'],
    searchable: ['name'],
  },
  languages: {
    table: 'languages',
    columns: ['name', 'code'],
    required: ['name', 'code'],
    searchable: ['name'],
    // Deleting the current default auto-promotes the next remaining one --
    // see genericMasterRepository.softDelete(). is_default is deliberately
    // NOT in `columns` above so it can only change via the dedicated
    // set-default action, never a plain create/update payload.
    hasDefaultFlag: true,
  },
  currencies: {
    table: 'currencies',
    columns: ['name', 'code', 'symbol'],
    required: ['name', 'code', 'symbol'],
    searchable: ['name', 'code'],
    hasDefaultFlag: true,
  },
  payment_methods: {
    table: 'payment_methods',
    columns: ['name', 'code'],
    required: ['name', 'code'],
    searchable: ['name'],
  },
  contribution_types: {
    table: 'contribution_types',
    // Optional -- shown instead of `name` in the Contributions form/grid and
    // printed receipts when the site's language is Tamil (see
    // localized-name.util.ts); falls back to `name` when blank. Same
    // pattern as masses/prayer_intention_master's own name_ta.
    columns: ['name', 'name_ta', 'code', 'description'],
    required: ['name', 'code'],
    searchable: ['name'],
  },
  donation_types: {
    table: 'contribution_types',
    columns: ['name', 'name_ta', 'code', 'description'],
    required: ['name', 'code'],
    searchable: ['name'],
  },
  document_types: {
    table: 'document_types',
    columns: ['name', 'code'],
    required: ['name', 'code'],
    searchable: ['name'],
  },
  prayer_categories: {
    table: 'prayer_categories',
    columns: ['name', 'code', 'sort_order'],
    required: ['name', 'code'],
    searchable: ['name'],
    hasSortOrder: true,
  },
  prayer_intention_master: {
    table: 'prayer_intention_master',
    columns: ['category_id', 'name', 'name_ta', 'sort_order', 'is_custom'],
    required: ['name'],
    searchable: ['name'],
    hasSortOrder: true,
    joins: [{ column: 'category_id', table: 'prayer_categories', labelColumn: 'name', alias: 'category_name' }],
  },
  special_feasts: {
    table: 'special_feasts',
    columns: ['church_id', 'name', 'feast_date', 'is_recurring_yearly'],
    required: ['name', 'feast_date'],
    searchable: ['name'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
    // church_id is nullable here -- a NULL row is a deliberate shared/global
    // entry, same convention as holidays/announcements below.
    churchScope: 'nullable',
  },
  holidays: {
    table: 'holidays',
    // is_active is otherwise an audit-only column on every master, never
    // directly editable -- listed here for the same reason as
    // announcements.columns below: a Yearly-recurring Restricted Date never
    // auto-expires off the Dashboard's Upcoming Restricted Dates on its own
    // (unlike a one-time date, which just falls off once it passes), so
    // Masters' "Remove from Dashboard" action (master-list.ts's
    // toggleDashboardVisibility) needs to PUT { is_active: false } through
    // this same generic update() too.
    columns: ['church_id', 'name', 'holiday_date', 'reason', 'is_recurring_yearly', 'is_active'],
    required: ['name', 'holiday_date'],
    searchable: ['name'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
    // church_id is nullable -- NULL means "applies to every church" (see
    // lookupRepository.getActiveRestrictedDates, which already treats it
    // that way); this filter must keep those rows visible everywhere.
    churchScope: 'nullable',
  },
  announcements: {
    table: 'announcements',
    // is_active is otherwise an audit-only column on every master, never
    // directly editable -- listed here so the Dashboard's/Masters' "Remove
    // from Dashboard" action (permanent announcements only; see
    // dashboard.ts/master-list.ts) can PUT { is_active: false } through the
    // generic update() without a one-off endpoint. This deliberately stops
    // short of is_deleted -- the row stays visible (marked Inactive) in
    // Masters rather than being soft-deleted outright; masters.delete does
    // that separately.
    columns: ['church_id', 'title', 'body', 'start_date', 'end_date', 'status', 'is_active'],
    required: ['title'],
    searchable: ['title'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
    // church_id is nullable -- NULL means "shown to every church" (see
    // lookupRepository.getActiveAnnouncements); must stay visible everywhere.
    churchScope: 'nullable',
  },
  receipt_series: {
    table: 'receipt_series',
    columns: ['church_id', 'series_name', 'prefix', 'next_number', 'number_padding', 'financial_year'],
    required: ['church_id', 'series_name', 'prefix'],
    searchable: ['series_name', 'prefix'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
    churchScope: 'strict',
  },
  certificate_series: {
    table: 'certificate_series',
    columns: ['church_id', 'certificate_type', 'prefix', 'next_number', 'number_padding'],
    required: ['church_id', 'certificate_type', 'prefix'],
    searchable: ['prefix'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
    churchScope: 'strict',
  },
  print_templates: {
    table: 'print_templates',
    columns: ['name', 'module', 'template_html', 'is_default'],
    required: ['name', 'module', 'template_html'],
    searchable: ['name', 'module'],
  },
  email_templates: {
    table: 'email_templates',
    columns: ['name', 'code', 'subject', 'body'],
    required: ['name', 'code', 'subject', 'body'],
    searchable: ['name', 'code'],
  },
  sms_templates: {
    table: 'sms_templates',
    columns: ['name', 'code', 'body'],
    required: ['name', 'code', 'body'],
    searchable: ['name', 'code'],
  },
  system_settings: {
    table: 'system_settings',
    columns: ['setting_key', 'setting_value', 'description'],
    required: ['setting_key'],
    searchable: ['setting_key', 'description'],
  },
  // `statuses` intentionally NOT registered here -- the Pending/Completed/
  // Cancelled workflow it drove (via prayer_intentions.status_id) was
  // retired in migration 014 (superseded by the payment-existence check),
  // and nothing in the app reads it anymore. The table, its FK, and the 15
  // historical status_id values on existing mass intentions are left
  // untouched in the database -- this only removes it from the Masters
  // admin UI/API surface, per user request.
};

module.exports = registry;
