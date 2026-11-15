const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  app, pool, setupDatabase, resetDatabase, createUser, login, cookieFrom,
} = require('./helpers');
const env = require('../src/config/env');
const mailer = require('../src/utils/mailer');

beforeAll(setupDatabase);
beforeEach(async () => {
  await resetDatabase();
  mailer.clearOutbox();
});

async function resetToken(email) {
  const response = await request(app)
    .post('/api/v1/auth/forgot-password')
    .send({ email });
  expect(response.status).toBe(202);
  const message = mailer.outbox[mailer.outbox.length - 1];
  expect(message.to).toBe(email);
  const match = message.text.match(/#token=([A-Za-z0-9_-]+)/);
  expect(match).not.toBeNull();
  return match[1];
}

function reset(token, newPassword) {
  return request(app).post('/api/v1/auth/reset-password').send({ token, newPassword });
}

describe('Ciclo de vida de autenticación', () => {
  it('rechaza una sesión vencida en la base aunque el JWT siga vigente', async () => {
    const user = await createUser({ email: 'sesion@example.com' });
    const { response, cookie } = await login(user);
    expect(response.status).toBe(200);
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);

    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1", [user.id]);
    const expired = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('INVALID_SESSION');
  });

  it('rechaza un JWT vencido aunque la sesión siga activa', async () => {
    const user = await createUser({ email: 'jwt@example.com' });
    const { response, cookie } = await login(user);
    expect(response.status).toBe(200);
    const sid = jwt.decode(decodeURIComponent(cookie.split('=')[1])).jti;
    const token = jwt.sign({}, env.JWT_SECRET, {
      subject: user.id, jwtid: sid, expiresIn: -1,
      issuer: 'sportreserve-api', audience: 'sportreserve-web', algorithm: 'HS256',
    });
    const expired = await request(app).get('/api/v1/auth/me').set('Cookie', `${env.COOKIE_NAME}=${token}`);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe('INVALID_SESSION');
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
  });

  it('revoca la cookie anterior al cerrar sesión', async () => {
    const user = await createUser({ email: 'logout@example.com' });
    const { response, cookie } = await login(user);
    expect(response.status).toBe(200);
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
    await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  });

  it('invalida tokens anteriores, impide su reutilización y revoca sesiones al recuperar', async () => {
    const user = await createUser({ email: 'recuperar@example.com' });
    const firstSession = await login(user);
    const secondSession = await login(user);
    expect(firstSession.response.status).toBe(200);
    expect(secondSession.response.status).toBe(200);
    const oldToken = await resetToken(user.email);
    const token = await resetToken(user.email);
    const old = await reset(oldToken, 'NuevaClave123!');
    expect(old.status).toBe(400);
    expect(old.body.error.code).toBe('INVALID_RESET_TOKEN');
    await reset(token, 'NuevaClave123!').expect(200);
    const reused = await reset(token, 'OtraClave123!');
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('INVALID_RESET_TOKEN');
    for (const cookie of [firstSession.cookie, secondSession.cookie]) {
      await request(app).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
    }
    expect((await login(user)).response.status).toBe(401);
    expect((await login({ ...user, password: 'NuevaClave123!' })).response.status).toBe(200);
  });

  it('rechaza tokens de recuperación vencidos', async () => {
    const user = await createUser({ email: 'vencido@example.com' });
    const token = await resetToken(user.email);
    await pool.query("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1", [user.id]);
    const response = await reset(token, 'NuevaClave123!');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
    expect((await login(user)).response.status).toBe(200);
  });

  it('permite como máximo un uso concurrente del mismo token', async () => {
    const user = await createUser({ email: 'concurrente@example.com' });
    const token = await resetToken(user.email);
    const passwords = ['NuevaClave123!', 'OtraClave123!'];
    const responses = await Promise.all(passwords.map((password) => reset(token, password)));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const rejected = responses.find((response) => response.status === 400);
    expect(rejected.body.error.code).toBe('INVALID_RESET_TOKEN');
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    const matches = await Promise.all(passwords.map((password) => bcrypt.compare(password, rows[0].password_hash)));
    expect(matches).toEqual(responses.map((response) => response.status === 200));
  });

  it('incrementa el bloqueo tras su vencimiento sin prolongarlo durante el bloqueo', async () => {
    const user = await createUser({ email: 'bloqueo@example.com' });
    for (let attempt = 0; attempt < env.LOCKOUT_THRESHOLD; attempt += 1) {
      expect((await login({ ...user, password: 'incorrecta' })).response.status).toBe(401);
    }
    const state = () => pool.query(
      `SELECT failed_attempts, locked_until,
              EXTRACT(EPOCH FROM (locked_until - updated_at))::float AS duration
       FROM users WHERE id = $1`, [user.id],
    ).then((result) => result.rows[0]);
    const first = await state();
    expect(first.failed_attempts).toBe(env.LOCKOUT_THRESHOLD);
    expect(first.duration).toBeCloseTo(Math.min(env.LOCKOUT_BASE_SECONDS, env.LOCKOUT_MAX_SECONDS), 1);
    expect((await login(user)).response.status).toBe(401);
    const stillLocked = await state();
    expect(stillLocked.failed_attempts).toBe(first.failed_attempts);
    expect(stillLocked.locked_until).toEqual(first.locked_until);

    await pool.query("UPDATE users SET locked_until = now() - interval '1 second' WHERE id = $1", [user.id]);
    expect((await login({ ...user, password: 'incorrecta' })).response.status).toBe(401);
    const second = await state();
    expect(second.failed_attempts).toBe(env.LOCKOUT_THRESHOLD + 1);
    expect(second.duration).toBeCloseTo(Math.min(env.LOCKOUT_BASE_SECONDS * 2, env.LOCKOUT_MAX_SECONDS), 1);
    await pool.query("UPDATE users SET locked_until = now() - interval '1 second' WHERE id = $1", [user.id]);
    expect((await login(user)).response.status).toBe(200);
    const cleared = await state();
    expect(cleared.failed_attempts).toBe(0);
    expect(cleared.locked_until).toBeNull();
  });

  it('rota la sesión al cambiar la contraseña y revoca las otras', async () => {
    const user = await createUser({ email: 'cambio@example.com' });
    const first = await login(user);
    const second = await login(user);
    expect(first.response.status).toBe(200);
    expect(second.response.status).toBe(200);
    const changed = await request(app).post('/api/v1/auth/change-password')
      .set('Cookie', first.cookie)
      .send({ currentPassword: user.password, newPassword: 'NuevaClave123!' });
    expect(changed.status).toBe(200);
    const newCookie = cookieFrom(changed);
    expect(newCookie).not.toBe(first.cookie);
    await request(app).get('/api/v1/auth/me').set('Cookie', first.cookie).expect(401);
    await request(app).get('/api/v1/auth/me').set('Cookie', second.cookie).expect(401);
    await request(app).get('/api/v1/auth/me').set('Cookie', newCookie).expect(200);
  });
});
