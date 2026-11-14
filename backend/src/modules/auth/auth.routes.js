const express = require('express');
const env = require('../../config/env');
const pool = require('../../config/database');
const authenticate = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { loginLimiter, registerLimiter } = require('../../middleware/rateLimit');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { signToken, verifyToken } = require('../../utils/jwt');
const { hashPassword, verifyPassword } = require('../../utils/password');
const authService = require('./auth.service');
const authEvents = require('./authEvents.service');
const sessionsService = require('./sessions.service');
const usersService = require('../users/users.service');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} = require('./auth.schemas');

const router = express.Router();

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
  };
}

function cookieOptions() {
  return { ...baseCookieOptions(), maxAge: env.JWT_MAX_AGE_MS };
}

// Devuelve la sesión del cookie solo si la firma es válida y trae jti.
// No consulta la base: se usa para rotar o revocar sesiones, donde un token
// inválido simplemente se ignora.
function sessionFromCookie(req) {
  const token = req.cookies ? req.cookies[env.COOKIE_NAME] : undefined;
  if (!token) return null;

  try {
    const payload = verifyToken(token);
    if (!payload.jti || !payload.sub) return null;
    return { sessionId: payload.jti, userId: payload.sub };
  } catch {
    return null;
  }
}

router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.register(req.validated.body, {
      ip: req.ip,
    });
    res.status(201).json({ data: user });
  }),
);

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const previous = sessionFromCookie(req);
    const user = await authService.login(req.validated.body, { ip: req.ip });

    // Rotación: si la petición ya traía una sesión válida del mismo usuario,
    // se revoca antes de crear la nueva para que el identificador no se reutilice.
    if (previous && previous.userId === user.id) {
      await sessionsService.revokeSession(previous.sessionId);
    }

    const session = await sessionsService.createSession(user.id);
    const token = signToken(user.id, session.id);
    res.cookie(env.COOKIE_NAME, token, cookieOptions());
    res.status(200).json({ data: user });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Idempotente: sin cookie o con token inválido también responde 204.
    const session = sessionFromCookie(req);

    if (session) {
      await sessionsService.revokeSession(session.sessionId);
      await authEvents.record('logout', {
        userId: session.userId,
        ip: req.ip,
      });
    }

    res.clearCookie(env.COOKIE_NAME, baseCookieOptions());
    res.status(204).end();
  }),
);

router.post(
  '/change-password',
  loginLimiter,
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.validated.body;
    const current = await usersService.findByIdWithPassword(req.user.id);

    if (!current) {
      throw new AppError(401, 'INVALID_SESSION', 'Sesión inválida o expirada');
    }

    const currentMatches = await verifyPassword(
      currentPassword,
      current.password_hash,
    );

    if (!currentMatches) {
      throw new AppError(
        400,
        'INVALID_CURRENT_PASSWORD',
        'La contraseña actual no es correcta',
      );
    }

    if (newPassword === currentPassword) {
      throw new AppError(
        400,
        'SAME_PASSWORD',
        'La nueva contraseña debe ser distinta de la actual',
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await usersService.updatePassword(req.user.id, passwordHash, client);
      // El cambio de contraseña invalida todas las sesiones, incluidas las de
      // otros dispositivos; se emite una nueva para quien hizo el cambio.
      await sessionsService.revokeAllUserSessions(req.user.id, {}, client);
      const session = await sessionsService.createSession(req.user.id, client);
      await authEvents.record(
        'password_changed',
        { userId: req.user.id, ip: req.ip },
        client,
      );
      await client.query('COMMIT');

      const token = signToken(req.user.id, session.id);
      res.cookie(env.COOKIE_NAME, token, cookieOptions());
      res.status(200).json({
        data: { message: 'Contraseña actualizada correctamente' },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.status(200).json({ data: req.user });
  }),
);

module.exports = router;
