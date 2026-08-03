const { z } = require('zod');

const createSchema = z.object({
  full_name: z.string().trim().min(1, 'Full name is required').max(150),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, dashes and underscores'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  role_id: z.coerce.number().int().positive('Role is required'),
  church_id: z.coerce.number().int().positive('Church is required'),
  branch_id: z.coerce.number().int().positive().optional().nullable(),
  employee_code: z.string().trim().max(30).optional().or(z.literal('')),
});

const updateSchema = createSchema.omit({ username: true }).partial();

module.exports = { createSchema, updateSchema };
