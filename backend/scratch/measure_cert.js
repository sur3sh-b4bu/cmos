const fs = require('fs');
const { generateCertificatePdf } = require('../src/reports/certificatePdf');
const { sampleMarriage, sampleBaptism, sampleConfirmation, sampleDeath, sampleChurch } = require('./test_cert_spacing');

async function test() {
  const types = [
    { type: 'marriage', data: sampleMarriage },
    { type: 'baptism', data: sampleBaptism },
    { type: 'confirmation', data: sampleConfirmation },
    { type: 'death', data: sampleDeath }
  ];

  for (const { type, data } of types) {
    const buf = await generateCertificatePdf(type, data, sampleChurch);
    // Let's write to file
    fs.writeFileSync(`scratch/${type}_test.pdf`, buf);
    console.log(`Wrote scratch/${type}_test.pdf`);
  }
}

test().catch(console.error);
