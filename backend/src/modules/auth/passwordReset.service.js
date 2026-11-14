const crypto = require('node:crypto');
const pool = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { hashPassword } = require('../../utils/password');
const mailer = require('../../utils/mailer');
const usersService = require('../users/users.service');
const sessionsService = require('./sessions.service');
const authEvents = require('./authEvents.service');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function requestReset({ email }, { ip } = {}) {
  // Se genera siempre un token ficticio, exista o no el correo, para que el
  // tiempo de respuesta no dependa de la existencia de la cuenta.
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);

  const user = await usersService.findByEmail(email);

  if (!user || !user.is_active) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Solo puede haber un token válido por usuario: los anteriores se anulan.
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );

    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3::int))`,
      [user.id, tokenHash, env.RESET_TOKEN_TTL_MINUTES],
    );

    await authEvents.record(
      'password_reset_requested',
      { userId: user.id, ip },
      client,
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  // No se espera el envío: la latencia del servidor de correo no debe revelar
  // si el correo existe. En pruebas la bandeja es en memoria y se espera para
  // que sea determinista.
  const delivery = mailer.sendPasswordResetEmail({
    to: user.email,
    token,
  });

  if (env.isTest) {
    await delivery;
  } else {
    void delivery.catch(() => {
      console.error('No se pudo enviar el correo de restablecimiento.');
    });
  }
}

function invalidResetToken() {
  return new AppError(
    400,
    'INVALID_RESET_TOKEN',
    'El enlace de restablecimiento no es válido o ha expirado',
  );
}

async function resetPassword({ token, newPassword }, { ip } = {}) {
  const tokenHash = hashToken(token);

  const { rows } = await pool.query(
    `SELECT t.id,
            t.user_id,
            (t.used_at IS NULL AND t.expires_at > now()) AS is_valid,
            u.is_active
     FROM password_reset_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1`,
    [tokenHash],
  );

  const record = rows[0];

  if (!record || !record.is_valid || !record.is_active) {
    await authEvents.record('password_reset_failed', {
      userId: record ? record.user_id : null,
      ip,
    });
    throw invalidResetToken();
  }

  const passwordHash = await hashPassword(newPassword);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await usersService.updatePassword(record.user_id, passwordHash, client);
    await usersService.resetFailedAttempts(record.user_id, client);

    // El token usado y cualquier otro pendiente del usuario quedan anulados.
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE user_id = $1 AND used_at IS NULL`,
      [record.user_id],
    );

    // Ninguna sesión anterior sobrevive al restablecimiento.
    await sessionsService.revokeAllUserSessions(record.user_id, {}, client);

    await authEvents.record(
      'password_reset_completed',
      { userId: record.user_id, ip },
      client,
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { requestReset, resetPassword };
