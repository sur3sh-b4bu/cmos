'use strict';

const { LABELS } = require('../labels');
const { CERTIFICATE_DATE_RULES, checkDateRules } = require('../../validators/businessRules');
const { SERIAL_ALIASES } = require('../serialAliases');

const label = (key) => LABELS[key];
/** Both language versions of a label, for accepting older/list headings. */
const both = (key) => [LABELS[key].en, LABELS[key].ta];

const CERTIFICATE_NO = {
  key: 'certificate_no',
  type: 'serial',
  label: label('certificates.common.certificateNo'),
  aliases: ['Certificate Number', ...SERIAL_ALIASES],
  unique: true,
};

// Free-text fallback for a priest who is not in this church's Priests list.
const customPriest = { key: 'custom_priest_name', type: 'text', max: 150, label: label('certificates.common.priestCustom') };
const remarks = { key: 'remarks', type: 'text', max: 500, label: label('certificates.common.remarks') };

const text = (key, max, labelKey, extra = {}) => ({ key, type: 'text', max, label: label(labelKey), ...extra });
const date = (key, labelKey, extra = {}) => ({ key, type: 'date', label: label(labelKey), ...extra });

/**
 * Column order, headings and types for each certificate type. The order is
 * the order on the create form (frontend certificate-config.ts), and the
 * headings are the form's own labels, so an exported sheet reads like the
 * form. `key` is the database column; `exportKey` is the row property an
 * export reads when that differs (lookup columns export the NAME, not the id).
 */
const FIELDS = {
  baptism: [
    text('child_name', 150, 'certificates.baptism.fieldChildName', { required: true, aliases: both('certificates.baptism.colChildName') }),
    { key: 'gender_id', exportKey: 'gender_name', type: 'gender', required: true, label: label('certificates.baptism.fieldSex'), aliases: both('certificates.common.gender') },
    date('date_of_birth', 'certificates.baptism.colDateOfBirth', { required: true }),
    date('date_of_baptism', 'certificates.baptism.colDateOfBaptism', { required: true }),
    text('place_of_baptism', 200, 'certificates.baptism.fieldPlaceOfBaptism'),
    text('father_name', 150, 'certificates.baptism.fieldFatherName'),
    text('mother_name', 150, 'certificates.baptism.fieldMotherName'),
    text('parent_residence', 300, 'certificates.baptism.fieldParentResidence'),
    text('godfather_name', 150, 'certificates.baptism.fieldGodfather'),
    text('godmother_name', 150, 'certificates.baptism.fieldGodmother'),
    { key: 'priest_id', exportKey: 'priest_name', type: 'priest', label: label('certificates.baptism.fieldPriestWhoBaptised'), aliases: both('certificates.common.priest') },
    customPriest,
    remarks,
  ],
  marriage: [
    date('marriage_date', 'certificates.marriage.fieldWhenMarried', { required: true, aliases: both('certificates.marriage.colMarriageDate') }),
    text('where_married', 200, 'certificates.marriage.fieldWhereMarried'),
    text('groom_name', 150, 'certificates.marriage.fieldGroomName', { required: true, aliases: both('certificates.marriage.colGroom') }),
    text('bride_name', 150, 'certificates.marriage.fieldBrideName', { required: true, aliases: both('certificates.marriage.colBride') }),
    text('groom_age', 10, 'certificates.marriage.fieldGroomAge'),
    text('bride_age', 10, 'certificates.marriage.fieldBrideAge'),
    text('groom_condition', 50, 'certificates.marriage.fieldGroomCondition'),
    text('bride_condition', 50, 'certificates.marriage.fieldBrideCondition'),
    text('groom_profession', 100, 'certificates.marriage.fieldGroomProfession'),
    text('bride_profession', 100, 'certificates.marriage.fieldBrideProfession'),
    text('groom_residence', 200, 'certificates.marriage.fieldGroomResidence'),
    text('bride_residence', 200, 'certificates.marriage.fieldBrideResidence'),
    text('groom_father_name', 150, 'certificates.marriage.fieldGroomFatherName'),
    text('bride_father_name', 150, 'certificates.marriage.fieldBrideFatherName'),
    text('banns_or_licence', 200, 'certificates.marriage.fieldBanns'),
    text('impediments_dispensed', 200, 'certificates.marriage.fieldImpediments'),
    text('witness1_name', 150, 'certificates.marriage.fieldWitness1'),
    text('witness2_name', 150, 'certificates.marriage.fieldWitness2'),
    text('witness3_name', 150, 'certificates.marriage.fieldWitness3'),
    text('witness4_name', 150, 'certificates.marriage.fieldWitness4'),
    { key: 'priest_id', exportKey: 'priest_name', type: 'priest', label: label('certificates.common.priest') },
    customPriest,
    remarks,
  ],
  death: [
    text('deceased_name', 150, 'common.name', { required: true }),
    text('age', 10, 'certificates.death.fieldAge'),
    text('place', 200, 'certificates.death.fieldPlace'),
    text('profession', 100, 'certificates.death.fieldProfession'),
    text('parents', 300, 'certificates.death.fieldParents'),
    date('date_of_death', 'certificates.death.fieldDateOfDeath', { required: true }),
    text('place_of_death', 200, 'certificates.death.fieldPlaceOfDeath'),
    text('cause', 200, 'certificates.death.fieldCause'),
    text('confession_received', 100, 'certificates.death.fieldConfession'),
    text('viaticum_received', 100, 'certificates.death.fieldViaticum'),
    text('anointing_received', 100, 'certificates.death.fieldAnointing'),
    date('burial_date', 'certificates.death.fieldDateOfBurial'),
    text('cemetery', 150, 'certificates.death.fieldPlaceOfBurial', { aliases: both('certificates.death.colCemetery') }),
    { key: 'priest_id', exportKey: 'priest_name', type: 'priest', label: label('certificates.death.fieldMinister'), aliases: both('certificates.common.priest') },
    customPriest,
    text('family_contact', 20, 'certificates.death.fieldFamilyContact'),
    remarks,
  ],
};

/** The ordered column list for a certificate type, certificate number first. */
function getCertificateColumns(type) {
  const fields = FIELDS[type];
  if (!fields) throw new Error(`Unknown certificate type: ${type}`);
  return [CERTIFICATE_NO, ...fields];
}

function columnLabel(columns, key, lang) {
  const column = columns.find((c) => c.key === key);
  return column ? column.label[lang] || column.label.en : key;
}

/** Sync business-rule check on an already-parsed row (ISO dates). */
function validateCertificateRow(type, values, columns, lang, nowMs) {
  return checkDateRules(CERTIFICATE_DATE_RULES[type] || [], values, (field) => columnLabel(columns, field, lang), nowMs);
}

const SAMPLE_ROWS = {
  baptism: { child_name: 'Mary Joseph', gender_id: 'Female', date_of_birth: '2020-01-15', date_of_baptism: '2020-02-20', place_of_baptism: 'St. Thomas Church', father_name: 'Joseph', mother_name: 'Anna', remarks: 'Example row - overwrite or delete it' },
  marriage: { marriage_date: '2020-01-15', groom_name: 'John Peter', bride_name: 'Mary Joseph', groom_age: '28', bride_age: '25', remarks: 'Example row - overwrite or delete it' },
  death: { deceased_name: 'Peter Joseph', age: '78', date_of_death: '2020-01-15', burial_date: '2020-01-17', cemetery: 'St. Thomas Cemetery', remarks: 'Example row - overwrite or delete it' },
};

module.exports = { getCertificateColumns, validateCertificateRow, columnLabel, SAMPLE_ROWS, FIELDS };
