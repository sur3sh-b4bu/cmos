const { z } = require('zod');
const { PHONE_PATTERN, PHONE_MESSAGE } = require('./businessRules');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format');

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  bookedBy: z.string().trim().max(150).optional().or(z.literal('')),
  phone: z.string().trim().regex(PHONE_PATTERN, PHONE_MESSAGE).optional().or(z.literal('')),
  prayerDate: dateString,
  massId: z.coerce.number().int().positive('Mass is required'),
  prayerIntentionMasterId: z.coerce.number().int().positive().optional().nullable(),
  customIntention: z.string().trim().max(2000).optional().or(z.literal('')),
  offeringAmount: z.coerce.number().positive('Offering amount must be greater than 0'),
  // Required (not just optional) since the payment method chosen here now
  // drives the Receive Payment flow directly -- see mass-intention-form.ts.
  paymentMethodId: z.coerce.number().int().positive('Payment method is required'),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
  allowDuplicate: z.coerce.boolean().optional(),
  // Set once per Bulk Mass Intention save (see bulk-mass-intention-form.ts)
  // and stamped identically on every row from that save -- powers "Show
  // Bulk Mass Intentions" (reprinting the combined receipt later). Absent
  // for a single-entry booking or an Excel import row.
  bulkBatchId: z.string().uuid().optional(),
});

const updateSchema = createSchema.partial().extend({
  massId: z.coerce.number().int().positive().optional(),
  offeringAmount: z.coerce.number().positive().optional(),
});

const registerDateQuery = z.object({
  date: dateString,
  // Second print button on the register: name + intention only, for handing
  // to the priest without exposing offering amounts/receipt numbers.
  namesOnly: z.coerce.boolean().optional(),
  // Third print button: mass reasons only
  reasonsOnly: z.coerce.boolean().optional(),
  mode: z.string().optional(),
  // Print language -- see massIntentionService.buildDailyRegisterPdf's
  // `req.query?.lang` read. Zod objects silently STRIP any key not listed
  // here (validate.js's middleware replaces req.query with the parsed
  // result), so omitting this wasn't a no-op -- it was quietly discarding
  // `?lang=ta` before the controller ever saw it, which is why the Daily
  // Register kept printing in English regardless of the site's language.
  lang: z.enum(['en', 'ta']).optional(),
});

const receivePaymentSchema = z.object({
  method: z.enum(['cash', 'upi', 'cheque', 'bank_transfer', 'other'], {
    errorMap: () => ({ message: 'Select a payment method' }),
  }),
  referenceNumber: z.string().trim().max(100).optional().or(z.literal('')),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
  paymentDate: dateString.optional(),
});

const demoQrSchema = z.object({
  amount: z.coerce.number().positive(),
  purpose: z.string().trim().max(200).optional(),
});

module.exports = { createSchema, updateSchema, registerDateQuery, receivePaymentSchema, demoQrSchema };
