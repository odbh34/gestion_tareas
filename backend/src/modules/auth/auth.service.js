const AppError = require('../../utils/AppError');
const {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
} = require('../../utils/password');
const usersService = require('../users/users.service');
const authEvents = require('./authEvents.service');

function invalidCredentials() {
  // Mismo código y mensaje para correo inexistente, contraseña errónea,
  // cuenta inactiva o bloqueada.
  return new AppError(
    401,
    'INVALID_CREDENTIALS',
    'Correo o contraseña incorrectos. Si has tenido varios intentos fallidos, espera unos minutos antes de volver a intentarlo.',
  );
}

async function register({ name, email, password }, { ip } = {}) {
  const existingUser = await usersService.findByEmail(email);

  // Compromiso aceptado y documentado: el registro revela si el correo existe.
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

  await authEvents.record('register', { userId: user.id, ip });

  return usersService.toPublicUser(user);
}

async function login({ email, password }, { ip } = {}) {
  const user = await usersService.findByEmailWithPassword(email);

  // Se compara SIEMPRE con bcrypt, incluso si el correo no existe, para que el
  // tiempo de respuesta no revele qué cuentas están registradas.
  const passwordMatches = user
    ? await verifyPassword(password, user.password_hash)
    : await verifyDummyPassword(password);

  if (!user) {
    await authEvents.record('login_failed', { userId: null, ip });
    throw invalidCredentials();
  }

  if (user.is_locked || !user.is_active || !passwordMatches) {
    // Un intento sobre una cuenta ya bloqueada no incrementa el contador:
    // así el atacante no puede alargar el bloqueo indefinidamente.
    if (!user.is_locked) {
      const attempt = await usersService.registerFailedAttempt(user.id);
      if (attempt?.locked_until) {
        await authEvents.record('account_locked', { userId: user.id, ip });
      }
    }

    await authEvents.record('login_failed', { userId: user.id, ip });
    throw invalidCredentials();
  }

  await usersService.resetFailedAttempts(user.id);
  await authEvents.record('login_success', { userId: user.id, ip });

  return usersService.toPublicUser(user);
}

module.exports = { register, login };
