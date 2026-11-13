const request = require('supertest');
const {
  app,
  pool,
  setupDatabase,
  resetDatabase,
  createUser,
  login,
  createTask,
} = require('./helpers');

let student;
let otherStudent;
let teacher;
let admin;
let studentCookie;
let otherStudentCookie;
let teacherCookie;
let adminCookie;

beforeAll(setupDatabase);

beforeEach(async () => {
  await resetDatabase();

  student = await createUser({
    name: 'Estudiante',
    email: 'estudiante@example.com',
  });
  otherStudent = await createUser({
    name: 'Otro Estudiante',
    email: 'otro@example.com',
  });
  teacher = await createUser({
    name: 'Docente',
    email: 'docente@example.com',
    role: 'docente',
  });
  admin = await createUser({
    name: 'Administrador',
    email: 'admin@example.com',
    role: 'administrador',
  });

  studentCookie = (await login(student)).cookie;
  otherStudentCookie = (await login(otherStudent)).cookie;
  teacherCookie = (await login(teacher)).cookie;
  adminCookie = (await login(admin)).cookie;
});

describe('Seguridad: control de acceso', () => {
  it('bloquea IDOR en lectura, edición y borrado', async () => {
    const created = await createTask(studentCookie, {
      title: 'Datos privados',
    });
    const taskId = created.body.data.id;

    await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Cookie', otherStudentCookie)
      .expect(404);

    await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Cookie', otherStudentCookie)
      .send({ title: 'Intento de modificación' })
      .expect(404);

    await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Cookie', otherStudentCookie)
      .expect(404);

    const stillThere = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Cookie', studentCookie);

    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.title).toBe('Datos privados');
  });

  it('restringe la gestión de usuarios al administrador', async () => {
    await request(app)
      .get('/api/v1/users')
      .set('Cookie', studentCookie)
      .expect(403);

    await request(app)
      .get('/api/v1/users')
      .set('Cookie', teacherCookie)
      .expect(403);

    await request(app)
      .patch(`/api/v1/users/${student.id}/role`)
      .set('Cookie', studentCookie)
      .send({ role: 'administrador' })
      .expect(403);

    await request(app)
      .get('/api/v1/users')
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('impide que un administrador se quite su propio rol', async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${admin.id}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'estudiante' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANNOT_DEMOTE_SELF');
  });

  it('impide escalar rol mediante el registro', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Intruso',
      email: 'intruso@example.com',
      password: 'Password123!',
      role: 'administrador',
    });

    expect(response.status).toBe(400);
  });
});

describe('Seguridad: inyección SQL', () => {
  it('parametriza la búsqueda de usuarios por correo', async () => {
    const response = await request(app)
      .get('/api/v1/users')
      .query({ email: "' OR '1'='1" })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('no ejecuta payloads destructivos en la búsqueda de usuarios', async () => {
    const response = await request(app)
      .get('/api/v1/users')
      .query({ email: "'; DROP TABLE users; --" })
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);

    const table = await pool.query("SELECT to_regclass('public.users') AS name");
    expect(table.rows[0].name).toBe('users');

    await request(app)
      .get('/api/v1/users')
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('parametriza la búsqueda de tareas', async () => {
    await createTask(studentCookie, { title: 'Tarea legítima' });

    const response = await request(app)
      .get('/api/v1/tasks')
      .query({ q: "' OR 1=1 --" })
      .set('Cookie', studentCookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('no permite inyección SQL en el login', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: "' OR '1'='1",
      password: 'Password123!',
    });

    expect([400, 401]).toContain(response.status);
    expect(response.body.error).toBeDefined();
  });
});

describe('Seguridad: XSS y cabeceras', () => {
  it('guarda contenido peligroso como texto y lo devuelve como JSON', async () => {
    const payload = '<script>alert(1)</script>';
    const created = await createTask(studentCookie, {
      title: payload,
      description: '<img src=x onerror=alert(1)>',
    });

    expect(created.status).toBe(201);

    const list = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', studentCookie);

    expect(list.status).toBe(200);
    expect(list.headers['content-type']).toContain('application/json');
    expect(list.body.data[0].title).toBe(payload);
    expect(list.body.data[0].description).toBe('<img src=x onerror=alert(1)>');
  });

  it('envía cabeceras defensivas y no revela X-Powered-By', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('evita el cacheo de respuestas de la API', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', studentCookie);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('rechaza orígenes no permitidos', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Origin', 'http://sitio-malicioso.example');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CORS_NOT_ALLOWED');
  });

  it('permite los orígenes configurados', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });
});
