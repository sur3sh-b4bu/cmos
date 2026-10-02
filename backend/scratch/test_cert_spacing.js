const fs = require('fs');
const path = require('path');
const { generateCertificatePdf } = require('../src/reports/certificatePdf');

const sampleChurch = {
  name: "St. Mary's Church",
  city: 'Chennai',
  diocese: 'Tuticorin',
  theme_color: 'maroon'
};

const sampleMarriage = {
  marriage_date: '2026-09-24',
  where_married: "St. Mary's Church, Chennai",
  groom_name: 'Johnson Durai',
  bride_name: 'Maria Theresa',
  groom_age: '30',
  bride_age: '27',
  groom_condition: 'Bachelor',
  bride_condition: 'Spinster',
  groom_profession: 'Government Officer',
  bride_profession: 'Bank Officer',
  groom_residence: 'Guindy, Chennai',
  bride_residence: 'Saidapet, Chennai',
  groom_father_name: 'Duraisamy',
  bride_father_name: 'Joseph Fernando',
  banns_or_licence: 'By Banns',
  impediments_dispensed: 'Nil',
  witness1_name: 'Lawrence David',
  witness2_name: 'Theresa Lawrence',
  witness3_name: 'Dominic Savio',
  priest_display_name: 'Rev. Fr. Pratheep Selvaraj',
  certificate_no: 'MAR-2026-0001'
};

const sampleBaptism = {
  place_of_baptism: "St. Mary's Church, Chennai",
  date_of_baptism: '2026-05-15',
  child_name: 'Antony Jude',
  date_of_birth: '2026-04-10',
  gender_name: 'Male',
  father_name: 'Michael Duraisamy',
  mother_name: 'Mary Stella',
  parent_residence: 'Royapuram, Chennai',
  godfather_name: 'Joseph Vijay',
  godmother_name: 'Anitha Mary',
  priest_display_name: 'Rev. Fr. Pratheep Selvaraj',
  remarks: 'Born in Chennai',
  certificate_no: 'BAP-2026-0001'
};

const sampleConfirmation = {
  name: 'Catherine Johnson',
  age: '14',
  gender_name: 'Female',
  parents: 'Johnson Durai & Maria Theresa',
  caste: 'Christian',
  sponsors: 'Agnes Lawrence',
  domicile: 'Chennai',
  place_of_confirmation: "St. Mary's Church, Chennai",
  date_of_confirmation: '2026-08-20',
  bishop_name: 'Most Rev. Stephen Antony',
  certificate_no: 'CON-2026-0001'
};

const sampleDeath = {
  deceased_name: 'Ignatius Fernando',
  age: '78',
  place: 'Tuticorin',
  profession: 'Retired Teacher',
  parents: 'Antony Fernando & Rosa Fernando',
  date_of_death: '2026-09-10',
  place_of_death: 'Tuticorin Hospital',
  cause: 'Cardiac Arrest',
  confession_received: 'Yes',
  viaticum_received: 'Yes',
  anointing_received: 'Yes',
  burial_date: '2026-09-12',
  cemetery: 'St. Anthony Cemetery, Tuticorin',
  priest_display_name: 'Rev. Fr. Pratheep Selvaraj',
  certificate_no: 'DTH-2026-0001'
};

async function testAll() {
  const types = [
    { type: 'marriage', data: sampleMarriage },
    { type: 'baptism', data: sampleBaptism },
    { type: 'confirmation', data: sampleConfirmation },
    { type: 'death', data: sampleDeath }
  ];

  for (const { type, data } of types) {
    const buf = await generateCertificatePdf(type, data, sampleChurch);
    const pdfStr = buf.toString('latin1');
    const pages = (pdfStr.match(/\/Type\s*\/Page\b/g) || []).length;
    console.log(`Certificate [${type}]: ${pages} page(s), Buffer: ${buf.length} bytes`);
    fs.writeFileSync(path.join(__dirname, `${type}_test.pdf`), buf);
  }
}

testAll().catch(console.error);
