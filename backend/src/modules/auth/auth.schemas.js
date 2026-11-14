const { z } = require('zod');

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(120));

// bcrypt trunca silenciosamente a 72 bytes: validamos el tamaño real en UTF-8
// y no en unidades UTF-16 para rechazar contraseñas que se cortarían.
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
        message: 'La contraseña no puede superar los 72 bytes en UTF-8',
      });
    }
  });
}

const passwordSchema = utf8Password(10);
const loginPasswordSchema = utf8Password(1);

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: loginPasswordSchema,
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
  emailSchema,
  passwordSchema,
  loginPasswordSchema,
};
