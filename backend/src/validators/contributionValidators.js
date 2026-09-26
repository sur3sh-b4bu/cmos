const { z } = require('zod');
const { PHONE_PATTERN, PHONE_MESSAGE } = require('./businessRules');

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  phone: z.string().trim().regex(PHONE_PATTERN, PHONE_MESSAGE).optional().or(z.literal('')),
  contributionTypeId: z.coerce.number().int().positive().optional().nullable(),
  customContributionType: z.string().trim().max(2000).optional().or(z.literal('')),
  contributionAmount: z.coerce.number().positive('Contribution amount must be greater than 0'),
  // Required for the same reason as Mass Intentions' paymentMethodId -- the
  // method chosen here drives the Receive Payment flow directly.
  paymentMethodId: z.coerce.number().int().positive('Payment method is required'),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
});

const updateSchema = createSchema.partial().extend({
  contributionAmount: z.coerce.number().positive().optional(),
});

const receivePaymentSchema = z.object({
  method: z.enum(['cash', 'upi', 'cheque', 'bank_transfer', 'other'], {
    errorMap: () => ({ message: 'Select a payment method' }),
  }),
  referenceNumber: z.string().trim().max(100).optional().or(z.literal('')),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format').optional(),
});

module.exports = { createSchema, updateSchema, receivePaymentSchema };
