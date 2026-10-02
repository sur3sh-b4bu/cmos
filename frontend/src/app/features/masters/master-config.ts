import { DataTableColumn } from '../../shared/components/data-table/data-table.model';
import { formatDateDMY } from '../../core/utils/date-format.util';

export interface MasterFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'select' | 'textarea';
  required?: boolean;
  masterKey?: string; // for 'select' fields backed by another master table
  options?: { value: string; label: string }[]; // for 'select' fields with a fixed set of choices (DB ENUMs)
  span2?: boolean;
  /** Prefilled on a NEW record's form (checkboxes already default to false
   * without this -- see master-form.ts's buildForm()). Mainly for a
   * fixed-`options` select backed by a NOT NULL DB column with its own
   * DEFAULT, so a fresh row doesn't submit `null` and violate it (e.g.
   * announcements.status). */
  default?: string | number;
  /** Shows the "Type in Bamini" toggle (see mass-intention-form.ts's
   * identical per-field toggle / bamini-to-unicode.util.ts) on this text/
   * textarea field -- only set on fields where someone plausibly wants to
   * type Tamil (names, titles, descriptions, addresses, message bodies).
   * Left off structured/technical fields (Code, Email, Phone, Website,
   * ISO Code, Setting Key, template markup, ...) where it'd just be
   * clutter -- see master-form.ts's own baminiSignal()/toggleBamini(). */
  bamini?: boolean;
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
  /** Exactly one row can be "the default" (Languages, Currencies) --
   * deleting it auto-promotes the next remaining row (see backend's
   * genericMasterRepository); MasterListComponent shows a Default chip and
   * a "Set Default" action when this is true. */
  hasDefaultFlag?: boolean;
  /** Shows a logo upload widget above the regular fields, in edit mode only
   * (the upload endpoint needs an existing record id). Separate from
   * formFields because it's a multipart upload against a dedicated endpoint,
   * not part of the plain JSON create/update payload -- see
   * master-form.ts's onLogoSelected(). Currently only churches. */
  logoUpload?: boolean;
  columns: DataTableColumn[];
  formFields: MasterFormField[];
}

const REQUIRED_TEXT = (key: string, label: string, bamini = false): MasterFormField => ({
  key,
  label,
  type: 'text',
  required: true,
  ...(bamini ? { bamini: true } : {}),
});
const TEXT = (key: string, label: string, bamini = false): MasterFormField => ({
  key,
  label,
  type: 'text',
  ...(bamini ? { bamini: true } : {}),
});

// churches.theme_color options -- kept as one source of truth so the form's
// dropdown and the list column's accessor (below) can't drift apart. Every
// option pairs with the same gold accent; only the "primary" hue changes
// (see _tokens.scss's [data-brand-theme] blocks).
const THEME_COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'blue', label: 'masters.fields.themeColorBlue' },
  { value: 'green', label: 'masters.fields.themeColorGreen' },
  { value: 'red', label: 'masters.fields.themeColorRed' },
  { value: 'violet', label: 'masters.fields.themeColorViolet' },
  { value: 'orange', label: 'masters.fields.themeColorOrange' },
  { value: 'purple', label: 'masters.fields.themeColorPurple' },
  { value: 'pink', label: 'masters.fields.themeColorPink' },
  { value: 'teal', label: 'masters.fields.themeColorTeal' },
  { value: 'maroon', label: 'masters.fields.themeColorMaroon' },
  { value: 'slate', label: 'masters.fields.themeColorSlate' },
  { value: 'amber', label: 'masters.fields.themeColorAmber' },
  { value: 'cyan', label: 'masters.fields.themeColorCyan' },
  { value: 'olive', label: 'masters.fields.themeColorOlive' },
  { value: 'bronze', label: 'masters.fields.themeColorBronze' },
  { value: 'plum', label: 'masters.fields.themeColorPlum' },
];
const themeColorLabel = (value: string | null | undefined): string =>
  THEME_COLOR_OPTIONS.find((o) => o.value === value)?.label ?? THEME_COLOR_OPTIONS[0].label;

