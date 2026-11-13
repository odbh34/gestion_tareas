const { z } = require('zod');

const statusSchema = z.enum([
  'pendiente',
  'en_progreso',
  'completada',
  'cancelada',
]);

const createTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).default(''),
    status: statusSchema.default('pendiente'),
  })
  .strict();

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    status: statusSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

const listTasksQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: statusSchema.optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['created_at', 'updated_at', 'title', 'status']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

const taskIdSchema = z.object({ id: z.uuid() }).strict();

module.exports = {
  statusSchema,
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  taskIdSchema,
};
