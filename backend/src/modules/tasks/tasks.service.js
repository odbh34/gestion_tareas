const pool = require('../../config/database');
const AppError = require('../../utils/AppError');

const TASK_SELECT = `
  t.id,
  t.title,
  t.description,
  t.status,
  t.owner_id,
  t.created_at,
  t.updated_at,
  u.name AS owner_name,
  u.email AS owner_email
`;

const SORT_COLUMNS = {
  created_at: 't.created_at',
  updated_at: 't.updated_at',
  title: 't.title',
  status: 't.status',
};

function canReadTask(user, task) {
  return (
    user.role === 'administrador' ||
    user.role === 'docente' ||
    task.owner_id === user.id
  );
}

function canWriteTask(user, task) {
  return user.role === 'administrador' || task.owner_id === user.id;
}

async function listTasks(user, { page, limit, status, q, sort, order }) {
  const conditions = [];
  const params = [];

  if (user.role === 'estudiante') {
    params.push(user.id);
    conditions.push(`t.owner_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  if (q) {
    params.push(`%${q}%`);
    conditions.push(
      `(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMNS[sort] || SORT_COLUMNS.created_at;
  const direction = order === 'asc' ? 'ASC' : 'DESC';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM tasks t ${where}`,
    params,
  );

  const queryParams = [...params, limit, (page - 1) * limit];
  const limitPosition = queryParams.length - 1;
  const offsetPosition = queryParams.length;

  const { rows } = await pool.query(
    `SELECT ${TASK_SELECT}
     FROM tasks t
     JOIN users u ON u.id = t.owner_id
     ${where}
     ORDER BY ${sortColumn} ${direction}, t.id DESC
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

async function findTaskById(id) {
  const { rows } = await pool.query(
    `SELECT ${TASK_SELECT}
     FROM tasks t
     JOIN users u ON u.id = t.owner_id
     WHERE t.id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function getTaskById(id, user) {
  const task = await findTaskById(id);

  // 404 también cuando existe pero no pertenece al usuario: evita enumerar IDs.
  if (!task || !canReadTask(user, task)) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Tarea no encontrada');
  }

  return task;
}

async function createTask(user, data) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, description, status, owner_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, description, status, owner_id, created_at, updated_at`,
    [data.title, data.description, data.status, user.id],
  );
  return rows[0];
}

async function updateTask(id, user, data) {
  const task = await findTaskById(id);

  if (!task || !canWriteTask(user, task)) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Tarea no encontrada');
  }

  const columns = {
    title: 'title',
    description: 'description',
    status: 'status',
  };
  const assignments = [];
  const params = [];

  for (const [field, column] of Object.entries(columns)) {
    if (data[field] !== undefined) {
      params.push(data[field]);
      assignments.push(`${column} = $${params.length}`);
    }
  }

  params.push(id);
  const idPosition = params.length;

  const { rows } = await pool.query(
    `UPDATE tasks
     SET ${assignments.join(', ')}, updated_at = now()
     WHERE id = $${idPosition}
     RETURNING id, title, description, status, owner_id, created_at, updated_at`,
    params,
  );

  return rows[0];
}

async function deleteTask(id, user) {
  const task = await findTaskById(id);

  if (!task || !canWriteTask(user, task)) {
    throw new AppError(404, 'TASK_NOT_FOUND', 'Tarea no encontrada');
  }

  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

module.exports = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  canReadTask,
  canWriteTask,
};
