const pool = require('../../config/database');
const env = require('../../config/env');
const { PUBLIC_FIELDS } = require('../users/users.service');

// Las funciones aceptan un cliente de transacción opcional para que el cambio
// de contraseña y el restablecimiento puedan revocar y crear sesiones de forma
// atómica junto con el UPDATE de la contraseña.
async function createSession(userId, client = pool) {
  // Limpieza oportunista: evita acumular sesiones vencidas del mismo usuario.
  await client.query(
    'DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()',
    [userId],
  );

  const { rows } = await client.query(
    `INSERT INTO sessions (user_id, expires_at)
     VALUES ($1, now() + ($2::bigint * interval '1 millisecond'))
     RETURNING id, expires_at`,
    [userId, env.JWT_MAX_AGE_MS],
  );

  return rows[0];
}

async function findActiveUserBySession(sessionId, userId, client = pool) {
  const params = [sessionId];
  let userCondition = '';

  // El dueño de la sesión debe coincidir con el sub del JWT.
  if (userId) {
    params.push(userId);
    userCondition = 'AND s.user_id = $2';
  }

  const { rows } = await client.query(
    `SELECT ${PUBLIC_FIELDS}
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.id = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       ${userCondition}
       AND u.is_active`,
    params,
  );

  return rows[0] || null;
}

async function revokeSession(sessionId, client = pool) {
  await client.query(
    `UPDATE sessions
     SET revoked_at = COALESCE(revoked_at, now())
     WHERE id = $1`,
    [sessionId],
  );
}

async function revokeAllUserSessions(userId, { exceptSid } = {}, client = pool) {
  const params = [userId];
  let exception = '';

  if (exceptSid) {
    params.push(exceptSid);
    exception = 'AND id <> $2';
  }

  await client.query(
    `UPDATE sessions
     SET revoked_at = now()
     WHERE user_id = $1
       AND revoked_at IS NULL
       ${exception}`,
    params,
  );
}

module.exports = {
  createSession,
  findActiveUserBySession,
  revokeSession,
  revokeAllUserSessions,
};
