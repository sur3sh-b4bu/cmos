const fs = require('fs');
const { renderPdfBuffer } = require('../src/utils/pdfPrinter');

async function test() {
  const docDefinition = {
    pageSize: 'A5',
    pageOrientation: 'portrait',
    pageMargins: [18, 18, 18, 18],
    background: function (currentPage, pageSize) {
      return [
        {
          canvas: [
            {
              type: 'rect',
              x: 10,
              y: 10,
              w: pageSize.width - 20,
              h: pageSize.height - 20,
              lineWidth: 1.5,
              lineColor: '#800020',
              r: 4,
            },
          ],
        },
      ];
    },
    content: [
      { text: 'Hello World', alignment: 'center' }
    ]
  };

  const buffer = await renderPdfBuffer(docDefinition);
  console.log('PDF rendered successfully with border canvas! Buffer size:', buffer.length);
}

test().catch(console.error);