export const MASTER_CONFIGS: Record<string, MasterConfig> = {
  churches: {
    key: 'churches',
    label: 'masters.churches.label',
    singularLabel: 'masters.churches.singularLabel',
    icon: 'church',
    logoUpload: true,
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'name_ta', label: 'masters.fields.nameTamil', accessor: (r: any) => r.name_ta || '-' },
      { key: 'diocese', label: 'masters.fields.diocese' },
      { key: 'city', label: 'masters.fields.city' },
      { key: 'phone', label: 'masters.fields.phone' },
      { key: 'email', label: 'masters.fields.email' },
      { key: 'theme_color', label: 'masters.fields.themeColor', accessor: (r: any) => themeColorLabel(r.theme_color) },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'masters.fields.churchName', true),
      // Optional -- shown instead of `name` on printed receipts/registers
      // and the app header when the site's language is Tamil (see
      // localized-name.util.ts); falls back to `name` when blank. NOT used
      // on certificates or the always-English collections reports -- see
      // migration 031's own comment.
      TEXT('name_ta', 'masters.fields.churchNameTamil', true),
      // Printed on Baptism/Marriage/Death certificates (e.g. "Tuticorin
      // Diocese") -- see certificatePdf.js.
      TEXT('diocese', 'masters.fields.diocese', true),
      TEXT('registration_no', 'masters.fields.registrationNo'),
      { key: 'address_line1', label: 'masters.fields.addressLine1', type: 'text', span2: true, bamini: true },
      TEXT('address_line2', 'masters.fields.addressLine2', true),
      // Optional single-line Tamil override for the printed address line
      // (Address Line 1 + City combined) -- see migration 032's own
      // comment for why it's one free-text field rather than a per-field
      // translation.
      { key: 'address_ta', label: 'masters.fields.addressTamil', type: 'text', span2: true, bamini: true },
      TEXT('city', 'masters.fields.city', true),
      TEXT('pincode', 'masters.fields.pincode'),
      TEXT('phone', 'masters.fields.phone'),
      TEXT('email', 'masters.fields.email'),
      TEXT('website', 'masters.fields.website'),
      { key: 'established_date', label: 'masters.fields.establishedDate', type: 'date' },
      // Drives this church's sidebar/header/button color scheme app-wide --
      // see _tokens.scss's [data-brand-theme] overrides.
      {
        key: 'theme_color',
        label: 'masters.fields.themeColor',
        type: 'select',
        options: THEME_COLOR_OPTIONS,
        // churches.theme_color is NOT NULL DEFAULT 'blue' -- without this,
        // a fresh New Church form leaves the field at null (see
        // MasterFormField.default's own doc comment) and submit() sends
        // that explicit null through, which genericMasterRepository.create()
        // includes in the INSERT column list verbatim -- bypassing the
        // column's own DEFAULT and hitting MySQL's NOT NULL constraint
        // instead ("Column 'theme_color' cannot be null").
        default: 'blue',
      },
    ],
  },
  branches: {
    key: 'branches',
    label: 'masters.branches.label',
    singularLabel: 'masters.branches.singularLabel',
    icon: 'account_tree',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
      { key: 'church_name', label: 'masters.churches.singularLabel' },
      { key: 'phone', label: 'masters.fields.phone' },
    ],
    formFields: [
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches', required: true },
      REQUIRED_TEXT('name', 'masters.fields.branchName', true),
      TEXT('code', 'masters.fields.code'),
      { key: 'address', label: 'masters.fields.address', type: 'text', span2: true, bamini: true },
      TEXT('phone', 'masters.fields.phone'),
      TEXT('email', 'masters.fields.email'),
    ],
  },
  priests: {
    key: 'priests',
    label: 'masters.priests.label',
    singularLabel: 'masters.priests.singularLabel',
    icon: 'person',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'title', label: 'masters.fields.title' },
      { key: 'church_name', label: 'masters.churches.singularLabel' },
      { key: 'phone', label: 'masters.fields.phone' },
    ],
    formFields: [
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches', required: true },
      REQUIRED_TEXT('name', 'common.name', true),
      TEXT('title', 'masters.fields.title', true),
      TEXT('phone', 'masters.fields.phone'),
      TEXT('email', 'masters.fields.email'),
      { key: 'is_parish_priest', label: 'masters.fields.parishPriest', type: 'checkbox' },
    ],
  },
  masses: {
    key: 'masses',
    label: 'masters.masses.label',
    singularLabel: 'masters.masses.singularLabel',
    icon: 'schedule',
    hasSortOrder: true,
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'name_ta', label: 'masters.fields.nameTamil', accessor: (r: any) => r.name_ta || '-' },
      { key: 'mass_time', label: 'masters.fields.time' },
      { key: 'day_type', label: 'masters.fields.dayType' },
      { key: 'default_offering_amount', label: 'masters.fields.defaultOfferingAmount' },
      { key: 'offering_description', label: 'masters.fields.offeringDescription', accessor: (r: any) => r.offering_description || '-' },
      { key: 'church_name', label: 'masters.churches.singularLabel' },
    ],
    formFields: [
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches', required: true },
      { key: 'branch_id', label: 'masters.fields.branch', type: 'select', masterKey: 'branches' },
      REQUIRED_TEXT('name', 'masters.fields.massName', true),
      // Optional -- shown in the Mass Intention form/grid and printed
      // receipts/register instead of `name` when the site's language is
      // Tamil (see localized-name.util.ts); falls back to `name` when blank.
      TEXT('name_ta', 'masters.fields.massNameTamil', true),
      // A native time picker, not free text -- Masses used to let staff type
      // anything here (e.g. "10:00 - 12:00"), which the DB's single TIME
      // column can't store and which failed as an unhelpful generic error
      // (see errorHandler.js's ER_TRUNCATED_WRONG_VALUE handling for the
      // server-side half of this fix). A picker can only ever produce one
      // valid HH:MM value.
      { key: 'mass_time', label: 'masters.fields.time', type: 'time', required: true },
      {
        key: 'day_type',
        label: 'masters.fields.dayType',
        type: 'select',
        required: true,
        options: [
          { value: 'Daily', label: 'masters.fields.dayTypeDaily' },
          { value: 'Sunday', label: 'masters.fields.dayTypeSunday' },
          { value: 'Special', label: 'masters.fields.dayTypeSpecial' },
        ],
      },
      // Pre-fills the Mass Intention form's Offering Amount when this Mass
      // is selected there -- see mass-intention-form.ts. Replaces the old
      // per-church Offering Amount Defaults master (migration 024).
      { key: 'default_offering_amount', label: 'masters.fields.defaultOfferingAmount', type: 'number', required: true },
      // Optional note shown alongside this Mass on the Mass Intention form
      // when it's selected (see mass-intention-form.ts/.html) and printed
      // on the Mass Intention receipt (see receiptPdf.js) -- e.g. what the
      // offering is customarily intended for.
      { key: 'offering_description', label: 'masters.fields.offeringDescription', type: 'textarea', span2: true, bamini: true },
    ],
  },
  // Internal key/table stay `prayer_categories`/`prayer_intention_master`
  // (matches masterRegistry.js and the DB tables) -- only the label users
  // see changes, same reasoning as the holidays->Restricted Dates rename below.
  prayer_categories: {
    key: 'prayer_categories',
    label: 'masters.prayerCategories.label',
    singularLabel: 'masters.prayerCategories.singularLabel',
    icon: 'category',
    hasSortOrder: true,
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name', true), REQUIRED_TEXT('code', 'masters.fields.code')],
  },
  prayer_intention_master: {
    key: 'prayer_intention_master',
    label: 'masters.prayerIntentionMaster.label',
    singularLabel: 'masters.prayerIntentionMaster.singularLabel',
    icon: 'volunteer_activism',
    hasSortOrder: true,
    columns: [
      { key: 'name', label: 'masters.fields.intention', sortable: true },
      { key: 'name_ta', label: 'masters.fields.intentionTamil', accessor: (r: any) => r.name_ta || '-' },
      { key: 'is_custom', label: 'masters.fields.allowsCustomText', accessor: (r: any) => (r.is_custom ? 'common.yes' : 'common.no') },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'masters.fields.intentionText', true),
      // Optional -- shown instead of `name` in the Mass Intention form/grid
      // and printed receipts/register when the site's language is Tamil
      // (see localized-name.util.ts); falls back to `name` when blank.
      TEXT('name_ta', 'masters.fields.intentionTextTamil', true),
      { key: 'is_custom', label: 'masters.fields.isOthersFreeText', type: 'checkbox' },
    ],
  },
  special_feasts: {
    key: 'special_feasts',
    label: 'masters.specialFeasts.label',
    singularLabel: 'masters.specialFeasts.singularLabel',
    icon: 'celebration',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'feast_date', label: 'common.date', accessor: (r: any) => formatDateDMY(r.feast_date) },
      {
        key: 'is_recurring_yearly',
        label: 'masters.fields.recurring',
        accessor: (r: any) => (r.is_recurring_yearly ? 'masters.fields.yearly' : 'masters.fields.oneTime'),
      },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'common.name', true),
      { key: 'feast_date', label: 'common.date', type: 'date', required: true },
      { key: 'is_recurring_yearly', label: 'masters.fields.recursEveryYear', type: 'checkbox' },
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches' },
    ],
  },
  // Internal key/table stay `holidays` (matches masterRegistry.js and the DB
  // table -- renaming those would ripple into API routes and audit-log
  // history for no user-facing benefit). Only the label users see changes.
  holidays: {
    key: 'holidays',
    label: 'masters.holidays.label',
    singularLabel: 'masters.holidays.singularLabel',
    icon: 'event_busy',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'holiday_date', label: 'common.date', accessor: (r: any) => formatDateDMY(r.holiday_date) },
      { key: 'reason', label: 'masters.fields.reason', accessor: (r: any) => r.reason || '-' },
      {
        key: 'is_recurring_yearly',
        label: 'masters.fields.recurring',
        accessor: (r: any) => (r.is_recurring_yearly ? 'masters.fields.yearly' : 'masters.fields.oneTime'),
      },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'common.name', true),
      { key: 'holiday_date', label: 'common.date', type: 'date', required: true },
      { key: 'reason', label: 'masters.fields.reasonHint', type: 'textarea', bamini: true },
      { key: 'is_recurring_yearly', label: 'masters.fields.recursEveryYear', type: 'checkbox' },
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches' },
    ],
  },
  announcements: {
    key: 'announcements',
    label: 'masters.announcements.label',
    singularLabel: 'masters.announcements.singularLabel',
    icon: 'campaign',
    columns: [
      { key: 'title', label: 'masters.fields.title', sortable: true },
      {
        key: 'status',
        label: 'common.status',
        accessor: (r: any) => (r.status === 'permanent' ? 'masters.fields.permanent' : 'masters.fields.temporary'),
      },
      { key: 'start_date', label: 'common.from', accessor: (r: any) => formatDateDMY(r.start_date) },
      { key: 'end_date', label: 'common.to', accessor: (r: any) => formatDateDMY(r.end_date) },
    ],
    formFields: [
      REQUIRED_TEXT('title', 'masters.fields.title', true),
      { key: 'body', label: 'masters.fields.body', type: 'textarea', span2: true, bamini: true },
      {
        key: 'status',
        label: 'common.status',
        type: 'select',
        required: true,
        default: 'temporary',
        options: [
          { value: 'temporary', label: 'masters.fields.announcementTemporary' },
          { value: 'permanent', label: 'masters.fields.announcementPermanent' },
        ],
      },
      { key: 'start_date', label: 'masters.fields.startDate', type: 'date' },
      { key: 'end_date', label: 'masters.fields.endDateIgnored', type: 'date' },
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches' },
    ],
  },
  receipt_series: {
    key: 'receipt_series',
    label: 'masters.receiptSeries.label',
    singularLabel: 'masters.receiptSeries.singularLabel',
    icon: 'receipt_long',
    columns: [
      { key: 'series_name', label: 'masters.fields.seriesName', sortable: true },
      { key: 'prefix', label: 'masters.fields.prefix' },
      { key: 'next_number', label: 'masters.fields.nextNumber' },
      { key: 'church_name', label: 'masters.churches.singularLabel' },
    ],
    formFields: [
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches', required: true },
      REQUIRED_TEXT('series_name', 'masters.fields.seriesName'),
      REQUIRED_TEXT('prefix', 'masters.fields.prefix'),
      { key: 'next_number', label: 'masters.fields.nextNumber', type: 'number', required: true },
      { key: 'number_padding', label: 'masters.fields.numberPadding', type: 'number' },
      TEXT('financial_year', 'masters.fields.financialYear'),
    ],
  },
  certificate_series: {
    key: 'certificate_series',
    label: 'masters.certificateSeries.label',
    singularLabel: 'masters.certificateSeries.singularLabel',
    icon: 'workspace_premium',
    columns: [
      { key: 'certificate_type', label: 'reports.colType', sortable: true },
      { key: 'prefix', label: 'masters.fields.prefix' },
      { key: 'next_number', label: 'masters.fields.nextNumber' },
      { key: 'church_name', label: 'masters.churches.singularLabel' },
    ],
    formFields: [
      { key: 'church_id', label: 'masters.churches.singularLabel', type: 'select', masterKey: 'churches', required: true },
      {
        key: 'certificate_type',
        label: 'masters.fields.certificateType',
        type: 'select',
        required: true,
        options: [
          { value: 'Baptism', label: 'masters.fields.certTypeBaptism' },
          { value: 'Marriage', label: 'masters.fields.certTypeMarriage' },
          { value: 'Death', label: 'masters.fields.certTypeDeath' },
          { value: 'Confirmation', label: 'masters.fields.certTypeConfirmation' },
          { value: 'FirstCommunion', label: 'masters.fields.certTypeFirstCommunion' },
        ],
      },
      REQUIRED_TEXT('prefix', 'masters.fields.prefix'),
      { key: 'next_number', label: 'masters.fields.nextNumber', type: 'number', required: true },
      { key: 'number_padding', label: 'masters.fields.numberPadding', type: 'number' },
    ],
  },
  genders: {
    key: 'genders',
    label: 'masters.genders.label',
    singularLabel: 'masters.genders.singularLabel',
    icon: 'wc',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name', true), REQUIRED_TEXT('code', 'masters.fields.code')],
  },
  departments: {
    key: 'departments',
    label: 'masters.departments.label',
    singularLabel: 'masters.departments.singularLabel',
    icon: 'apartment',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name', true), REQUIRED_TEXT('code', 'masters.fields.code')],
  },
  languages: {
    key: 'languages',
    label: 'masters.languages.label',
    singularLabel: 'masters.languages.singularLabel',
    icon: 'translate',
    hasDefaultFlag: true,
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name'), REQUIRED_TEXT('code', 'masters.fields.code')],
  },
  currencies: {
    key: 'currencies',
    label: 'masters.currencies.label',
    singularLabel: 'masters.currencies.singularLabel',
    icon: 'currency_exchange',
    hasDefaultFlag: true,
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
      { key: 'symbol', label: 'masters.fields.symbol' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name'), REQUIRED_TEXT('code', 'masters.fields.code'), REQUIRED_TEXT('symbol', 'masters.fields.symbol')],
  },
  payment_methods: {
    key: 'payment_methods',
    label: 'masters.paymentMethods.label',
    singularLabel: 'masters.paymentMethods.singularLabel',
    icon: 'payments',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name', true), REQUIRED_TEXT('code', 'masters.fields.code')],
  },
  contribution_types: {
    key: 'contribution_types',
    label: 'masters.contributionTypes.label',
    singularLabel: 'masters.contributionTypes.singularLabel',
    icon: 'volunteer_activism',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'name_ta', label: 'masters.fields.nameTamil', accessor: (r: any) => r.name_ta || '-' },
      { key: 'code', label: 'masters.fields.code' },
      { key: 'description', label: 'masters.fields.description' },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'common.name', true),
      // Optional -- shown instead of `name` in the Contributions form/grid
      // and printed receipts when the site's language is Tamil (see
      // localized-name.util.ts); falls back to `name` when blank. Same
      // pattern as Masses/Mass Intention Presets' own name_ta.
      TEXT('name_ta', 'masters.fields.nameTamil', true),
      REQUIRED_TEXT('code', 'masters.fields.code'),
      // Not `bamini: true` -- unlike `name`/`name_ta` above, this is a plain
      // English administrative note (e.g. "For the annual church repair
      // fund"), not something anyone types in Tamil; the "Type in Bamini"
      // toggle here was silently mangling normal English text typed while
      // the site's language is Tamil (that toggle defaults on for a Tamil
      // site -- see LanguageService.isTamil()/master-form.ts's own
      // baminiSignal()) into meaningless Tamil-script glyphs. Matches
      // system_settings' own plain `description` field below.
      TEXT('description', 'masters.fields.description'),
    ],
  },
  document_types: {
    key: 'document_types',
    label: 'masters.documentTypes.label',
    singularLabel: 'masters.documentTypes.singularLabel',
    icon: 'description',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name'), REQUIRED_TEXT('code', 'masters.fields.code')],
  },
  countries: {
    key: 'countries',
    label: 'masters.countries.label',
    singularLabel: 'masters.countries.singularLabel',
    icon: 'public',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'iso_code', label: 'masters.fields.isoCode' },
      { key: 'phone_code', label: 'masters.fields.phoneCode' },
    ],
    formFields: [REQUIRED_TEXT('name', 'common.name'), REQUIRED_TEXT('iso_code', 'masters.fields.isoCode'), TEXT('phone_code', 'masters.fields.phoneCode')],
  },
  states: {
    key: 'states',
    label: 'masters.states.label',
    singularLabel: 'masters.states.singularLabel',
    icon: 'map',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
      { key: 'country_name', label: 'masters.fields.country' },
    ],
    formFields: [
      { key: 'country_id', label: 'masters.fields.country', type: 'select', masterKey: 'countries', required: true },
      REQUIRED_TEXT('name', 'common.name'),
      TEXT('code', 'masters.fields.code'),
    ],
  },
  districts: {
    key: 'districts',
    label: 'masters.districts.label',
    singularLabel: 'masters.districts.singularLabel',
    icon: 'location_city',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
      { key: 'state_name', label: 'masters.fields.state' },
    ],
    formFields: [
      { key: 'state_id', label: 'masters.fields.state', type: 'select', masterKey: 'states', required: true },
      REQUIRED_TEXT('name', 'common.name'),
      TEXT('code', 'masters.fields.code'),
    ],
  },
  // `statuses` intentionally not registered here -- removed from the
  // Masters admin UI along with its backend registry entry (see
  // masterRegistry.js) since nothing in the app reads it anymore; the
  // database table itself is left untouched.
  print_templates: {
    key: 'print_templates',
    label: 'masters.printTemplates.label',
    singularLabel: 'masters.printTemplates.singularLabel',
    icon: 'print',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'module', label: 'settings.module' },
      { key: 'is_default', label: 'masters.fields.default', accessor: (r: any) => (r.is_default ? 'common.yes' : 'common.no') },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'common.name'),
      REQUIRED_TEXT('module', 'settings.module'),
      { key: 'template_html', label: 'masters.fields.templateHtml', type: 'textarea', required: true, span2: true },
      { key: 'is_default', label: 'masters.fields.defaultTemplate', type: 'checkbox' },
    ],
  },
  email_templates: {
    key: 'email_templates',
    label: 'masters.emailTemplates.label',
    singularLabel: 'masters.emailTemplates.singularLabel',
    icon: 'email',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
      { key: 'subject', label: 'masters.fields.subject' },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'common.name'),
      REQUIRED_TEXT('code', 'masters.fields.code'),
      REQUIRED_TEXT('subject', 'masters.fields.subject', true),
      { key: 'body', label: 'masters.fields.body', type: 'textarea', required: true, span2: true, bamini: true },
    ],
  },
  sms_templates: {
    key: 'sms_templates',
    label: 'masters.smsTemplates.label',
    singularLabel: 'masters.smsTemplates.singularLabel',
    icon: 'sms',
    columns: [
      { key: 'name', label: 'common.name', sortable: true },
      { key: 'code', label: 'masters.fields.code' },
    ],
    formFields: [
      REQUIRED_TEXT('name', 'common.name'),
      REQUIRED_TEXT('code', 'masters.fields.code'),
      // SMS bodies routinely go out to parishioners in Tamil.
      { key: 'body', label: 'masters.fields.body', type: 'textarea', required: true, span2: true, bamini: true },
    ],
  },
  system_settings: {
    key: 'system_settings',
    label: 'masters.systemSettings.label',
    singularLabel: 'masters.systemSettings.singularLabel',
    icon: 'settings',
    columns: [
      { key: 'setting_key', label: 'masters.fields.key', sortable: true },
      { key: 'setting_value', label: 'common.value' },
      { key: 'description', label: 'masters.fields.description' },
    ],
    formFields: [
      REQUIRED_TEXT('setting_key', 'masters.fields.settingKey'),
      // Most rows here are technical config (APP_NAME, UPI_VPA, ...), but
      // e.g. RECEIPT_THANK_YOU_MESSAGE is a printed message that
      // legitimately wants Tamil -- see receiptPdf.js.
      TEXT('setting_value', 'common.value', true),
      { key: 'description', label: 'masters.fields.description', type: 'textarea', span2: true },
    ],
  },
};

