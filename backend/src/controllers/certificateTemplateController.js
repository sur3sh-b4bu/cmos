const asyncHandler = require('../utils/asyncHandler');
const templateRepo = require('../repositories/certificateTemplateRepository');
const lookupRepository = require('../repositories/lookupRepository');
const { generateCertificatePdf } = require('../reports/certificatePdf');
const ApiError = require('../utils/ApiError');

const VALID_TYPES = new Set(['baptism', 'marriage', 'confirmation', 'death']);

const SAMPLE_RECORDS = {
  baptism: {
    certificate_no: 'BAP/SAMPLE/001',
    place_of_baptism: 'St. Mary Church, Melur',
    date_of_baptism: '2026-05-15',
    child_name: 'Antony Joseph',
    date_of_birth: '2026-01-20',
    gender_name: 'Male',
    father_name: 'Michael Raja',
    mother_name: 'Mary Stella',
    parent_residence: '12/4 Church Street, Melur',
    godfather_name: 'Thomas Raj',
    godmother_name: 'Arockia Mary',
    priest_display_name: 'Rev. Fr. John Paul',
    remarks: 'Baptised in presence of family',
  },
  marriage: {
    certificate_no: 'MAR/SAMPLE/001',
    marriage_date: '2026-06-12',
    where_married: 'St. Mary Church, Melur',
    groom_name: 'David Britto',
    bride_name: 'Grace Philomena',
    groom_age: '28',
    bride_age: '25',
    groom_condition: 'Bachelor',
    bride_condition: 'Spinster',
    groom_profession: 'Engineer',
    bride_profession: 'Teacher',
    groom_residence: 'Tuticorin',
    bride_residence: 'Tuticorin',
    groom_father_name: 'Peter Doss',
    bride_father_name: 'Francis Xavier',
    banns_or_licence: 'BY BANNS',
    impediments_dispensed: 'NIL',
    witness1_name: 'Stephen Raj',
    witness2_name: 'Maria Susai',
    witness3_name: '',
    witness4_name: '',
    priest_display_name: 'Rev. Fr. John Paul',
  },
  death: {
    certificate_no: 'DTH/SAMPLE/001',
    deceased_name: 'Ignatius Fernando',
    age: '74',
    place: 'Melur',
    profession: 'Retired Fisherman',
    parents: 'Savarimuthu & Elizabeth',
    date_of_death: '2026-04-10',
    place_of_death: 'Tuticorin Hospital',
    cause: 'Natural Causes / Old Age',
    confession_received: 'Yes',
    viaticum_received: 'Yes',
    anointing_received: 'Yes',
    burial_date: '2026-04-11',
    cemetery: 'Parish Cemetery, Melur',
    priest_display_name: 'Rev. Fr. John Paul',
  },
  confirmation: {
    certificate_no: 'CNF/SAMPLE/001',
    name: 'Maria Josephine',
    age: '14',
    gender_name: 'Female',
    parents: 'Antony Raj & Sebastina',
    caste: 'RC Paravar',
    sponsors: 'Agnes Mary',
    domicile: 'Melur Parish',
    place_of_confirmation: 'St. Mary Church, Melur',
    date_of_confirmation: '2026-05-24',
    bishop_name: 'Most Rev. Bishop Stephen Antony',
  },
};

function validateType(type) {
  if (!VALID_TYPES.has(type)) {
    throw ApiError.badRequest(`Invalid certificate type: ${type}. Must be one of: baptism, marriage, confirmation, death`);
  }
}

const getAll = asyncHandler(async (req, res) => {
  const templates = await templateRepo.getAllTemplates(req.user.churchId);
  res.json({ success: true, data: templates });
});

const getByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  validateType(type);
  const template = await templateRepo.getTemplate(req.user.churchId, type);
  res.json({ success: true, data: template });
});

const update = asyncHandler(async (req, res) => {
  const { type } = req.params;
  validateType(type);
  const updated = await templateRepo.upsertTemplate(req.user.churchId, type, req.body);
  res.json({
    success: true,
    data: updated,
    message: 'Certificate template updated successfully',
  });
});

const reset = asyncHandler(async (req, res) => {
  const { type } = req.params;
  validateType(type);
  const resetTemplate = await templateRepo.deleteTemplate(req.user.churchId, type);
  res.json({
    success: true,
    data: resetTemplate,
    message: 'Certificate template reset to default text',
  });
});

const preview = asyncHandler(async (req, res) => {
  const { type } = req.params;
  validateType(type);
  const church = await lookupRepository.getChurchById(req.user.churchId);
  const template = await templateRepo.getTemplate(req.user.churchId, type);
  const record = SAMPLE_RECORDS[type] || {};
  const buffer = await generateCertificatePdf(type, record, church, template);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${type}_template_preview.pdf"`);
  res.send(buffer);
});

module.exports = {
  getAll,
  getByType,
  update,
  reset,
  preview,
};
