const { pool } = require('../config/db');

const DEFAULT_TEMPLATES = {
  baptism: {
    certificate_type: 'baptism',
    title: 'EXTRACT FROM THE REGISTER OF BAPTISM',
    subheader_prefix: 'Kept at',
    diocese_label: 'Tuticorin Diocese',
    signatory_title: 'Catholic Priest',
    seal_label: 'Seal',
    field_labels: {
      place_of_baptism: 'Place of Baptism',
      date_of_baptism: 'Date of Baptism',
      child_name: "Child's Christian Name",
      date_of_birth: 'Date of Birth',
      gender: 'Sex',
      parents_name: "Parent's Name",
      parent_residence: "Parent's Residence",
      godparents: 'God Parents',
      priest: 'Priest who Baptised',
      remarks: 'Remarks',
      date_label: 'Date :',
    },
  },
  marriage: {
    certificate_type: 'marriage',
    title: 'EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN MARRIAGES',
    subheader_prefix: 'Solemnized at',
    diocese_label: 'Tuticorin Diocese',
    signatory_title: 'Parish Priest',
    seal_label: 'Seal',
    field_labels: {
      marriage_date: 'When Married',
      where_married: 'Where Married',
      parties_name: 'Name of the Parties',
      groom_sublabel: 'Bridegroom',
      bride_sublabel: 'Bride',
      age: 'Age',
      groom_age_sublabel: "Bridegroom's",
      bride_age_sublabel: "Bride's",
      condition: 'Condition',
      profession: 'Profession',
      residence: 'Residence at the\ntime of Marriage',
      father_name: "Father's Name\n& Surname",
      banns_or_licence: 'By banns or Licence',
      impediments_dispensed: 'Can. impediments dispensed',
      witnesses: 'Witnesses',
      witness_count: 'auto',
      witness1_prefix: '1.',
      witness2_prefix: '2.',
      witness3_prefix: '3.',
      witness4_prefix: '4.',
      minister: 'Minister of the Ceremony',
      date_label: 'Date :',
    },
  },
  death: {
    certificate_type: 'death',
    title: 'EXTRACT FROM THE REGISTER OF\nDEATHS KEPT',
    subheader_prefix: 'at',
    diocese_label: 'Tuticorin Diocese',
    signatory_title: 'CATHOLIC PRIEST',
    seal_label: 'Seal',
    field_labels: {
      deceased_name: 'Name',
      age: 'Age',
      place: 'Place',
      profession: 'Profession',
      parents: 'Parents',
      date_of_death: 'Date of death',
      place_of_death: 'Place of death',
      cause: 'Cause',
      confession: 'C.Confession',
      viaticum: 'V.Viaticum',
      anointing: 'A.Anointing',
      burial_date: 'Date of Burial',
      cemetery: 'Place of Burial',
      minister: 'Minister',
      place_label: 'Place :',
      date_label: 'Date  :',
    },
  },
  confirmation: {
    certificate_type: 'confirmation',
    title: 'Extract from Confirmation Register',
    subheader_prefix: 'Kept at',
    diocese_label: 'Tuticorin Diocese',
    signatory_title: 'Parish Priest',
    seal_label: 'SEAL',
    field_labels: {
      name: 'Name',
      age: 'Age',
      gender: 'Sex',
      parents: 'Parents',
      caste: 'Caste',
      sponsors: 'Sponsors',
      domicile: 'Domicile',
      place_of_confirmation: 'Place of Confirmation',
      date_of_confirmation: 'Date of Confirmation',
      bishop: 'Bishop who confirmed',
      date_label: 'Date :',
    },
  },
};

function getDefaultTemplate(type) {
  return DEFAULT_TEMPLATES[type] ? JSON.parse(JSON.stringify(DEFAULT_TEMPLATES[type])) : null;
}

function mergeWithDefault(type, custom) {
  const def = getDefaultTemplate(type);
  if (!def) return custom;
  if (!custom) return def;

  let customFieldLabels = custom.field_labels;
  if (typeof customFieldLabels === 'string') {
    try {
      customFieldLabels = JSON.parse(customFieldLabels);
    } catch {
      customFieldLabels = {};
    }
  }

  return {
    ...def,
    id: custom.id,
    church_id: custom.church_id,
    title: custom.title !== undefined && custom.title !== null && custom.title !== '' ? custom.title : def.title,
    subheader_prefix: custom.subheader_prefix !== undefined && custom.subheader_prefix !== null && custom.subheader_prefix !== '' ? custom.subheader_prefix : def.subheader_prefix,
    diocese_label: custom.diocese_label !== undefined && custom.diocese_label !== null && custom.diocese_label !== '' ? custom.diocese_label : def.diocese_label,
    signatory_title: custom.signatory_title !== undefined && custom.signatory_title !== null && custom.signatory_title !== '' ? custom.signatory_title : def.signatory_title,
    seal_label: custom.seal_label !== undefined && custom.seal_label !== null && custom.seal_label !== '' ? custom.seal_label : def.seal_label,
    field_labels: {
      ...def.field_labels,
      ...(customFieldLabels || {}),
    },
    is_customized: !!custom.id,
  };
}

async function getTemplate(churchId, certificateType) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM certificate_print_templates WHERE church_id = ? AND certificate_type = ? LIMIT 1',
      [churchId, certificateType]
    );
    return mergeWithDefault(certificateType, rows[0] || null);
  } catch (err) {
    // If table doesn't exist on client database or query fails, safely fallback to defaults
    return getDefaultTemplate(certificateType);
  }
}

async function getAllTemplates(churchId) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM certificate_print_templates WHERE church_id = ?',
      [churchId]
    );
    const byType = {};
    for (const row of rows) {
      byType[row.certificate_type] = row;
    }

    const result = {};
    for (const type of ['baptism', 'marriage', 'confirmation', 'death']) {
      result[type] = mergeWithDefault(type, byType[type] || null);
    }
    return result;
  } catch (err) {
    const result = {};
    for (const type of ['baptism', 'marriage', 'confirmation', 'death']) {
      result[type] = getDefaultTemplate(type);
    }
    return result;
  }
}

async function upsertTemplate(churchId, certificateType, data) {
  const fieldLabelsJson = typeof data.field_labels === 'object' ? JSON.stringify(data.field_labels) : (data.field_labels || null);

  const [result] = await pool.query(
    `INSERT INTO certificate_print_templates
      (church_id, certificate_type, title, subheader_prefix, diocese_label, signatory_title, seal_label, field_labels)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      subheader_prefix = VALUES(subheader_prefix),
      diocese_label = VALUES(diocese_label),
      signatory_title = VALUES(signatory_title),
      seal_label = VALUES(seal_label),
      field_labels = VALUES(field_labels),
      updated_at = NOW()`,
    [
      churchId,
      certificateType,
      data.title || null,
      data.subheader_prefix || null,
      data.diocese_label || null,
      data.signatory_title || null,
      data.seal_label || null,
      fieldLabelsJson,
    ]
  );
  return getTemplate(churchId, certificateType);
}

async function deleteTemplate(churchId, certificateType) {
  await pool.query(
    'DELETE FROM certificate_print_templates WHERE church_id = ? AND certificate_type = ?',
    [churchId, certificateType]
  );
  return getDefaultTemplate(certificateType);
}

module.exports = {
  DEFAULT_TEMPLATES,
  getDefaultTemplate,
  mergeWithDefault,
  getTemplate,
  getAllTemplates,
  upsertTemplate,
  deleteTemplate,
};
