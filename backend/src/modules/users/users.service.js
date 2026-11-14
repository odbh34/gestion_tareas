const pool = require('../../config/database');

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
    `SELECT ${PUBLIC_FIELDS}, u.password_hash, u.failed_attempts, u.locked_until
     ${PUBLIC_FROM}
     WHERE u.email = $1`,
    [email],
  );
  return rows[0] || null;
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
  toPublicUser,
  findById,
  findByEmail,
  findByEmailWithPassword,
  createUser,
  listUsers,
  updateRole,
};
