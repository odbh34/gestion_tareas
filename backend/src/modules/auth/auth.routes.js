const express = require('express');
const env = require('../../config/env');
const authenticate = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { authLimiter } = require('../../middleware/rateLimit');
const asyncHandler = require('../../utils/asyncHandler');
const { signToken } = require('../../utils/jwt');
const authService = require('./auth.service');
const sessionsService = require('./sessions.service');
const { registerSchema, loginSchema } = require('./auth.schemas');

const router = express.Router();

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: '/',
    maxAge: env.JWT_MAX_AGE_MS,
  };
}

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.register(req.validated.body);
    res.status(201).json({ data: user });
  }),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.login(req.validated.body);
    const session = await sessionsService.createSession(user.id);
    const token = signToken(user.id, session.id);
    res.cookie(env.COOKIE_NAME, token, cookieOptions());
    res.status(200).json({ data: user });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'strict',
      path: '/',
    });
    res.status(204).end();
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
