const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function createLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
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
const authLimiter = createLimiter(env.RATE_LIMIT_AUTH_MAX);

module.exports = { globalLimiter, authLimiter };
