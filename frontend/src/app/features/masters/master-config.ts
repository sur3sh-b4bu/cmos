import { DataTableColumn } from '../../shared/components/data-table/data-table.model';

export interface MasterFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'select' | 'textarea';
  required?: boolean;
  masterKey?: string; // for 'select' fields backed by another master table
  options?: { value: string; label: string }[]; // for 'select' fields with a fixed set of choices (DB ENUMs)
  span2?: boolean;
}

export interface MasterGroup {
  label: string;
  icon: string;
  items: { key: string; label: string }[];
}

export interface MasterConfig {
  key: string;
  label: string;
  singularLabel: string;
  icon: string;
  hasSortOrder?: boolean;
  columns: DataTableColumn[];
  formFields: MasterFormField[];
}

const REQUIRED_TEXT = (key: string, label: string): MasterFormField => ({ key, label, type: 'text', required: true });
const TEXT = (key: string, label: string): MasterFormField => ({ key, label, type: 'text' });

export const MASTER_CONFIGS: Record<string, MasterConfig> = {
  churches: {
    key: 'churches',
    label: 'Churches',
    singularLabel: 'Church',
    icon: 'church',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'city', label: 'City' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'Church Name'),
      TEXT('registration_no', 'Registration No.'),
      { key: 'address_line1', label: 'Address Line 1', type: 'text', span2: true },
      TEXT('address_line2', 'Address Line 2'),
      TEXT('city', 'City'),
      TEXT('pincode', 'Pincode'),
      TEXT('phone', 'Phone'),
      TEXT('email', 'Email'),
      TEXT('website', 'Website'),
      { key: 'established_date', label: 'Established Date', type: 'date' },
    ],
  },
  branches: {
    key: 'branches',
    label: 'Branches',
    singularLabel: 'Branch',
    icon: 'account_tree',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
      { key: 'church_name', label: 'Church' },
      { key: 'phone', label: 'Phone' },
    ],
    formFields: [
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches', required: true },
      REQUIRED_TEXT('name', 'Branch Name'),
      TEXT('code', 'Code'),
      { key: 'address', label: 'Address', type: 'text', span2: true },
      TEXT('phone', 'Phone'),
      TEXT('email', 'Email'),
    ],
  },
  priests: {
    key: 'priests',
    label: 'Priests',
    singularLabel: 'Priest',
    icon: 'person',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'title', label: 'Title' },
      { key: 'church_name', label: 'Church' },
      { key: 'phone', label: 'Phone' },
    ],
    formFields: [
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches', required: true },
      REQUIRED_TEXT('name', 'Name'),
      TEXT('title', 'Title'),
      TEXT('phone', 'Phone'),
      TEXT('email', 'Email'),
      { key: 'is_parish_priest', label: 'Parish Priest', type: 'checkbox' },
    ],
  },
  masses: {
    key: 'masses',
    label: 'Mass Master',
    singularLabel: 'Mass',
    icon: 'schedule',
    hasSortOrder: true,
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'mass_time', label: 'Time' },
      { key: 'day_type', label: 'Day Type' },
      { key: 'church_name', label: 'Church' },
    ],
    formFields: [
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches', required: true },
      { key: 'branch_id', label: 'Branch', type: 'select', masterKey: 'branches' },
      REQUIRED_TEXT('name', 'Mass Name'),
      { key: 'mass_time', label: 'Time', type: 'text', required: true },
      {
        key: 'day_type',
        label: 'Day Type',
        type: 'select',
        required: true,
        options: [
          { value: 'Daily', label: 'Daily (Mon-Sat)' },
          { value: 'Sunday', label: 'Sunday' },
          { value: 'Special', label: 'Special / Feast Day' },
        ],
      },
    ],
  },
  prayer_categories: {
    key: 'prayer_categories',
    label: 'Prayer Category Master',
    singularLabel: 'Prayer Category',
    icon: 'category',
    hasSortOrder: true,
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code')],
  },
  prayer_intention_master: {
    key: 'prayer_intention_master',
    label: 'Prayer Intention Master',
    singularLabel: 'Prayer Intention',
    icon: 'volunteer_activism',
    hasSortOrder: true,
    columns: [
      { key: 'name', label: 'Intention', sortable: true },
      { key: 'category_name', label: 'Category' },
      { key: 'is_custom', label: 'Allows Custom Text', accessor: (r: any) => (r.is_custom ? 'Yes' : 'No') },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'Intention Text'),
      { key: 'category_id', label: 'Category', type: 'select', masterKey: 'prayer_categories' },
      { key: 'is_custom', label: "Is 'Others' (free text)", type: 'checkbox' },
    ],
  },
  special_feasts: {
    key: 'special_feasts',
    label: 'Special Feast Master',
    singularLabel: 'Special Feast',
    icon: 'celebration',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'feast_date', label: 'Date' },
      { key: 'is_recurring_yearly', label: 'Recurring', accessor: (r: any) => (r.is_recurring_yearly ? 'Yearly' : 'One-time') },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'Name'),
      { key: 'feast_date', label: 'Date', type: 'date', required: true },
      { key: 'is_recurring_yearly', label: 'Recurs Every Year', type: 'checkbox' },
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches' },
    ],
  },
  holidays: {
    key: 'holidays',
    label: 'Holiday Master',
    singularLabel: 'Holiday',
    icon: 'event_busy',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'holiday_date', label: 'Date' },
      { key: 'is_recurring_yearly', label: 'Recurring', accessor: (r: any) => (r.is_recurring_yearly ? 'Yearly' : 'One-time') },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'Name'),
      { key: 'holiday_date', label: 'Date', type: 'date', required: true },
      { key: 'is_recurring_yearly', label: 'Recurs Every Year', type: 'checkbox' },
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches' },
    ],
  },
  announcements: {
    key: 'announcements',
    label: 'Announcement Master',
    singularLabel: 'Announcement',
    icon: 'campaign',
    columns: [
      { key: 'title', label: 'Title', sortable: true },
      { key: 'start_date', label: 'From' },
      { key: 'end_date', label: 'To' },
    ],
    formFields: [
      REQUIRED_TEXT('title', 'Title'),
      { key: 'body', label: 'Body', type: 'textarea', span2: true },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'end_date', label: 'End Date', type: 'date' },
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches' },
    ],
  },
  receipt_series: {
    key: 'receipt_series',
    label: 'Receipt Series Master',
    singularLabel: 'Receipt Series',
    icon: 'receipt_long',
    columns: [
      { key: 'series_name', label: 'Series Name', sortable: true },
      { key: 'prefix', label: 'Prefix' },
      { key: 'next_number', label: 'Next Number' },
      { key: 'church_name', label: 'Church' },
    ],
    formFields: [
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches', required: true },
      REQUIRED_TEXT('series_name', 'Series Name'),
      REQUIRED_TEXT('prefix', 'Prefix'),
      { key: 'next_number', label: 'Next Number', type: 'number', required: true },
      { key: 'number_padding', label: 'Number Padding (digits)', type: 'number' },
      TEXT('financial_year', 'Financial Year'),
    ],
  },
  certificate_series: {
    key: 'certificate_series',
    label: 'Certificate Series Master',
    singularLabel: 'Certificate Series',
    icon: 'workspace_premium',
    columns: [
      { key: 'certificate_type', label: 'Type', sortable: true },
      { key: 'prefix', label: 'Prefix' },
      { key: 'next_number', label: 'Next Number' },
      { key: 'church_name', label: 'Church' },
    ],
    formFields: [
      { key: 'church_id', label: 'Church', type: 'select', masterKey: 'churches', required: true },
      {
        key: 'certificate_type',
        label: 'Certificate Type',
        type: 'select',
        required: true,
        options: [
          { value: 'Baptism', label: 'Baptism' },
          { value: 'Marriage', label: 'Marriage' },
          { value: 'Death', label: 'Death' },
          { value: 'Confirmation', label: 'Confirmation' },
          { value: 'FirstCommunion', label: 'First Communion' },
        ],
      },
      REQUIRED_TEXT('prefix', 'Prefix'),
      { key: 'next_number', label: 'Next Number', type: 'number', required: true },
      { key: 'number_padding', label: 'Number Padding (digits)', type: 'number' },
    ],
  },
  genders: {
    key: 'genders',
    label: 'Gender Master',
    singularLabel: 'Gender',
    icon: 'wc',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code')],
  },
  departments: {
    key: 'departments',
    label: 'Department Master',
    singularLabel: 'Department',
    icon: 'apartment',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code')],
  },
  languages: {
    key: 'languages',
    label: 'Language Master',
    singularLabel: 'Language',
    icon: 'translate',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code')],
  },
  currencies: {
    key: 'currencies',
    label: 'Currency Master',
    singularLabel: 'Currency',
    icon: 'currency_exchange',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
      { key: 'symbol', label: 'Symbol' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code'), REQUIRED_TEXT('symbol', 'Symbol')],
  },
  payment_methods: {
    key: 'payment_methods',
    label: 'Payment Method Master',
    singularLabel: 'Payment Method',
    icon: 'payments',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code')],
  },
  donation_types: {
    key: 'donation_types',
    label: 'Donation Type Master',
    singularLabel: 'Donation Type',
    icon: 'volunteer_activism',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
      { key: 'description', label: 'Description' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code'), TEXT('description', 'Description')],
  },
  document_types: {
    key: 'document_types',
    label: 'Document Type Master',
    singularLabel: 'Document Type',
    icon: 'description',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('code', 'Code')],
  },
  countries: {
    key: 'countries',
    label: 'Country Master',
    singularLabel: 'Country',
    icon: 'public',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'iso_code', label: 'ISO Code' },
      { key: 'phone_code', label: 'Phone Code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'Name'), REQUIRED_TEXT('iso_code', 'ISO Code'), TEXT('phone_code', 'Phone Code')],
  },
  states: {
    key: 'states',
    label: 'State Master',
    singularLabel: 'State',
    icon: 'map',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
      { key: 'country_name', label: 'Country' },
    ],
    formFields: [
      { key: 'country_id', label: 'Country', type: 'select', masterKey: 'countries', required: true },
      REQUIRED_TEXT('name', 'Name'),
      TEXT('code', 'Code'),
    ],
  },
  districts: {
    key: 'districts',
    label: 'District Master',
    singularLabel: 'District',
    icon: 'location_city',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
      { key: 'state_name', label: 'State' },
    ],
    formFields: [
      { key: 'state_id', label: 'State', type: 'select', masterKey: 'states', required: true },
      REQUIRED_TEXT('name', 'Name'),
      TEXT('code', 'Code'),
    ],
  },
  statuses: {
    key: 'statuses',
    label: 'Status Master',
    singularLabel: 'Status',
    icon: 'flag',
    hasSortOrder: true,
    columns: [
      { key: 'label', label: 'Label', sortable: true },
      { key: 'entity_type', label: 'Entity Type' },
      { key: 'code', label: 'Code' },
      { key: 'color', label: 'Color' },
    ],
    formFields: [
      REQUIRED_TEXT('entity_type', 'Entity Type'),
      REQUIRED_TEXT('code', 'Code'),
      REQUIRED_TEXT('label', 'Label'),
      TEXT('color', 'Color (hex)'),
    ],
  },
  print_templates: {
    key: 'print_templates',
    label: 'Print Template Master',
    singularLabel: 'Print Template',
    icon: 'print',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'module', label: 'Module' },
      { key: 'is_default', label: 'Default', accessor: (r: any) => (r.is_default ? 'Yes' : 'No') },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'Name'),
      REQUIRED_TEXT('module', 'Module'),
      { key: 'template_html', label: 'Template HTML', type: 'textarea', required: true, span2: true },
      { key: 'is_default', label: 'Default Template', type: 'checkbox' },
    ],
  },
  email_templates: {
    key: 'email_templates',
    label: 'Email Template Master',
    singularLabel: 'Email Template',
    icon: 'email',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
      { key: 'subject', label: 'Subject' },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'Name'),
      REQUIRED_TEXT('code', 'Code'),
      REQUIRED_TEXT('subject', 'Subject'),
      { key: 'body', label: 'Body', type: 'textarea', required: true, span2: true },
    ],
  },
  sms_templates: {
    key: 'sms_templates',
    label: 'SMS Template Master',
    singularLabel: 'SMS Template',
    icon: 'sms',
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'code', label: 'Code' },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'Name'),
      REQUIRED_TEXT('code', 'Code'),
      { key: 'body', label: 'Body', type: 'textarea', required: true, span2: true },
    ],
  },
  system_settings: {
    key: 'system_settings',
    label: 'System Settings',
    singularLabel: 'Setting',
    icon: 'settings',
    columns: [
      { key: 'setting_key', label: 'Key', sortable: true },
      { key: 'setting_value', label: 'Value' },
      { key: 'description', label: 'Description' },
    ],
    formFields: [
      REQUIRED_TEXT('setting_key', 'Setting Key'),
      TEXT('setting_value', 'Value'),
      { key: 'description', label: 'Description', type: 'textarea', span2: true },
    ],
  },
};

