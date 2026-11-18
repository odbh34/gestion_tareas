const { z } = require('zod');

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u;
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'qwerty123',
  'admin1234',
  'letmein123',
  'welcome123',
]);
const SEQUENCES = [
  '1234567890',
  'abcdefghij',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

const nameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'El nombre debe tener entre 2 y 80 caracteres')
      .max(80, 'El nombre debe tener entre 2 y 80 caracteres')
      .regex(NAME_PATTERN, 'Usa solo letras, espacios, guiones, apóstrofos y puntos')
      .refine(
        (value) => [...value].filter((char) => /\p{L}/u.test(char)).length >= 2,
        { message: 'El nombre debe incluir al menos dos letras' },
      ),
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email('Escribe un correo con formato válido, por ejemplo ana@ejemplo.com')
      .max(120, 'El correo no puede superar los 120 caracteres')
      .regex(EMAIL_PATTERN, 'El correo tiene un formato inválido')
      .refine((value) => !value.includes('..'), {
        message: 'El correo no puede contener puntos consecutivos',
      })
      .refine((value) => {
        const [local] = value.split('@');
        return Boolean(local) && !local.startsWith('.') && !local.endsWith('.');
      }, { message: 'El correo tiene un formato inválido antes de la @' })
      .refine((value) => /^[a-z]{2,}$/.test(value.split('.').pop()), {
        message: 'El dominio del correo no es válido',
      }),
  );

function addPasswordIssues(value, ctx, path) {
  const add = (message) =>
    ctx.addIssue(path ? { code: 'custom', path, message } : { code: 'custom', message });

  if ([...value].length < 10) {
    add('La contraseña debe tener al menos 10 caracteres');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    add('La contraseña es demasiado larga');
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) {
    add('Incluye mayúsculas y minúsculas');
  }
  if (!/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    add('Incluye un número y un símbolo');
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    add('Elige una contraseña menos común');
  }
  if (SEQUENCES.some((sequence) => value.toLowerCase() === sequence)) {
    add('Evita secuencias simples como 1234567890');
  }
}

const passwordSchema = z.string().superRefine((value, ctx) => {
  addPasswordIssues(value, ctx);
});

// El login sigue aceptando contraseñas antiguas: solo limita el tamaño UTF-8.
function utf8Password(minCharacters) {
  return z.string().superRefine((value, ctx) => {
    if ([...value].length < minCharacters) {
      ctx.addIssue({
        code: 'custom',
        message: `La contraseña debe tener al menos ${minCharacters} caracteres`,
      });
    }
    if (Buffer.byteLength(value, 'utf8') > 72) {
      ctx.addIssue({
        code: 'custom',
        message: 'La contraseña es demasiado larga',
      });
    }
  });
}

const loginPasswordSchema = utf8Password(1);

function passwordContainsPersonalData(password, name, email) {
  const tokens = [];
  const local = email.split('@')[0] || '';

  if (local.length >= 4) tokens.push(local.toLowerCase());
  name.split(/[ '\u2019.-]+/).forEach((part) => {
    if (part.length >= 4) tokens.push(part.toLowerCase());
  });

  const lower = password.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict()
  .superRefine(({ name, email, password }, ctx) => {
    if (passwordContainsPersonalData(password, name, email)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'No incluyas tu nombre ni tu correo en la contraseña',
      });
    }
  });

const loginSchema = z
  .object({
    email: emailSchema,
    password: loginPasswordSchema,
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: loginPasswordSchema,
    newPassword: passwordSchema,
  })
  .strict();

const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

const resetPasswordSchema = z
  .object({
    token: z.string().max(200),
    newPassword: passwordSchema,
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  nameSchema,
  emailSchema,
  passwordSchema,
  loginPasswordSchema,
};
