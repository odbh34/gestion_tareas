const request = require('supertest');
const {
  app,
  setupDatabase,
  resetDatabase,
  createUser,
  login,
  cookieFrom,
} = require('./helpers');

beforeAll(setupDatabase);
beforeEach(resetDatabase);

describe('Autenticación', () => {
  it('registra un estudiante y normaliza el correo', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Ana Pérez',
      email: '  ANA@Example.COM ',
      password: 'Password123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('ana@example.com');
    expect(response.body.data.role).toBe('estudiante');
    expect(response.body.data.password_hash).toBeUndefined();
  });

  it('rechaza un rol inyectado en el registro', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'Password123!',
      role: 'administrador',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza correos duplicados', async () => {
    await createUser({ email: 'ana@example.com' });

    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Otra Ana',
      email: 'ana@example.com',
      password: 'Password123!',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_IN_USE');
  });

  it('rechaza contraseñas débiles', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'corta',
    });

    expect(response.status).toBe(400);
  });

  it('inicia sesión y establece una cookie HttpOnly SameSite=Strict', async () => {
    const user = await createUser({ email: 'ana@example.com' });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe(user.email);
    expect(response.body.data.password_hash).toBeUndefined();

    const setCookie = (response.headers['set-cookie'] || []).join(';');
    expect(setCookie).toContain('sr_token=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
  });

  it('rechaza credenciales inválidas con un mensaje genérico', async () => {
    const user = await createUser({ email: 'ana@example.com' });

    const badPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NoEsLaClave123!' });

    const unknownUser = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nadie@example.com', password: 'Password123!' });

    expect(badPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(badPassword.body.error.message).toBe(
      'Correo o contraseña incorrectos',
    );
    expect(unknownUser.body.error.message).toBe(
      'Correo o contraseña incorrectos',
    );
  });

  it('rechaza el login de un usuario inactivo', async () => {
    const user = await createUser({
      email: 'inactivo@example.com',
      isActive: false,
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });

    expect(response.status).toBe(401);
  });

  it('protege /me y permite cerrar sesión', async () => {
    const user = await createUser({ email: 'ana@example.com' });
    const { cookie } = await login(user);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(user.email);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie);

    expect(logout.status).toBe(204);
    expect((logout.headers['set-cookie'] || []).join(';')).toContain(
      'sr_token=;',
    );

    const withoutCookie = await request(app).get('/api/v1/auth/me');
    expect(withoutCookie.status).toBe(401);
  });

  it('invalida la sesión si el usuario es desactivado', async () => {
    const user = await createUser({ email: 'ana@example.com' });
    const { cookie } = await login(user);

    await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    await require('./helpers').pool.query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [user.id],
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie);

    expect(response.status).toBe(401);
  });

  it('no devuelve password_hash en el registro', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'Password123!',
    });

    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });

  it('extrae la cookie correctamente en el helper', async () => {
    const user = await createUser({ email: 'ana@example.com' });
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: user.password });

    expect(cookieFrom(response)).toContain('sr_token=');
  });
});
