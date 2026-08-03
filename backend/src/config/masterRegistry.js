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
      'name', 'registration_no', 'address_line1', 'address_line2', 'city',
      'district_id', 'state_id', 'country_id', 'pincode', 'phone', 'email',
      'website', 'logo_url', 'established_date',
    ],
    required: ['name'],
    searchable: ['name', 'city', 'registration_no'],
  },
  branches: {
    table: 'branches',
    columns: ['church_id', 'name', 'code', 'address', 'phone', 'email'],
    required: ['church_id', 'name'],
    searchable: ['name', 'code'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
  },
  priests: {
    table: 'priests',
    columns: ['church_id', 'name', 'title', 'phone', 'email', 'is_parish_priest'],
    required: ['church_id', 'name'],
    searchable: ['name'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
  },
  masses: {
    table: 'masses',
    columns: ['church_id', 'branch_id', 'name', 'mass_time', 'day_type', 'sort_order'],
    required: ['church_id', 'name', 'mass_time', 'day_type'],
    searchable: ['name'],
    hasSortOrder: true,
    joins: [
      { column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' },
      { column: 'branch_id', table: 'branches', labelColumn: 'name', alias: 'branch_name' },
    ],
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
  },
  currencies: {
    table: 'currencies',
    columns: ['name', 'code', 'symbol'],
    required: ['name', 'code', 'symbol'],
    searchable: ['name', 'code'],
  },
  payment_methods: {
    table: 'payment_methods',
    columns: ['name', 'code'],
    required: ['name', 'code'],
    searchable: ['name'],
  },
  donation_types: {
    table: 'donation_types',
    columns: ['name', 'code', 'description'],
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
    columns: ['category_id', 'name', 'sort_order', 'is_custom'],
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
  },
  holidays: {
    table: 'holidays',
    columns: ['church_id', 'name', 'holiday_date', 'is_recurring_yearly'],
    required: ['name', 'holiday_date'],
    searchable: ['name'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
  },
  announcements: {
    table: 'announcements',
    columns: ['church_id', 'title', 'body', 'start_date', 'end_date'],
    required: ['title'],
    searchable: ['title'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
  },
  receipt_series: {
    table: 'receipt_series',
    columns: ['church_id', 'series_name', 'prefix', 'next_number', 'number_padding', 'financial_year'],
    required: ['church_id', 'series_name', 'prefix'],
    searchable: ['series_name', 'prefix'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
  },
  certificate_series: {
    table: 'certificate_series',
    columns: ['church_id', 'certificate_type', 'prefix', 'next_number', 'number_padding'],
    required: ['church_id', 'certificate_type', 'prefix'],
    searchable: ['prefix'],
    joins: [{ column: 'church_id', table: 'churches', labelColumn: 'name', alias: 'church_name' }],
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
  statuses: {
    table: 'statuses',
    columns: ['entity_type', 'code', 'label', 'color', 'sort_order'],
    required: ['entity_type', 'code', 'label'],
    searchable: ['label', 'code', 'entity_type'],
    hasSortOrder: true,
  },
};

module.exports = registry;
