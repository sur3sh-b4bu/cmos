/**
 * Declarative registry for the three certificate types, mirroring
 * masterRegistry.js's pattern: one generic repository/controller/PDF
 * generator, driven by config, instead of three near-duplicate modules.
 */
const registry = {
  baptism: {
    table: 'baptism_certificates',
    certificateType: 'Baptism',
    title: 'Certificate of Baptism',
    permissionPrefix: 'baptism_certificates',
    columns: [
      'child_name', 'gender_id', 'date_of_birth', 'date_of_baptism',
      'father_name', 'mother_name', 'godfather_name', 'godmother_name',
      'priest_id', 'remarks',
    ],
    required: ['child_name', 'gender_id', 'date_of_birth', 'date_of_baptism'],
    searchable: ['child_name', 'certificate_no', 'father_name', 'mother_name'],
    joins: [
      { column: 'gender_id', table: 'genders', labelColumn: 'name', alias: 'gender_name' },
      { column: 'priest_id', table: 'priests', labelColumn: 'name', alias: 'priest_name' },
    ],
  },
  marriage: {
    table: 'marriage_certificates',
    certificateType: 'Marriage',
    title: 'Certificate of Marriage',
    permissionPrefix: 'marriage_certificates',
    columns: [
      'bride_name', 'groom_name', 'marriage_date',
      'witness1_name', 'witness2_name', 'priest_id', 'remarks',
    ],
    required: ['bride_name', 'groom_name', 'marriage_date'],
    searchable: ['bride_name', 'groom_name', 'certificate_no'],
    joins: [{ column: 'priest_id', table: 'priests', labelColumn: 'name', alias: 'priest_name' }],
  },
  death: {
    table: 'death_certificates',
    certificateType: 'Death',
    title: 'Certificate of Death',
    permissionPrefix: 'death_certificates',
    columns: [
      'deceased_name', 'date_of_death', 'burial_date',
      'cemetery', 'priest_id', 'family_contact', 'remarks',
    ],
    required: ['deceased_name', 'date_of_death'],
    searchable: ['deceased_name', 'certificate_no'],
    joins: [{ column: 'priest_id', table: 'priests', labelColumn: 'name', alias: 'priest_name' }],
  },
};

module.exports = registry;
