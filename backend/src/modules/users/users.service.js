const pool = require('../../config/database');
const env = require('../../config/env');

// Campos públicos: role_id, failed_attempts y locked_until son estado interno
// y no deben salir nunca en una respuesta de la API.
const PUBLIC_FIELDS = `
  u.id,
  u.name,
  u.email,
  r.name AS role,
  u.is_active,
  u.created_at,
  u.updated_at
`;

const PUBLIC_FROM = `
  FROM users u
  JOIN roles r ON r.id = u.role_id
`;

function toPublicUser(user) {
  if (!user) return null;
  const {
    password_hash: _passwordHash,
    role_id: _roleId,
    failed_attempts: _failedAttempts,
    locked_until: _lockedUntil,
    ...publicUser
  } = user;
  return publicUser;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS} ${PUBLIC_FROM} WHERE u.id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS} ${PUBLIC_FROM} WHERE u.email = $1`,
    [email],
  );
  return rows[0] || null;
}

async function findByEmailWithPassword(email) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS},
            u.password_hash,
            u.failed_attempts,
            u.locked_until,
            (u.locked_until IS NOT NULL AND u.locked_until > now()) AS is_locked
     ${PUBLIC_FROM}
     WHERE u.email = $1`,
    [email],
  );
  return rows[0] || null;
}

// Incremento atómico: el CASE calcula el bloqueo progresivo en la misma
// sentencia y el WHERE impide incrementar mientras la cuenta sigue bloqueada,
// para que un atacante no pueda prolongar el bloqueo a voluntad.
async function registerFailedAttempt(id) {
  const { rows } = await pool.query(
    `UPDATE users
     SET failed_attempts = failed_attempts + 1,
         locked_until = CASE
           WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(
             secs => LEAST(
               $3::double precision * power(2::double precision, failed_attempts + 1 - $2),
               $4::double precision
             )
           )
           ELSE locked_until
         END,
         updated_at = now()
     WHERE id = $1
       AND (locked_until IS NULL OR locked_until <= now())
     RETURNING failed_attempts, locked_until`,
    [
      id,
      env.LOCKOUT_THRESHOLD,
      env.LOCKOUT_BASE_SECONDS,
      env.LOCKOUT_MAX_SECONDS,
    ],
  );
  return rows[0] || null;
}

async function findByIdWithPassword(id) {
  const { rows } = await pool.query(
    'SELECT id, password_hash FROM users WHERE id = $1',
    [id],
  );
  return rows[0] || null;
}

async function updatePassword(id, passwordHash, client = pool) {
  await client.query(
    `UPDATE users
     SET password_hash = $2, updated_at = now()
     WHERE id = $1`,
    [id, passwordHash],
  );
}

async function resetFailedAttempts(id, client = pool) {
  await client.query(
    `UPDATE users
     SET failed_attempts = 0, locked_until = NULL, updated_at = now()
     WHERE id = $1`,
    [id],
  );
}

async function createUser({ name, email, passwordHash, role = 'estudiante' }) {
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = $4))
       RETURNING *
     )
     SELECT ${PUBLIC_FIELDS}
     FROM inserted u
     JOIN roles r ON r.id = u.role_id`,
    [name, email, passwordHash, role],
  );
  return rows[0];
}

async function listUsers({ email, page, limit }) {
  const conditions = [];
  const params = [];

  if (email) {
    params.push(`%${email}%`);
    conditions.push(`u.email ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM users u ${where}`,
    params,
  );

  const queryParams = [...params, limit, (page - 1) * limit];
  const limitPosition = queryParams.length - 1;
  const offsetPosition = queryParams.length;

  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS}
     ${PUBLIC_FROM}
     ${where}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
    queryParams,
  );

  const total = countResult.rows[0].total;

  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function updateRole(id, role) {
  const { rows } = await pool.query(
    `WITH updated AS (
       UPDATE users
       SET role_id = (SELECT id FROM roles WHERE name = $2),
           updated_at = now()
       WHERE id = $1
       RETURNING *
     )
     SELECT ${PUBLIC_FIELDS}
     FROM updated u
     JOIN roles r ON r.id = u.role_id`,
    [id, role],
  );
  return rows[0] || null;
}

module.exports = {
  PUBLIC_FIELDS,
  PUBLIC_FROM,
  toPublicUser,
  findById,
  findByEmail,
  findByEmailWithPassword,
  findByIdWithPassword,
  registerFailedAttempt,
  resetFailedAttempts,
  updatePassword,
  createUser,
  listUsers,
  updateRole,
};
