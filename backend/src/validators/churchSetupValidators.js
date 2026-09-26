const { z } = require('zod');
const { PHONE_PATTERN, PHONE_MESSAGE } = require('./businessRules');

const series = z.object({
  prefix: z
    .string()
    .trim()
    .min(1, 'Prefix is required')
    .max(20, 'Prefix can be at most 20 characters')
    .regex(/^[A-Za-z0-9._/-]+$/, 'Prefix may contain only letters, digits and . _ / -'),
  startNumber: z.coerce.number().int().min(1, 'Start number must be at least 1').max(999999999),
  padding: z.coerce.number().int().min(1, 'Digits must be between 1 and 10').max(10, 'Digits must be between 1 and 10'),
});

const mass = z.object({
  name: z.string().trim().min(1, 'Mass name is required').max(100),
  nameTa: z.string().trim().max(150).optional().or(z.literal('')),
  massTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Time must be HH:MM (24-hour)'),
  dayType: z.enum(['Daily', 'Sunday', 'Special']),
  defaultOfferingAmount: z.coerce.number().min(0).max(99999999.99).optional(),
});

const admin = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(150),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().regex(PHONE_PATTERN, PHONE_MESSAGE).optional().or(z.literal('')),
});

/** Every part is optional: only what the church is still missing needs to be sent. */
const applySchema = z.object({
  receiptSeries: series.optional(),
  certificateSeries: z.object({ Baptism: series.optional(), Marriage: series.optional(), Death: series.optional() }).optional(),
  masses: z.array(mass).max(30).optional(),
  branch: z.object({ name: z.string().trim().min(1, 'Branch name is required').max(150) }).optional(),
  admin: admin.optional(),
  priest: z
    .object({ name: z.string().trim().min(1, 'Priest name is required').max(150), title: z.string().trim().max(50).optional().or(z.literal('')) })
    .optional(),
});

module.exports = { applySchema };
