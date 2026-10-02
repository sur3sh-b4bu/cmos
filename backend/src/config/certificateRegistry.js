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
      'child_name', 'gender_id', 'date_of_birth', 'date_of_baptism', 'place_of_baptism',
      'father_name', 'mother_name', 'parent_residence', 'godfather_name', 'godmother_name',
      // custom_priest_name is the free-text fallback for a priest who isn't
      // in this church's own Priests list (e.g. a visiting priest) -- see
      // certificateRepository.js's getById/list, which resolves priest_name
      // to this whenever priest_id isn't linked.
      'priest_id', 'custom_priest_name', 'remarks',
    ],
    required: ['child_name', 'gender_id', 'date_of_birth', 'date_of_baptism'],
    // Every free-text field on the record, plus the joined gender/priest
    // names the list actually displays -- not just the handful shown in the
    // compact list view (see buildSearchClause, which resolves 'gender_name'
    // /'priest_name' against their join below rather than a raw t.column).
    searchable: [
      'child_name', 'certificate_no', 'father_name', 'mother_name',
      'place_of_baptism', 'parent_residence', 'godfather_name', 'godmother_name', 'remarks',
      'gender_name', 'priest_name', 'custom_priest_name',
    ],
    joins: [
      { column: 'gender_id', table: 'genders', labelColumn: 'name', alias: 'gender_name' },
      { column: 'priest_id', table: 'priests', labelColumn: 'name', alias: 'priest_name' },
    ],
    // Structured filters the list's filter bar combines with AND (see
    // buildStructuredFilters + certificate-config.ts's matching
    // `filterFields`, which drives the actual UI controls) -- lets someone
    // narrow to e.g. one Priest AND a date-of-baptism range at once, instead
    // of only ever matching one free-text term.
    filters: [
      { key: 'gender_id', type: 'select' },
      { key: 'priest_id', type: 'select' },
      { key: 'date_of_birth', type: 'dateRange' },
      { key: 'date_of_baptism', type: 'dateRange' },
    ],
  },
  marriage: {
    table: 'marriage_certificates',
    certificateType: 'Marriage',
    title: 'Certificate of Marriage',
    permissionPrefix: 'marriage_certificates',
    // Order matches the "EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN
    // MARRIAGES" register format -- see certificatePdf.js.
    columns: [
      'marriage_date', 'where_married',
      'groom_name', 'bride_name',
      'groom_age', 'bride_age',
      'groom_condition', 'bride_condition',
      'groom_profession', 'bride_profession',
      'groom_residence', 'bride_residence',
      'groom_father_name', 'bride_father_name',
      'banns_or_licence', 'impediments_dispensed',
      'witness1_name', 'witness2_name', 'witness3_name', 'witness4_name',
      'priest_id', 'custom_priest_name', 'remarks',
    ],
    required: ['bride_name', 'groom_name', 'marriage_date'],
    searchable: [
      'bride_name', 'groom_name', 'certificate_no', 'where_married', 'groom_age', 'bride_age',
      'groom_condition', 'bride_condition', 'groom_profession', 'bride_profession',
      'groom_residence', 'bride_residence', 'groom_father_name', 'bride_father_name',
      'banns_or_licence', 'impediments_dispensed',
      'witness1_name', 'witness2_name', 'witness3_name', 'witness4_name', 'remarks',
      'priest_name', 'custom_priest_name',
    ],
    joins: [{ column: 'priest_id', table: 'priests', labelColumn: 'name', alias: 'priest_name' }],
    filters: [
      { key: 'priest_id', type: 'select' },
      { key: 'marriage_date', type: 'dateRange' },
    ],
  },
  death: {
    table: 'death_certificates',
    certificateType: 'Death',
    title: 'Certificate of Death',
    permissionPrefix: 'death_certificates',
    // Order matches the "EXTRACT FROM THE REGISTER OF DEATHS KEPT" register
    // format -- see certificatePdf.js.
    columns: [
      'deceased_name', 'age', 'place', 'profession', 'parents',
      'date_of_death', 'place_of_death', 'cause',
      'confession_received', 'viaticum_received', 'anointing_received',
      'burial_date', 'cemetery', 'priest_id', 'custom_priest_name', 'family_contact', 'remarks',
    ],
    required: ['deceased_name', 'date_of_death'],
    searchable: [
      'deceased_name', 'certificate_no', 'age', 'place', 'profession', 'parents',
      'place_of_death', 'cause', 'confession_received', 'viaticum_received', 'anointing_received',
      'cemetery', 'family_contact', 'remarks', 'priest_name', 'custom_priest_name',
    ],
    joins: [{ column: 'priest_id', table: 'priests', labelColumn: 'name', alias: 'priest_name' }],
    filters: [
      { key: 'priest_id', type: 'select' },
      { key: 'date_of_death', type: 'dateRange' },
      { key: 'burial_date', type: 'dateRange' },
    ],
  },
  confirmation: {
    table: 'confirmation_certificates',
    certificateType: 'Confirmation',
    title: 'Certificate of Confirmation',
    permissionPrefix: 'confirmation_certificates',
    // Order matches the "Extract from Confirmation Register" register
    // format -- see certificatePdf.js.
    columns: [
      'name', 'age', 'gender_id', 'parents', 'caste', 'sponsors', 'domicile',
      'place_of_confirmation', 'date_of_confirmation', 'bishop_name',
      'priest_id', 'custom_priest_name', 'remarks',
    ],
    required: ['name', 'date_of_confirmation'],
    searchable: [
      'name', 'certificate_no', 'age', 'gender_name', 'parents', 'caste', 'sponsors', 'domicile',
      'place_of_confirmation', 'bishop_name', 'priest_name', 'custom_priest_name', 'remarks',
    ],
    joins: [
      { column: 'gender_id', table: 'genders', labelColumn: 'name', alias: 'gender_name' },
      { column: 'priest_id', table: 'priests', labelColumn: 'name', alias: 'priest_name' },
    ],
    filters: [
      { key: 'gender_id', type: 'select' },
      { key: 'priest_id', type: 'select' },
      { key: 'date_of_confirmation', type: 'dateRange' },
    ],
  },
};

module.exports = registry;