export const MASTER_GROUPS: MasterGroup[] = [
  {
    label: 'Church Setup',
    icon: 'church',
    items: [
      { key: 'churches', label: 'Churches' },
      { key: 'branches', label: 'Branches' },
      { key: 'priests', label: 'Priests' },
      { key: 'masses', label: 'Masses' },
    ],
  },
  {
    label: 'Prayer & Calendar',
    icon: 'volunteer_activism',
    items: [
      { key: 'prayer_categories', label: 'Prayer Categories' },
      { key: 'prayer_intention_master', label: 'Prayer Intentions' },
      { key: 'special_feasts', label: 'Special Feasts' },
      { key: 'holidays', label: 'Holidays' },
      { key: 'announcements', label: 'Announcements' },
    ],
  },
  {
    label: 'Numbering',
    icon: 'tag',
    items: [
      { key: 'receipt_series', label: 'Receipt Series' },
      { key: 'certificate_series', label: 'Certificate Series' },
    ],
  },
  {
    label: 'Lookups',
    icon: 'list',
    items: [
      { key: 'genders', label: 'Genders' },
      { key: 'departments', label: 'Departments' },
      { key: 'languages', label: 'Languages' },
      { key: 'currencies', label: 'Currencies' },
      { key: 'payment_methods', label: 'Payment Methods' },
      { key: 'donation_types', label: 'Donation Types' },
      { key: 'document_types', label: 'Document Types' },
      { key: 'statuses', label: 'Statuses' },
    ],
  },
  {
    label: 'Geography',
    icon: 'public',
    items: [
      { key: 'countries', label: 'Countries' },
      { key: 'states', label: 'States' },
      { key: 'districts', label: 'Districts' },
    ],
  },
  {
    label: 'Templates & Settings',
    icon: 'tune',
    items: [
      { key: 'print_templates', label: 'Print Templates' },
      { key: 'email_templates', label: 'Email Templates' },
      { key: 'sms_templates', label: 'SMS Templates' },
      { key: 'system_settings', label: 'System Settings' },
    ],
  },
];
