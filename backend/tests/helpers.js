const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const pool = require('../src/config/database');
const { runMigrations } = require('../src/db/migrate');

async function setupDatabase() {
  await runMigrations();
}

async function resetDatabase() {
  // roles no se trunca: es catálogo fijo creado por la migración 002.
  await pool.query(
    `TRUNCATE TABLE auth_events, password_reset_tokens, sessions, tasks, users
     RESTART IDENTITY CASCADE`,
  );
}

async function createUser({
  name = 'Usuario de Prueba',
  email,
  password = 'Password123!',
  role = 'estudiante',
  isActive = true,
} = {}) {
  const passwordHash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role_id, is_active)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = $4), $5)
     RETURNING id, name, email, is_active`,
    [name, email, passwordHash, role, isActive],
  );

  return { ...rows[0], role, password };
}

function cookieFrom(response) {
  const setCookie = response.headers['set-cookie'] || [];
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function login(user) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password });

  return {
    response,
    cookie: cookieFrom(response),
  };
}

async function createTask(cookie, data = {}) {
  return request(app)
    .post('/api/v1/tasks')
    .set('Cookie', cookie)
    .send({
      title: 'Tarea de prueba',
      description: 'Descripción de prueba',
      status: 'pendiente',
      ...data,
    });
}

module.exports = {
  app,
  pool,
  setupDatabase,
  resetDatabase,
  createUser,
  cookieFrom,
  login,
  createTask,
};
