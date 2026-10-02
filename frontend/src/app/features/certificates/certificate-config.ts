import { DataTableColumn } from '../../shared/components/data-table/data-table.model';
import { CertificateType } from './certificate.service';

export interface CertificateFormField {
  key: string;
  /** A translation key, resolved via the `translate` pipe in certificate-form.html. */
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea';
  required?: boolean;
  masterKey?: string; // for 'select' fields, which /api/masters/:masterKey to populate options from
  span2?: boolean; // occupy both grid columns (e.g. remarks)
}

/** One structured filter the list's coms-filter-bar renders as its own
 * independent, always-visible control -- 'select' options come from a
 * masters lookup (see certificate-list.ts's loadFilterOptions), 'dateRange'
 * just needs the key. Mirrors (but is independent of) the backend's own
 * `filters` array in certificateRegistry.js -- see buildStructuredFilters,
 * which is what actually applies these server-side, AND'd with each other
 * and with the free-text search box. */
export interface CertificateFilterField {
  key: string;
  /** A translation key, resolved via the `translate` pipe. */
  label: string;
  type: 'select' | 'dateRange';
  masterKey?: string; // 'select' only -- which /api/masters/:masterKey to populate options from
}

/** A cross-field date rule the form checks before saving -- the API enforces
 * the same rules (backend validators/businessRules.js), so these only spare
 * the user a round trip. Field keys, not labels: messages name the field the
 * user sees. */
export type CertificateDateRule =
  | { kind: 'notFuture'; field: string }
  | { kind: 'notBefore'; field: string; other: string };

export interface CertificateConfig {
  type: CertificateType;
  /** Translation keys (not display text) -- resolved via the `translate` pipe wherever used. */
  title: string;
  singularTitle: string;
  permissionPrefix: string;
  nameLabel: string; // translation key for what a "name" column header should read in the list
  listColumns: DataTableColumn[];
  formFields: CertificateFormField[];
  dateRules: CertificateDateRule[];
  filterFields: CertificateFilterField[];
  subjectAccessor: (row: any) => string; // headline identity shown in list/dialogs
}

