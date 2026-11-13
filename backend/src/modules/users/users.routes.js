const express = require('express');
const authenticate = require('../../middleware/auth');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const usersService = require('./users.service');
const {
  listUsersQuerySchema,
  userIdSchema,
  updateRoleSchema,
} = require('./users.schemas');

const router = express.Router();

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
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    res.status(200).json({ data: user });
  }),
);

module.exports = router;
