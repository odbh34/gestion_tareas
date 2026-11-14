require('dotenv').config({ quiet: true });

const { z } = require('zod');

const isProduction = process.env.NODE_ENV === 'production';

function booleanFromEnv(defaultValue) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
  }, z.boolean());
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1).optional(),
  POSTGRES_HOST: z.string().min(1).default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1).default('sportreserve'),
  POSTGRES_USER: z.string().min(1).default('sportreserve_user'),
  POSTGRES_PASSWORD: z.string().default(''),
  POSTGRES_DB_TEST: z.string().min(1).default('sportreserve_test'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().min(2).default('2h'),
  JWT_MAX_AGE_MS: z.coerce.number().int().positive().default(2 * 60 * 60 * 1000),
  COOKIE_NAME: z.string().min(1).default('sr_token'),
  COOKIE_SECURE: booleanFromEnv(isProduction),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5174,http://localhost:8080'),
  TRUST_PROXY: booleanFromEnv(false),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
  LOCKOUT_BASE_SECONDS: z.coerce.number().int().positive().default(60),
  LOCKOUT_MAX_SECONDS: z.coerce.number().int().positive().default(900),
  RATE_LIMIT_ENABLED: booleanFromEnv(true),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),

  SEED_STUDENT_PASSWORD: z.string().min(10).default('Demo12345!'),
  SEED_TEACHER_PASSWORD: z.string().min(10).default('Demo12345!'),
  SEED_ADMIN_PASSWORD: z.string().min(10).default('Demo12345!'),

  // Restablecimiento de contraseña por correo.
  FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(2525),
  SMTP_SECURE: booleanFromEnv(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  MAIL_FROM: z
    .string()
    .min(1)
    .default('SportReserve Tasks <no-reply@sportreserve.local>'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuración de entorno inválida:');
  for (const issue of parsed.error.issues) {
    console.error(`- ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;
const corsOrigins = raw.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  ...raw,
  // En pruebas se fuerza la base de test para no tocar datos de desarrollo.
  POSTGRES_DB: raw.NODE_ENV === 'test' ? raw.POSTGRES_DB_TEST : raw.POSTGRES_DB,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins,
};

module.exports = env;
module.exports.default = env;
