import { DataTableColumn } from '../../shared/components/data-table/data-table.model';
import { CertificateType } from './certificate.service';

export interface CertificateFormField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea';
  required?: boolean;
  masterKey?: string; // for 'select' fields, which /api/masters/:masterKey to populate options from
  span2?: boolean; // occupy both grid columns (e.g. remarks)
}

export interface CertificateConfig {
  type: CertificateType;
  title: string;
  singularTitle: string;
  permissionPrefix: string;
  nameLabel: string; // what a "name" column header should read in the list
  listColumns: DataTableColumn[];
  formFields: CertificateFormField[];
  subjectAccessor: (row: any) => string; // headline identity shown in list/dialogs
}

export const CERTIFICATE_CONFIGS: Record<CertificateType, CertificateConfig> = {
  baptism: {
    type: 'baptism',
    title: 'Baptism Certificates',
    singularTitle: 'Baptism Certificate',
    permissionPrefix: 'baptism_certificates',
    nameLabel: 'Child Name',
    subjectAccessor: (row) => row.child_name,
    listColumns: [
      { key: 'certificate_no', label: 'Certificate No.', sortable: true },
      { key: 'child_name', label: 'Child Name' },
      { key: 'gender_name', label: 'Gender' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'date_of_baptism', label: 'Date of Baptism' },
      { key: 'priest_name', label: 'Priest' },
      { key: 'actions', label: '', align: 'right' },
    ],
    formFields: [
      { key: 'child_name', label: 'Child Name', type: 'text', required: true },
      { key: 'gender_id', label: 'Gender', type: 'select', masterKey: 'genders', required: true },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { key: 'date_of_baptism', label: 'Date of Baptism', type: 'date', required: true },
      { key: 'father_name', label: 'Father Name', type: 'text' },
      { key: 'mother_name', label: 'Mother Name', type: 'text' },
      { key: 'godfather_name', label: 'Godfather', type: 'text' },
      { key: 'godmother_name', label: 'Godmother', type: 'text' },
      { key: 'priest_id', label: 'Priest', type: 'select', masterKey: 'priests' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', span2: true },
    ],
  },
  marriage: {
    type: 'marriage',
    title: 'Marriage Certificates',
    singularTitle: 'Marriage Certificate',
    permissionPrefix: 'marriage_certificates',
    nameLabel: 'Couple',
    subjectAccessor: (row) => `${row.groom_name} & ${row.bride_name}`,
    listColumns: [
      { key: 'certificate_no', label: 'Certificate No.', sortable: true },
      { key: 'groom_name', label: 'Groom' },
      { key: 'bride_name', label: 'Bride' },
      { key: 'marriage_date', label: 'Marriage Date' },
      { key: 'priest_name', label: 'Priest' },
      { key: 'actions', label: '', align: 'right' },
    ],
    formFields: [
      { key: 'groom_name', label: 'Groom Name', type: 'text', required: true },
      { key: 'bride_name', label: 'Bride Name', type: 'text', required: true },
      { key: 'marriage_date', label: 'Marriage Date', type: 'date', required: true },
      { key: 'witness1_name', label: 'Witness 1', type: 'text' },
      { key: 'witness2_name', label: 'Witness 2', type: 'text' },
      { key: 'priest_id', label: 'Priest', type: 'select', masterKey: 'priests' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', span2: true },
    ],
  },
  death: {
    type: 'death',
    title: 'Death Certificates',
    singularTitle: 'Death Certificate',
    permissionPrefix: 'death_certificates',
    nameLabel: 'Name',
    subjectAccessor: (row) => row.deceased_name,
    listColumns: [
      { key: 'certificate_no', label: 'Certificate No.', sortable: true },
      { key: 'deceased_name', label: 'Name' },
      { key: 'date_of_death', label: 'Date of Death' },
      { key: 'burial_date', label: 'Burial Date' },
      { key: 'cemetery', label: 'Cemetery' },
      { key: 'priest_name', label: 'Priest' },
      { key: 'actions', label: '', align: 'right' },
    ],
    formFields: [
      { key: 'deceased_name', label: 'Name', type: 'text', required: true },
      { key: 'date_of_death', label: 'Date of Death', type: 'date', required: true },
      { key: 'burial_date', label: 'Burial Date', type: 'date' },
      { key: 'cemetery', label: 'Cemetery', type: 'text' },
      { key: 'priest_id', label: 'Priest', type: 'select', masterKey: 'priests' },
      { key: 'family_contact', label: 'Family Contact', type: 'text' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', span2: true },
    ],
  },
};
