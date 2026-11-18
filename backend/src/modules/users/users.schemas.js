const { z } = require('zod');
const { passwordSchema } = require('../auth/auth.schemas');

const roleSchema = z.enum(['estudiante', 'docente', 'administrador']);

// Mismas reglas que el formulario del panel admin (userFormValidation.js).
const NAME_PATTERN = /^[\p{L}][\p{L}\p{M} '\u2019-]*$/u;
const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const ALLOWED_TLDS = new Set([
  'ai', 'app', 'ar', 'at', 'au', 'be', 'biz', 'blog', 'br', 'ca', 'ch',
  'cl', 'cloud', 'cn', 'co', 'com', 'dev', 'de', 'dk', 'edu', 'es', 'eu',
  'fi', 'fr', 'gov', 'info', 'int', 'io', 'it', 'jp', 'kr', 'me', 'mil',
  'mx', 'net', 'nl', 'no', 'online', 'org', 'pe', 'pl', 'pt', 'se', 'site',
  'store', 'tech', 'tv', 'uk', 'us', 'xyz', 'za',
]);

const NAME_ERROR =
  'Usa solo letras, espacios, apóstrofos o guiones (entre 2 y 80 caracteres).';
const EMAIL_ERROR =
  'Introduce un correo válido con un dominio real (por ejemplo, nombre@empresa.com).';

const adminNameSchema = z
  .string()
  .trim()
  .min(2, NAME_ERROR)
  .max(80, NAME_ERROR)
  .regex(NAME_PATTERN, NAME_ERROR);

const adminEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, EMAIL_ERROR)
  .refine((value) => {
    if (!EMAIL_PATTERN.test(value)) return false;
    const domain = value.split('@')[1] || '';
    const tld = domain.slice(domain.lastIndexOf('.') + 1);
    return ALLOWED_TLDS.has(tld);
  }, EMAIL_ERROR);

// La contraseña temporal es la credencial inicial: además de la longitud y el
// límite de bytes de passwordSchema, se exige diversidad de caracteres.
const temporaryPasswordSchema = passwordSchema.superRefine((value, ctx) => {
  const missing = [];
  if (!/\p{Lu}/u.test(value)) missing.push('una letra mayúscula');
  if (!/\p{Ll}/u.test(value)) missing.push('una letra minúscula');
  if (!/\d/.test(value)) missing.push('un número');
  if (!/[^\p{L}\p{N}\s]/u.test(value)) missing.push('un símbolo');

  if (missing.length > 0) {
    ctx.addIssue({
      code: 'custom',
      message: `La contraseña debe incluir ${missing.join(', ')}`,
    });
  }
});

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
    name: adminNameSchema,
    email: adminEmailSchema,
    password: temporaryPasswordSchema,
    role: roleSchema.default('estudiante'),
  })
  .strict();

const updateUserSchema = z
  .object({
    name: adminNameSchema.optional(),
    email: adminEmailSchema.optional(),
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
