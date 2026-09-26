'use strict';

const { LABELS } = require('../labels');
const { isValidPhone, PHONE_MESSAGE } = require('../../validators/businessRules');
const { SERIAL_ALIASES } = require('../serialAliases');

const label = (key) => LABELS[key];

/** Same idea as the Mass Intention columns: Entered Date and Payment Status are system-assigned, export-only; the receipt number is optional on import. */
const COLUMNS = [
  { key: 'receipt_no', type: 'serial', unique: true, label: label('massIntentions.colReceiptNo'), aliases: SERIAL_ALIASES },
  { key: 'created_at', type: 'date', info: true, label: label('common.enteredDate') },
  { key: 'name', type: 'text', max: 150, required: true, label: label('common.name') },
  { key: 'phone', type: 'text', max: 20, label: label('massIntentions.phoneNumber') },
  { key: 'contribution_type_id', exportKey: 'contribution_type_name', type: 'contributionType', label: label('contributions.contributionType') },
  { key: 'custom_contribution_type', type: 'text', max: 2000, label: label('contributions.describeType') },
  { key: 'contribution_amount', type: 'number', positive: true, required: true, label: label('contributions.amount') },
  { key: 'payment_method_id', exportKey: 'payment_method_name', type: 'paymentMethod', required: true, label: label('massIntentions.paymentMethod') },
  { key: 'remarks', type: 'text', max: 500, label: label('massIntentions.remarks') },
  { key: 'payment_status', type: 'text', info: true, label: label('massIntentions.paymentStatus') },
];

const SAMPLE = {
  name: 'Mary Joseph',
  phone: '+91 98765 43210',
  custom_contribution_type: 'Building fund',
  contribution_amount: 500,
  remarks: 'Example row - overwrite or delete it',
};

/** Phone rule, and the same "pick a type or describe one" rule as the create form/service. */
function validateContributionRow(values, lookups) {
  const errors = [];
  if (!isValidPhone(values.phone)) errors.push({ field: 'phone', message: PHONE_MESSAGE });

  const type = values.contribution_type_id ? lookups.typeById.get(Number(values.contribution_type_id)) : null;
  if (type && type.code !== 'OTHERS') {
    values.custom_contribution_type = null; // a standard type carries no free text
  } else if (!values.custom_contribution_type) {
    errors.push({
      field: type ? 'custom_contribution_type' : 'contribution_type_id',
      message: type ? 'Describe the contribution purpose (required when "Others" is selected).' : 'Choose a Contribution Type or describe one in "Describe the contribution purpose".',
    });
  }
  return errors;
}

module.exports = { CONTRIBUTION_COLUMNS: COLUMNS, CONTRIBUTION_SAMPLE: SAMPLE, validateContributionRow };