// label/item.label below are translation keys (see masters.hub.* / masters.group.* in en.ts/ta.ts).
export const MASTER_GROUPS: MasterGroup[] = [
  {
    label: 'masters.group.churchSetup',
    icon: 'church',
    items: [
      { key: 'churches', label: 'masters.hub.churches' },
      { key: 'branches', label: 'masters.hub.branches' },
      { key: 'priests', label: 'masters.hub.priests' },
      { key: 'masses', label: 'masters.hub.masses' },
    ],
  },
  {
    label: 'masters.group.prayerAndCalendar',
    icon: 'volunteer_activism',
    items: [
      { key: 'prayer_intention_master', label: 'masters.hub.prayerIntentionMaster' },
      { key: 'special_feasts', label: 'masters.hub.specialFeasts' },
      { key: 'holidays', label: 'masters.hub.holidays' },
      { key: 'announcements', label: 'masters.hub.announcements' },
    ],
  },
  {
    label: 'masters.group.numbering',
    icon: 'tag',
    items: [
      { key: 'receipt_series', label: 'masters.hub.receiptSeries' },
      { key: 'certificate_series', label: 'masters.hub.certificateSeries' },
    ],
  },
  {
    label: 'masters.group.lookups',
    icon: 'list',
    items: [
      { key: 'genders', label: 'masters.hub.genders' },
      { key: 'departments', label: 'masters.hub.departments' },
      { key: 'languages', label: 'masters.hub.languages' },
      { key: 'currencies', label: 'masters.hub.currencies' },
      { key: 'payment_methods', label: 'masters.hub.paymentMethods' },
      { key: 'contribution_types', label: 'masters.hub.contributionTypes' },
      { key: 'document_types', label: 'masters.hub.documentTypes' },
    ],
  },
  {
    label: 'masters.group.geography',
    icon: 'public',
    items: [
      { key: 'countries', label: 'masters.hub.countries' },
      { key: 'states', label: 'masters.hub.states' },
      { key: 'districts', label: 'masters.hub.districts' },
    ],
  },
  {
    label: 'masters.group.templatesAndSettings',
    icon: 'tune',
    items: [
      { key: 'print_templates', label: 'masters.hub.printTemplates' },
      { key: 'email_templates', label: 'masters.hub.emailTemplates' },
      { key: 'sms_templates', label: 'masters.hub.smsTemplates' },
      { key: 'system_settings', label: 'masters.hub.systemSettings' },
    ],
  },
];
