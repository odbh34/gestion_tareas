const { z } = require('zod');
const { emailSchema, passwordSchema } = require('../auth/auth.schemas');

const roleSchema = z.enum(['estudiante', 'docente', 'administrador']);

const listUsersQuerySchema = z
  .object({
    email: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const userIdSchema = z.object({ id: z.uuid() }).strict();

const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema,
    role: roleSchema.default('estudiante'),
  })
  .strict();

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: emailSchema.optional(),
  })
  .strict()
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

const updateRoleSchema = z
  .object({
    role: roleSchema,
  })
  .strict();

const updateStatusSchema = z
  .object({
    is_active: z.boolean(),
  })
  .strict();

module.exports = {
  listUsersQuerySchema,
  userIdSchema,
  createUserSchema,
  updateUserSchema,
  updateRoleSchema,
  updateStatusSchema,
};
