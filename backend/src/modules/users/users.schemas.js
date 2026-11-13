const { z } = require('zod');

const listUsersQuerySchema = z
  .object({
    email: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const userIdSchema = z.object({ id: z.uuid() }).strict();

const updateRoleSchema = z
  .object({
    role: z.enum(['estudiante', 'docente', 'administrador']),
  })
  .strict();

module.exports = { listUsersQuerySchema, userIdSchema, updateRoleSchema };
