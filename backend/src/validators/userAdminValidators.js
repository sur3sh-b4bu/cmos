const { z } = require('zod');
const { PHONE_PATTERN, PHONE_MESSAGE } = require('./businessRules');

const createSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required').max(150),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().regex(PHONE_PATTERN, PHONE_MESSAGE).optional().or(z.literal('')),
  role_id: z.coerce.number().int().positive('Role is required'),
  // Not required from the client -- the server always forces this to the
  // requester's own effective church (their home church, or whichever
  // church a Master Administrator has selected), ignoring whatever's sent
  // here. See userAdminService.resolveTargetChurch().
  church_id: z.coerce.number().int().positive().optional().nullable(),
  branch_id: z.coerce.number().int().positive().optional().nullable(),
  employee_code: z.string().trim().max(30).optional().or(z.literal('')),
});

const updateSchema = createSchema.omit({ username: true }).partial();

module.exports = { createSchema, updateSchema };