// NOTE: these translation keys only drive the on-screen data-entry UI (list
// columns, form labels). The printed certificate PDF (backend's
// certificatePdf.js) intentionally stays in the fixed English/Latin register
// wording that matches the physical Tuticorin Diocese register-extract forms
// -- that wording was matched field-for-field against physical documents and
// is not part of this UI-language switch.
export const CERTIFICATE_CONFIGS: Record<CertificateType, CertificateConfig> = {
  baptism: {
    type: 'baptism',
    title: 'certificates.baptism.title',
    singularTitle: 'certificates.baptism.singularTitle',
    permissionPrefix: 'baptism_certificates',
    nameLabel: 'certificates.baptism.colChildName',
    subjectAccessor: (row) => row.child_name,
    listColumns: [
      { key: 'certificate_no', label: 'certificates.common.certificateNo', sortable: true },
      { key: 'child_name', label: 'certificates.baptism.colChildName' },
      { key: 'gender_name', label: 'certificates.common.gender' },
      { key: 'date_of_birth', label: 'certificates.baptism.colDateOfBirth' },
      { key: 'date_of_baptism', label: 'certificates.baptism.colDateOfBaptism' },
      { key: 'priest_display_name', label: 'certificates.common.priest' },
      { key: 'actions', label: '', align: 'right' },
    ],
    // Order matches "EXTRACT FROM THE REGISTER OF BAPTISM" -- see
    // backend's certificatePdf.js, which prints these in this same order.
    formFields: [
      { key: 'child_name', label: 'certificates.baptism.fieldChildName', type: 'text', required: true },
      { key: 'gender_id', label: 'certificates.baptism.fieldSex', type: 'select', masterKey: 'genders', required: true },
      { key: 'date_of_birth', label: 'certificates.baptism.colDateOfBirth', type: 'date', required: true },
      { key: 'date_of_baptism', label: 'certificates.baptism.colDateOfBaptism', type: 'date', required: true },
      { key: 'place_of_baptism', label: 'certificates.baptism.fieldPlaceOfBaptism', type: 'text' },
      { key: 'father_name', label: 'certificates.baptism.fieldFatherName', type: 'text' },
      { key: 'mother_name', label: 'certificates.baptism.fieldMotherName', type: 'text' },
      { key: 'parent_residence', label: 'certificates.baptism.fieldParentResidence', type: 'text', span2: true },
      { key: 'godfather_name', label: 'certificates.baptism.fieldGodfather', type: 'text' },
      { key: 'godmother_name', label: 'certificates.baptism.fieldGodmother', type: 'text' },
      { key: 'priest_id', label: 'certificates.baptism.fieldPriestWhoBaptised', type: 'select', masterKey: 'priests' },
      { key: 'custom_priest_name', label: 'certificates.common.priestCustom', type: 'text' },
      { key: 'remarks', label: 'certificates.common.remarks', type: 'textarea', span2: true },
    ],
    dateRules: [],
    filterFields: [
      { key: 'gender_id', label: 'certificates.common.gender', type: 'select', masterKey: 'genders' },
      { key: 'priest_id', label: 'certificates.common.priest', type: 'select', masterKey: 'priests' },
      { key: 'date_of_birth', label: 'certificates.baptism.colDateOfBirth', type: 'dateRange' },
      { key: 'date_of_baptism', label: 'certificates.baptism.colDateOfBaptism', type: 'dateRange' },
    ],
  },
  marriage: {
    type: 'marriage',
    title: 'certificates.marriage.title',
    singularTitle: 'certificates.marriage.singularTitle',
    permissionPrefix: 'marriage_certificates',
    nameLabel: 'certificates.marriage.nameLabel',
    subjectAccessor: (row) => `${row.groom_name} & ${row.bride_name}`,
    listColumns: [
      { key: 'certificate_no', label: 'certificates.common.certificateNo', sortable: true },
      { key: 'groom_name', label: 'certificates.marriage.colGroom' },
      { key: 'bride_name', label: 'certificates.marriage.colBride' },
      { key: 'marriage_date', label: 'certificates.marriage.colMarriageDate' },
      { key: 'priest_display_name', label: 'certificates.common.priest' },
      { key: 'actions', label: '', align: 'right' },
    ],
    // Order matches "EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN
    // MARRIAGES" -- see backend's certificatePdf.js, which prints these in
    // this same order, Bridegroom/Bride paired per row.
    formFields: [
      { key: 'marriage_date', label: 'certificates.marriage.fieldWhenMarried', type: 'date', required: true },
      { key: 'where_married', label: 'certificates.marriage.fieldWhereMarried', type: 'text' },
      { key: 'groom_name', label: 'certificates.marriage.fieldGroomName', type: 'text', required: true },
      { key: 'bride_name', label: 'certificates.marriage.fieldBrideName', type: 'text', required: true },
      { key: 'groom_age', label: 'certificates.marriage.fieldGroomAge', type: 'text' },
      { key: 'bride_age', label: 'certificates.marriage.fieldBrideAge', type: 'text' },
      { key: 'groom_condition', label: 'certificates.marriage.fieldGroomCondition', type: 'text' },
      { key: 'bride_condition', label: 'certificates.marriage.fieldBrideCondition', type: 'text' },
      { key: 'groom_profession', label: 'certificates.marriage.fieldGroomProfession', type: 'text' },
      { key: 'bride_profession', label: 'certificates.marriage.fieldBrideProfession', type: 'text' },
      { key: 'groom_residence', label: 'certificates.marriage.fieldGroomResidence', type: 'text' },
      { key: 'bride_residence', label: 'certificates.marriage.fieldBrideResidence', type: 'text' },
      { key: 'groom_father_name', label: 'certificates.marriage.fieldGroomFatherName', type: 'text' },
      { key: 'bride_father_name', label: 'certificates.marriage.fieldBrideFatherName', type: 'text' },
      { key: 'banns_or_licence', label: 'certificates.marriage.fieldBanns', type: 'text' },
      { key: 'impediments_dispensed', label: 'certificates.marriage.fieldImpediments', type: 'text' },
      { key: 'witness1_name', label: 'certificates.marriage.fieldWitness1', type: 'text' },
      { key: 'witness2_name', label: 'certificates.marriage.fieldWitness2', type: 'text' },
      { key: 'witness3_name', label: 'certificates.marriage.fieldWitness3', type: 'text' },
      { key: 'witness4_name', label: 'certificates.marriage.fieldWitness4', type: 'text' },
      { key: 'priest_id', label: 'certificates.marriage.fieldMinister', type: 'select', masterKey: 'priests' },
      { key: 'custom_priest_name', label: 'certificates.common.priestCustom', type: 'text' },
      { key: 'remarks', label: 'certificates.common.remarks', type: 'textarea', span2: true },
    ],
    dateRules: [],
    filterFields: [
      { key: 'priest_id', label: 'certificates.common.priest', type: 'select', masterKey: 'priests' },
      { key: 'marriage_date', label: 'certificates.marriage.colMarriageDate', type: 'dateRange' },
    ],
  },
  death: {
    type: 'death',
    title: 'certificates.death.title',
    singularTitle: 'certificates.death.singularTitle',
    permissionPrefix: 'death_certificates',
    nameLabel: 'common.name',
    subjectAccessor: (row) => row.deceased_name,
    listColumns: [
      { key: 'certificate_no', label: 'certificates.common.certificateNo', sortable: true },
      { key: 'deceased_name', label: 'common.name' },
      { key: 'date_of_death', label: 'certificates.death.fieldDateOfDeath' },
      { key: 'burial_date', label: 'certificates.death.fieldDateOfBurial' },
      { key: 'cemetery', label: 'certificates.death.colCemetery' },
      { key: 'priest_display_name', label: 'certificates.common.priest' },
      { key: 'actions', label: '', align: 'right' },
    ],
    // Order matches "EXTRACT FROM THE REGISTER OF DEATHS KEPT" -- see
    // backend's certificatePdf.js, which prints these in this same order.
    formFields: [
      { key: 'deceased_name', label: 'common.name', type: 'text', required: true },
      { key: 'age', label: 'certificates.death.fieldAge', type: 'text' },
      { key: 'place', label: 'certificates.death.fieldPlace', type: 'text' },
      { key: 'profession', label: 'certificates.death.fieldProfession', type: 'text' },
      { key: 'parents', label: 'certificates.death.fieldParents', type: 'text' },
      { key: 'date_of_death', label: 'certificates.death.fieldDateOfDeath', type: 'date', required: true },
      { key: 'place_of_death', label: 'certificates.death.fieldPlaceOfDeath', type: 'text' },
      { key: 'cause', label: 'certificates.death.fieldCause', type: 'text' },
      { key: 'confession_received', label: 'certificates.death.fieldConfession', type: 'text' },
      { key: 'viaticum_received', label: 'certificates.death.fieldViaticum', type: 'text' },
      { key: 'anointing_received', label: 'certificates.death.fieldAnointing', type: 'text' },
      { key: 'burial_date', label: 'certificates.death.fieldDateOfBurial', type: 'date' },
      { key: 'cemetery', label: 'certificates.death.fieldPlaceOfBurial', type: 'text' },
      { key: 'priest_id', label: 'certificates.death.fieldMinister', type: 'select', masterKey: 'priests' },
      { key: 'custom_priest_name', label: 'certificates.common.priestCustom', type: 'text' },
      { key: 'family_contact', label: 'certificates.death.fieldFamilyContact', type: 'text' },
      { key: 'remarks', label: 'certificates.common.remarks', type: 'textarea', span2: true },
    ],
    dateRules: [],
    filterFields: [
      { key: 'priest_id', label: 'certificates.common.priest', type: 'select', masterKey: 'priests' },
      { key: 'date_of_death', label: 'certificates.death.fieldDateOfDeath', type: 'dateRange' },
      { key: 'burial_date', label: 'certificates.death.fieldDateOfBurial', type: 'dateRange' },
    ],
  },
  confirmation: {
    type: 'confirmation',
    title: 'certificates.confirmation.title',
    singularTitle: 'certificates.confirmation.singularTitle',
    permissionPrefix: 'confirmation_certificates',
    nameLabel: 'certificates.confirmation.colName',
    subjectAccessor: (row) => row.name,
    listColumns: [
      { key: 'certificate_no', label: 'certificates.common.certificateNo', sortable: true },
      { key: 'name', label: 'certificates.confirmation.colName' },
      { key: 'gender_name', label: 'certificates.common.gender' },
      { key: 'date_of_confirmation', label: 'certificates.confirmation.colDateOfConfirmation' },
      { key: 'bishop_name', label: 'certificates.confirmation.fieldBishop' },
      { key: 'priest_display_name', label: 'certificates.common.priest' },
      { key: 'actions', label: '', align: 'right' },
    ],
    // Order matches "Extract from Confirmation Register" -- see backend's certificatePdf.js
    formFields: [
      { key: 'name', label: 'certificates.confirmation.colName', type: 'text', required: true },
      { key: 'age', label: 'certificates.confirmation.fieldAge', type: 'text' },
      { key: 'gender_id', label: 'certificates.confirmation.fieldSex', type: 'select', masterKey: 'genders' },
      { key: 'parents', label: 'certificates.confirmation.fieldParents', type: 'text' },
      { key: 'caste', label: 'certificates.confirmation.fieldCaste', type: 'text' },
      { key: 'sponsors', label: 'certificates.confirmation.fieldSponsors', type: 'text' },
      { key: 'domicile', label: 'certificates.confirmation.fieldDomicile', type: 'text' },
      { key: 'place_of_confirmation', label: 'certificates.confirmation.fieldPlaceOfConfirmation', type: 'text' },
      { key: 'date_of_confirmation', label: 'certificates.confirmation.colDateOfConfirmation', type: 'date', required: true },
      { key: 'bishop_name', label: 'certificates.confirmation.fieldBishop', type: 'text' },
      { key: 'priest_id', label: 'certificates.common.priest', type: 'select', masterKey: 'priests' },
      { key: 'custom_priest_name', label: 'certificates.common.priestCustom', type: 'text' },
      { key: 'remarks', label: 'certificates.common.remarks', type: 'textarea', span2: true },
    ],
    dateRules: [],
    filterFields: [
      { key: 'gender_id', label: 'certificates.common.gender', type: 'select', masterKey: 'genders' },
      { key: 'priest_id', label: 'certificates.common.priest', type: 'select', masterKey: 'priests' },
      { key: 'date_of_confirmation', label: 'certificates.confirmation.colDateOfConfirmation', type: 'dateRange' },
    ],
  },
};
