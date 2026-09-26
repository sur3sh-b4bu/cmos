const massIntentionRepository = require('../repositories/massIntentionRepository');
const lookupRepository = require('../repositories/lookupRepository');
const { buildCalendar } = require('../utils/icsBuilder');
const ApiError = require('../utils/ApiError');

const MASS_DURATION_MINUTES = 60;

/**
 * Backs the public page reached by scanning a receipt's QR code. Everything
 * here is served WITHOUT authentication, so each function returns only the
 * fields a parishioner already holds on their own printed receipt -- never
 * the offering amount, phone number, internal ids, or who recorded it.
 */

function intentionText(intention) {
  return intention.intention_is_custom
    ? intention.custom_intention
    : intention.intention_master_name || intention.custom_intention || 'Mass Intention';
}

/** Combines the DATE column and the Mass's TIME column into one local Date. */
function massStartDate(intention) {
  const dateOnly = new Date(intention.prayer_date);
  const [h = '0', m = '0'] = String(intention.mass_time || '00:00:00').split(':');
  return new Date(
    dateOnly.getFullYear(),
    dateOnly.getMonth(),
    dateOnly.getDate(),
    Number(h),
    Number(m),
    0
  );
}

async function loadOrThrow(token) {
  const intention = await massIntentionRepository.getByPublicToken(token);
  if (!intention) throw ApiError.notFound('This receipt link is not valid or has been removed.');
  return intention;
}

async function getPublicSummary(token) {
  const intention = await loadOrThrow(token);
  const church = await lookupRepository.getChurchById(intention.church_id);
  const start = massStartDate(intention);

  return {
    receiptNo: intention.receipt_no,
    name: intention.name,
    prayerDate: intention.prayer_date,
    massName: intention.mass_name,
    massTime: intention.mass_time,
    intention: intentionText(intention),
    startsAt: start.toISOString(),
    isPast: start.getTime() < Date.now(),
    church: {
      name: church?.name || 'Church Office',
      address: [church?.address_line1, church?.address_line2, church?.city]
        .filter(Boolean)
        .join(', '),
    },
  };
}

async function buildCalendarFile(token, reminderMinutesBefore) {
  const intention = await loadOrThrow(token);
  const church = await lookupRepository.getChurchById(intention.church_id);
  const start = massStartDate(intention);
  const text = intentionText(intention);
  const churchName = church?.name || 'Church';

  const description = [
    `Mass intention: ${text}`,
    `Offered by: ${intention.name}`,
    `Mass: ${intention.mass_name}`,
    `Church: ${churchName}`,
    `Receipt No.: ${intention.receipt_no}`,
  ].join('\n');

  const ics = buildCalendar({
    uid: `prayer-intention-${intention.public_token}@coms`,
    start,
    durationMinutes: MASS_DURATION_MINUTES,
    summary: `${text} — ${intention.mass_name}`,
    description,
    location: [churchName, church?.address_line1, church?.city].filter(Boolean).join(', '),
    reminderMinutesBefore,
  });

  return { ics, filename: `prayer-intention-${intention.receipt_no}.ics` };
}

module.exports = { getPublicSummary, buildCalendarFile };
