const express = require('express');
const pool = require('../../config/database');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { hashPassword } = require('../../utils/password');
const sessionsService = require('../auth/sessions.service');
const usersService = require('./users.service');
const {
  listUsersQuerySchema,
  userIdSchema,
  createUserSchema,
  updateUserSchema,
  updateRoleSchema,
  updateStatusSchema,
} = require('./users.schemas');

const router = express.Router();

function emailInUse() {
  return new AppError(409, 'EMAIL_IN_USE', 'El correo ya está registrado');
}

function userNotFound() {
  return new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
}

router.use(authenticate);

router.get(
  '/',
  authorize('administrador'),
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await usersService.listUsers(req.validated.query);
    res.status(200).json(result);
  }),
);

router.post(
  '/',
  authorize('administrador'),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.validated.body;

    const existing = await usersService.findByEmail(email);
    if (existing) throw emailInUse();

    const passwordHash = await hashPassword(password);
    let user;

    try {
      user = await usersService.createUser({
        name,
        email,
        passwordHash,
        role,
      });
    } catch (error) {
      if (error.code === '23505') throw emailInUse();
      throw error;
    }

    res.status(201).json({ data: user });
  }),
);

router.patch(
  '/:id',
  authorize('administrador'),
  validate(userIdSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const data = req.validated.body;

    if (data.email) {
      const existing = await usersService.findByEmail(data.email);
      if (existing && existing.id !== id) throw emailInUse();
    }

    let user;

    try {
      user = await usersService.updateUser(id, data);
    } catch (error) {
      if (error.code === '23505') throw emailInUse();
      throw error;
    }

    if (!user) throw userNotFound();

    res.status(200).json({ data: user });
  }),
);

router.patch(
  '/:id/role',
  authorize('administrador'),
  validate(userIdSchema, 'params'),
  validate(updateRoleSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { role } = req.validated.body;

    if (id === req.user.id && role !== 'administrador') {
      throw new AppError(
        400,
        'CANNOT_DEMOTE_SELF',
        'Un administrador no puede quitarse su propio rol',
      );
    }

    const user = await usersService.updateRole(id, role);
    if (!user) throw userNotFound();

    res.status(200).json({ data: user });
  }),
);

router.patch(
  '/:id/status',
  authorize('administrador'),
  validate(userIdSchema, 'params'),
  validate(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validated.params;
    const { is_active: isActive } = req.validated.body;

    if (id === req.user.id && !isActive) {
      throw new AppError(
        400,
        'CANNOT_DEACTIVATE_SELF',
        'Un administrador no puede desactivar su propia cuenta',
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const user = await usersService.updateStatus(id, isActive, client);
      if (!user) throw userNotFound();

      // Al desactivar, las sesiones abiertas dejan de servir de inmediato.
      if (!isActive) {
        await sessionsService.revokeAllUserSessions(id, {}, client);
      }

      await client.query('COMMIT');
      res.status(200).json({ data: user });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

module.exports = router;
