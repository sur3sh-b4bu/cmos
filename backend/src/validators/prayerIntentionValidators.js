const { z } = require('zod');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date in YYYY-MM-DD format');

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  prayerDate: dateString,
  massId: z.coerce.number().int().positive('Mass is required'),
  prayerIntentionMasterId: z.coerce.number().int().positive().optional().nullable(),
  customIntention: z.string().trim().max(2000).optional().or(z.literal('')),
  offeringAmount: z.coerce.number().positive('Offering amount must be greater than 0'),
  paymentMethodId: z.coerce.number().int().positive().optional().nullable(),
  remarks: z.string().trim().max(500).optional().or(z.literal('')),
  allowDuplicate: z.coerce.boolean().optional(),
});

const updateSchema = createSchema.partial().extend({
  massId: z.coerce.number().int().positive().optional(),
  offeringAmount: z.coerce.number().positive().optional(),
});

const registerDateQuery = z.object({
  date: dateString,
});

module.exports = { createSchema, updateSchema, registerDateQuery };
