const env = require('../config/env');
const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const usersService = require('../modules/users/users.service');

async function authenticate(req, res, next) {
  const token = req.cookies ? req.cookies[env.COOKIE_NAME] : undefined;

  if (!token) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Debes iniciar sesión'));
  }

  try {
    const payload = verifyToken(token);
    const user = await usersService.findById(payload.sub);

    if (!user || !user.is_active) {
      return next(new AppError(401, 'INVALID_SESSION', 'Sesión inválida o expirada'));
    }

    req.user = user;
    return next();
  } catch {
    return next(new AppError(401, 'INVALID_SESSION', 'Sesión inválida o expirada'));
  }
}

module.exports = authenticate;
