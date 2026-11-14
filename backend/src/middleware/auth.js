const env = require('../config/env');
const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const sessionsService = require('../modules/auth/sessions.service');

async function authenticate(req, res, next) {
  const token = req.cookies ? req.cookies[env.COOKIE_NAME] : undefined;

  if (!token) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión'));
  }

  try {
    const payload = verifyToken(token);

    // Los tokens anteriores a las sesiones por dispositivo no llevan jti.
    if (!payload.jti || !payload.sub) {
      return next(
        new AppError(401, 'INVALID_SESSION', 'Sesión inválida o expirada'),
      );
    }

    const user = await sessionsService.findActiveUserBySession(
      payload.jti,
      payload.sub,
    );

    if (!user) {
      return next(
        new AppError(401, 'INVALID_SESSION', 'Sesión inválida o expirada'),
      );
    }

    req.user = user;
    req.sessionId = payload.jti;
    return next();
  } catch {
    return next(new AppError(401, 'INVALID_SESSION', 'Sesión inválida o expirada'));
  }
}

module.exports = authenticate;
