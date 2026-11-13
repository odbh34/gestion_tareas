const request = require('supertest');
const {
  app,
  setupDatabase,
  resetDatabase,
  createUser,
  login,
  createTask,
} = require('./helpers');

let studentA;
let studentB;
let teacher;
let admin;
let studentACookie;
let studentBCookie;
let teacherCookie;
let adminCookie;

beforeAll(setupDatabase);

beforeEach(async () => {
  await resetDatabase();

  studentA = await createUser({
    name: 'Estudiante A',
    email: 'estudiante.a@example.com',
  });
  studentB = await createUser({
    name: 'Estudiante B',
    email: 'estudiante.b@example.com',
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

  studentACookie = (await login(studentA)).cookie;
  studentBCookie = (await login(studentB)).cookie;
  teacherCookie = (await login(teacher)).cookie;
  adminCookie = (await login(admin)).cookie;
});

describe('CRUD de tareas', () => {
  it('crea una tarea con el dueño tomado de la sesión', async () => {
    const response = await createTask(studentACookie, {
      title: 'Mi tarea',
      description: 'Contenido',
      status: 'en_progreso',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.title).toBe('Mi tarea');
    expect(response.body.data.status).toBe('en_progreso');
    expect(response.body.data.owner_id).toBe(studentA.id);
  });

  it('rechaza intentar asignar ownerId desde el body', async () => {
    const response = await createTask(studentACookie, {
      owner_id: studentB.id,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lista solo las tareas propias para un estudiante', async () => {
    await createTask(studentACookie, { title: 'Tarea de A' });
    await createTask(studentBCookie, { title: 'Tarea de B' });

    const response = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', studentACookie);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Tarea de A');
  });

  it('permite al docente y al administrador listar todas las tareas', async () => {
    await createTask(studentACookie, { title: 'Tarea de A' });
    await createTask(studentBCookie, { title: 'Tarea de B' });

    const teacherResponse = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', teacherCookie);
    const adminResponse = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', adminCookie);

    expect(teacherResponse.status).toBe(200);
    expect(teacherResponse.body.meta.total).toBe(2);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.meta.total).toBe(2);
  });

  it('oculta una tarea a otro estudiante con 404', async () => {
    const created = await createTask(studentACookie, { title: 'Privada' });
    const taskId = created.body.data.id;

    const getResponse = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Cookie', studentBCookie);
    const patchResponse = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Cookie', studentBCookie)
      .send({ title: 'Hackeada' });
    const deleteResponse = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Cookie', studentBCookie);

    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });

  it('permite al docente leer una tarea ajena pero no modificarla', async () => {
    const created = await createTask(studentACookie, { title: 'Revisable' });
    const taskId = created.body.data.id;

    const getResponse = await request(app)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Cookie', teacherCookie);
    const patchResponse = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Cookie', teacherCookie)
      .send({ status: 'completada' });

    expect(getResponse.status).toBe(200);
    expect(patchResponse.status).toBe(404);
  });

  it('permite al administrador actualizar y eliminar tareas ajenas', async () => {
    const created = await createTask(studentACookie, { title: 'Administrable' });
    const taskId = created.body.data.id;

    const patchResponse = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Cookie', adminCookie)
      .send({ status: 'completada' });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.data.status).toBe('completada');

    const deleteResponse = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Cookie', adminCookie);

    expect(deleteResponse.status).toBe(204);
  });

  it('permite editar y eliminar la propia tarea', async () => {
    const created = await createTask(studentACookie, { title: 'Editable' });
    const taskId = created.body.data.id;

    const patchResponse = await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Cookie', studentACookie)
      .send({ title: 'Editada', status: 'completada' });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.data.title).toBe('Editada');
    expect(patchResponse.body.data.status).toBe('completada');

    const deleteResponse = await request(app)
      .delete(`/api/v1/tasks/${taskId}`)
      .set('Cookie', studentACookie);

    expect(deleteResponse.status).toBe(204);
  });

  it('valida título, estado e identificador', async () => {
    const invalidStatus = await createTask(studentACookie, {
      status: 'estado-inventado',
    });
    const emptyTitle = await createTask(studentACookie, { title: '   ' });
    const invalidId = await request(app)
      .get('/api/v1/tasks/no-es-un-uuid')
      .set('Cookie', studentACookie);

    expect(invalidStatus.status).toBe(400);
    expect(emptyTitle.status).toBe(400);
    expect(invalidId.status).toBe(400);
  });

  it('filtra por estado y pagina resultados', async () => {
    await createTask(studentACookie, {
      title: 'Pendiente 1',
      status: 'pendiente',
    });
    await createTask(studentACookie, {
      title: 'Pendiente 2',
      status: 'pendiente',
    });
    await createTask(studentACookie, {
      title: 'Completada',
      status: 'completada',
    });

    const filtered = await request(app)
      .get('/api/v1/tasks?status=pendiente&limit=1&page=1')
      .set('Cookie', studentACookie);

    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.meta.total).toBe(2);
    expect(filtered.body.meta.totalPages).toBe(2);
  });
});
