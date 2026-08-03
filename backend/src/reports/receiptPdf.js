const QRCode = require('qrcode');
const { renderPdfBuffer } = require('../utils/pdfPrinter');

const PAGE_WIDTH_PT = 288; // ~4 inch thermal/A5-half receipt width, still prints fine on A4

async function generateReceiptPdf(intention, church, thankYouMessage) {
  const qrText = `${intention.receipt_no}|${intention.prayer_date}|${church?.name || ''}`;
  const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, width: 120 });

  const intentionText = intention.intention_is_custom
    ? intention.custom_intention
    : intention.intention_master_name || intention.custom_intention || '-';

  const docDefinition = {
    pageSize: { width: PAGE_WIDTH_PT, height: 'auto' },
    pageMargins: [16, 16, 16, 16],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    content: [
      { text: church?.name || 'Church Office', style: 'churchName', alignment: 'center' },
      church?.address_line1
        ? { text: [church.address_line1, church.city].filter(Boolean).join(', '), alignment: 'center', fontSize: 8, margin: [0, 0, 0, 2] }
        : null,
      church?.phone ? { text: `Ph: ${church.phone}`, alignment: 'center', fontSize: 8, margin: [0, 0, 0, 6] } : null,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH_PT - 32, y2: 0, lineWidth: 1, dash: { length: 3 } }] },
      { text: 'PRAYER OFFERING RECEIPT', style: 'title', alignment: 'center', margin: [0, 6, 0, 6] },
      {
        columns: [
          { text: 'Receipt No.', bold: true, width: '50%' },
          { text: intention.receipt_no, width: '50%', alignment: 'right' },
        ],
      },
      {
        columns: [
          { text: 'Date', bold: true, width: '50%' },
          { text: formatDate(intention.prayer_date), width: '50%', alignment: 'right' },
        ],
      },
      {
        columns: [
          { text: 'Mass', bold: true, width: '50%' },
          { text: `${intention.mass_name} (${formatTime(intention.mass_time)})`, width: '50%', alignment: 'right' },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: PAGE_WIDTH_PT - 32, y2: 4, lineWidth: 0.5 }], margin: [0, 4, 0, 4] },
      { text: 'Offered by', bold: true },
      { text: intention.name, margin: [0, 0, 0, 4] },
      { text: 'Prayer Intention', bold: true },
      { text: intentionText, margin: [0, 0, 0, 4] },
      {
        columns: [
          { text: 'Offering', bold: true, width: '50%' },
          { text: formatCurrency(intention.offering_amount), width: '50%', alignment: 'right', bold: true },
        ],
        margin: [0, 4, 0, 4],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH_PT - 32, y2: 0, lineWidth: 1, dash: { length: 3 } }] },
      { image: qrDataUrl, width: 70, alignment: 'center', margin: [0, 8, 0, 4] },
      { text: thankYouMessage || 'Thank you for your offering. God Bless You.', alignment: 'center', italics: true, fontSize: 8, margin: [0, 2, 0, 0] },
      { text: `Generated: ${new Date().toLocaleString()}`, alignment: 'center', fontSize: 7, color: '#666666', margin: [0, 6, 0, 0] },
    ].filter(Boolean),
    styles: {
      churchName: { fontSize: 13, bold: true, color: '#0B3D91' },
      title: { fontSize: 10, bold: true, color: '#B08D2B' },
    },
  };

  return renderPdfBuffer(docDefinition);
}

function formatDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${suffix}`;
}
function formatCurrency(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}

module.exports = { generateReceiptPdf };
