const { renderPdfBuffer } = require('../utils/pdfPrinter');

function formatDate(d) {
  if (!d) return '____________';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildProse(type, record) {
  switch (type) {
    case 'baptism':
      return [
        { text: 'This is to certify that', alignment: 'center' },
        { text: record.child_name, style: 'subjectName', alignment: 'center', margin: [0, 6, 0, 6] },
        {
          text: [
            'child of ', { text: record.father_name || 'N/A', bold: true }, ' and ',
            { text: record.mother_name || 'N/A', bold: true },
            ', born on ', { text: formatDate(record.date_of_birth), bold: true },
            ', was baptized according to the rites of the Church on ',
            { text: formatDate(record.date_of_baptism), bold: true },
            ...(record.priest_name ? [' by ', { text: record.priest_name, bold: true }] : []),
            '.',
          ],
          alignment: 'center',
          margin: [40, 0, 40, 12],
        },
        {
          text: [
            'Godparents: ',
            { text: [record.godfather_name, record.godmother_name].filter(Boolean).join(' & ') || 'N/A', bold: true },
          ],
          alignment: 'center',
        },
      ];
    case 'marriage':
      return [
        { text: 'This is to certify that', alignment: 'center' },
        {
          text: `${record.groom_name}  &  ${record.bride_name}`,
          style: 'subjectName',
          alignment: 'center',
          margin: [0, 6, 0, 6],
        },
        {
          text: [
            'were joined in Holy Matrimony on ', { text: formatDate(record.marriage_date), bold: true },
            ...(record.priest_name ? [' by ', { text: record.priest_name, bold: true }] : []),
            '.',
          ],
          alignment: 'center',
          margin: [40, 0, 40, 12],
        },
        {
          text: [
            'Witnesses: ',
            { text: [record.witness1_name, record.witness2_name].filter(Boolean).join(' & ') || 'N/A', bold: true },
          ],
          alignment: 'center',
        },
      ];
    case 'death':
      return [
        { text: 'This is to certify that', alignment: 'center' },
        { text: record.deceased_name, style: 'subjectName', alignment: 'center', margin: [0, 6, 0, 6] },
        {
          text: [
            'departed this life on ', { text: formatDate(record.date_of_death), bold: true },
            ...(record.burial_date ? [' and was laid to rest on ', { text: formatDate(record.burial_date), bold: true }] : []),
            ...(record.cemetery ? [' at ', { text: record.cemetery, bold: true }] : []),
            ...(record.priest_name ? [', with the rites of the Church administered by ', { text: record.priest_name, bold: true }] : []),
            '.',
          ],
          alignment: 'center',
          margin: [40, 0, 40, 12],
        },
      ];
    default:
      return [];
  }
}

async function generateCertificatePdf(type, record, church, title) {
  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Roboto' },
    content: [
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                border: [true, true, true, true],
                margin: [24, 24, 24, 24],
                stack: [
                  { text: church?.name || 'Church Office', style: 'churchName', alignment: 'center' },
                  church?.address_line1
                    ? { text: [church.address_line1, church.city].filter(Boolean).join(', '), alignment: 'center', fontSize: 10, margin: [0, 0, 0, 10] }
                    : { text: '', margin: [0, 0, 0, 10] },
                  { canvas: [{ type: 'line', x1: 200, y1: 0, x2: 561, y2: 0, lineWidth: 1.5, lineColor: '#B08D2B' }], margin: [0, 0, 0, 16] },
                  { text: title.toUpperCase(), style: 'title', alignment: 'center', margin: [0, 0, 0, 24] },
                  ...buildProse(type, record),
                  { text: '', margin: [0, 20, 0, 0] },
                  {
                    columns: [
                      {
                        width: '*',
                        stack: [
                          { text: `Certificate No.: ${record.certificate_no}`, fontSize: 10 },
                          { text: `Date Issued: ${formatDate(new Date())}`, fontSize: 10 },
                        ],
                      },
                      {
                        width: '*',
                        stack: [
                          { canvas: [{ type: 'line', x1: 40, y1: 30, x2: 220, y2: 30, lineWidth: 0.75, lineColor: '#888888' }] },
                          { text: 'Signature of Priest / Parish Priest', fontSize: 9, color: '#666666', margin: [40, 4, 0, 0] },
                        ],
                        alignment: 'right',
                      },
                    ],
                    margin: [0, 30, 0, 0],
                  },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 2,
          vLineWidth: () => 2,
          hLineColor: () => '#0B3D91',
          vLineColor: () => '#0B3D91',
        },
      },
    ],
    styles: {
      churchName: { fontSize: 20, bold: true, color: '#0B3D91' },
      title: { fontSize: 16, bold: true, color: '#B08D2B', characterSpacing: 1 },
      subjectName: { fontSize: 20, bold: true, color: '#0B3D91' },
    },
  };

  return renderPdfBuffer(docDefinition);
}

module.exports = { generateCertificatePdf };
