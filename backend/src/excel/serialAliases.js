'use strict';

/** Headings people commonly give the register-number column, so it is matched without being told which one it is. */
const SERIAL_ALIASES = [
  'S.No', 'S. No', 'S No', 'SNo', 'S.No.', 'Sl.No', 'Sl. No', 'Sl No', 'SlNo', 'Sr.No', 'Sr. No', 'Sr No', 'SrNo',
  'Serial No', 'Serial Number', 'Serial', 'No', 'No.', 'Number', 'Reg No', 'Reg. No.', 'Register No',
  'வ.எண்', 'வ. எண்', 'வ.எண்.', 'வரிசை எண்', 'எண்',
];

module.exports = { SERIAL_ALIASES };
