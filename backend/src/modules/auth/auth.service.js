const AppError = require('../../utils/AppError');
const { hashPassword, verifyPassword } = require('../../utils/password');
const usersService = require('../users/users.service');

async function register({ name, email, password }) {
  const existingUser = await usersService.findByEmail(email);

  if (existingUser) {
    throw new AppError(409, 'EMAIL_IN_USE', 'El correo ya está registrado');
  }

  const passwordHash = await hashPassword(password);
  const user = await usersService.createUser({
    name,
    email,
    passwordHash,
    role: 'estudiante',
  });

  return usersService.toPublicUser(user);
}

async function login({ email, password }) {
  const user = await usersService.findByEmailWithPassword(email);
  const passwordMatches = user
    ? await verifyPassword(password, user.password_hash)
    : false;

  if (!user || !user.is_active || !passwordMatches) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Correo o contraseña incorrectos',
    );
  }

  return usersService.toPublicUser(user);
}

module.exports = { register, login };
