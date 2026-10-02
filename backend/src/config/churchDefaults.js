'use strict';

/**
 * What a brand-new church starts from. One source of truth for:
 *  - the suggestions the "Set up this church" popup pre-fills
 *    (services/churchSetupService.js), and
 *  - the numbering series a church that was never configured falls back to,
 *    so saving a record can't fail just because nobody set the church up yet
 *    (repositories/receiptSeriesRepository.js).
 * The values match what database/seed.js gives the first church.
 */

const CERTIFICATE_TYPES = ['Baptism', 'Marriage', 'Death', 'Confirmation'];

const RECEIPT_SERIES = { seriesName: 'Default Receipt Series', prefix: 'RCT', startNumber: 1, padding: 4 };

const CERTIFICATE_SERIES = {
  Baptism: { prefix: 'BAP', startNumber: 1, padding: 4 },
  Marriage: { prefix: 'MAR', startNumber: 1, padding: 4 },
  Death: { prefix: 'DTH', startNumber: 1, padding: 4 },
  Confirmation: { prefix: 'CNF', startNumber: 1, padding: 4 },
};

const MASSES = [
  { name: 'Weekday Morning Mass', nameTa: 'காலை திருப்பலி', massTime: '06:00', dayType: 'Daily', defaultOfferingAmount: 0 },
  { name: 'Weekday Evening Mass', nameTa: 'மாலை திருப்பலி', massTime: '18:00', dayType: 'Daily', defaultOfferingAmount: 0 },
  { name: 'Sunday Morning Mass', nameTa: 'ஞாயிறு காலை திருப்பலி', massTime: '08:00', dayType: 'Sunday', defaultOfferingAmount: 0 },
  { name: 'Sunday Evening Mass', nameTa: 'ஞாயிறு மாலை திருப்பலி', massTime: '17:30', dayType: 'Sunday', defaultOfferingAmount: 0 },
];

module.exports = { CERTIFICATE_TYPES, RECEIPT_SERIES, CERTIFICATE_SERIES, MASSES };
