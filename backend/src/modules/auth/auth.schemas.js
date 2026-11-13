const { z } = require('zod');

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(120));

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: z.string().min(10).max(72),
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(72),
  })
  .strict();

module.exports = { registerSchema, loginSchema, emailSchema };
