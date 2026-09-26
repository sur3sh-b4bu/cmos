'use strict';

const { LABELS } = require('../labels');
const { isValidPhone, PHONE_MESSAGE } = require('../../validators/businessRules');
const { SERIAL_ALIASES } = require('../serialAliases');

const label = (key) => LABELS[key];
const both = (key) => [LABELS[key].en, LABELS[key].ta];

/**
 * Mass Intention columns. Entered Date and Payment Status are read-only information in
 * an export (the system assigns them), so an import ignores them -- see `info`. The
 * receipt number is optional on import: the number in the sheet's register column is
 * kept and the church's prefix is added (see excel/serialNumber.js); a blank one is
 * numbered automatically. Everything else is what a person enters, and round-trips.
 */
const COLUMNS = [
  { key: 'receipt_no', type: 'serial', unique: true, label: label('massIntentions.colReceiptNo'), aliases: SERIAL_ALIASES },
  { key: 'created_at', type: 'date', info: true, label: label('common.enteredDate') },
  { key: 'name', type: 'text', max: 150, required: true, label: label('common.name') },
  { key: 'booked_by', type: 'text', max: 150, label: label('massIntentions.bookedBy') },
  { key: 'phone', type: 'text', max: 20, label: label('massIntentions.phoneNumber') },
  { key: 'prayer_date', type: 'date', required: true, label: label('massIntentions.colMassDate'), aliases: both('massIntentions.prayerDate') },
  { key: 'mass_id', exportKey: 'mass_name', type: 'mass', required: true, label: label('dashboard.colMass') },
  { key: 'prayer_intention_master_id', exportKey: 'intention_master_name', type: 'intention', label: label('massIntentions.colIntention') },
  { key: 'custom_intention', type: 'text', max: 2000, label: label('massIntentions.describeIntention') },
  { key: 'offering_amount', type: 'number', positive: true, required: true, label: label('massIntentions.offeringAmount'), aliases: both('massIntentions.colOffering') },
  { key: 'payment_method_id', exportKey: 'payment_method_name', type: 'paymentMethod', required: true, label: label('massIntentions.paymentMethod') },
  { key: 'remarks', type: 'text', max: 500, label: label('massIntentions.remarks') },
  { key: 'payment_status', type: 'text', info: true, label: label('massIntentions.paymentStatus') },
];

const SAMPLE = {
  name: 'John Fernandez',
  booked_by: 'John Fernandez',
  phone: '+91 98765 43210',
  prayer_date: '2030-01-15',
  offering_amount: 100,
  custom_intention: 'For the health of the family',
  remarks: 'Example row - overwrite or delete it',
};

/**
 * Row-level rules that need no database: the phone rule, and the same
 * "preset or describe it" rule the create form/service enforce.
 */
function validateMassIntentionRow(values, lookups) {
  const errors = [];
  if (!isValidPhone(values.phone)) errors.push({ field: 'phone', message: PHONE_MESSAGE });

  const master = values.prayer_intention_master_id ? lookups.intentionById.get(Number(values.prayer_intention_master_id)) : null;
  if (master && !master.is_custom) {
    values.custom_intention = null; // a preset intention carries no free text
  } else if (!values.custom_intention) {
    errors.push({
      field: master ? 'custom_intention' : 'prayer_intention_master_id',
      message: master ? 'Describe the intention (required when "Others" is selected).' : 'Choose a Mass Intention or describe one in "Describe the intention".',
    });
  }
  return errors;
}

module.exports = { MASS_INTENTION_COLUMNS: COLUMNS, MASS_INTENTION_SAMPLE: SAMPLE, validateMassIntentionRow };
