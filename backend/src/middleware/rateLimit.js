const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const WINDOW_MS = 15 * 60 * 1000;

function createLimiter(limit, { skipSuccessfulRequests = false } = {}) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.',
      },
    },
  });
}

const globalLimiter = createLimiter(env.RATE_LIMIT_GLOBAL_MAX);

// 20 fallos por IP cada 15 minutos: más holgado que el bloqueo por cuenta
// porque varios usuarios pueden compartir la misma IP (NAT de laboratorio).
const loginLimiter = createLimiter(20, { skipSuccessfulRequests: true });

// El registro no depende de credenciales: cuenta todas las solicitudes.
const registerLimiter = createLimiter(env.RATE_LIMIT_AUTH_MAX);

module.exports = { globalLimiter, loginLimiter, registerLimiter };
