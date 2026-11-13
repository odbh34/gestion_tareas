const pool = require('../../config/database');

const PUBLIC_FIELDS = 'id, name, email, role, is_active, created_at, updated_at';

function toPublicUser(user) {
  if (!user) return null;
  const { password_hash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE email = $1`,
    [email],
  );
  return rows[0] || null;
}

async function findByEmailWithPassword(email) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS}, password_hash FROM users WHERE email = $1`,
    [email],
  );
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash, role = 'estudiante' }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_FIELDS}`,
    [name, email, passwordHash, role],
  );
  return rows[0];
}

async function listUsers({ email, page, limit }) {
  const conditions = [];
  const params = [];

  if (email) {
    params.push(`%${email}%`);
    conditions.push(`email ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM users ${where}`,
    params,
  );

  const queryParams = [...params, limit, (page - 1) * limit];
  const limitPosition = queryParams.length - 1;
  const offsetPosition = queryParams.length;

  const { rows } = await pool.query(
    `SELECT ${PUBLIC_FIELDS}
     FROM users
     ${where}
     ORDER BY created_at DESC, id DESC
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
    `UPDATE users
     SET role = $2, updated_at = now()
     WHERE id = $1
     RETURNING ${PUBLIC_FIELDS}`,
    [id, role],
  );
  return rows[0] || null;
}

module.exports = {
  toPublicUser,
  findById,
  findByEmail,
  findByEmailWithPassword,
  createUser,
  listUsers,
  updateRole,
};
