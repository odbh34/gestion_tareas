const request = require('supertest');
const {
  app,
  setupDatabase,
  resetDatabase,
  createUser,
  login,
} = require('./helpers');

let admin;
let adminCookie;
let student;
let studentCookie;

beforeAll(setupDatabase);

beforeEach(async () => {
  await resetDatabase();

  admin = await createUser({
    name: 'Administrador',
    email: 'admin@example.com',
    role: 'administrador',
  });
  student = await createUser({
    name: 'Estudiante',
    email: 'estudiante@example.com',
  });

  adminCookie = (await login(admin)).cookie;
  studentCookie = (await login(student)).cookie;
});

describe('Gestión administrativa de usuarios', () => {
  it('permite al administrador crear usuarios con rol y contraseña válidos', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Docente Nuevo',
        email: 'docente@example.com',
        password: 'Docente123!',
        role: 'docente',
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Docente Nuevo',
      email: 'docente@example.com',
      role: 'docente',
      is_active: true,
    });
    expect(response.body.data.password_hash).toBeUndefined();

    const session = await login({
      email: 'docente@example.com',
      password: 'Docente123!',
    });
    expect(session.response.status).toBe(200);
  });

  it('impide que estudiantes creen usuarios', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Cookie', studentCookie)
      .send({
        name: 'Otro Usuario',
        email: 'otro@example.com',
        password: 'Password123!',
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rechaza correos duplicados, roles inválidos y campos extra al crear', async () => {
    const duplicate = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Duplicado',
        email: student.email,
        password: 'Password123!',
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');

    const invalidRole = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Rol Inválido',
        email: 'rol@example.com',
        password: 'Password123!',
        role: 'superadmin',
      });
    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error.code).toBe('VALIDATION_ERROR');

    const extraField = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({
        name: 'Campo Extra',
        email: 'extra@example.com',
        password: 'Password123!',
        is_active: false,
      });
    expect(extraField.status).toBe(400);
    expect(extraField.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza nombres con caracteres extraños, dominios inventados y contraseñas débiles', async () => {
    const validUser = {
      name: 'Usuario Seguro',
      email: 'seguro@example.com',
      password: 'Password123!',
    };

    const invalidName = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({ ...validUser, name: 'Usuario_123' });
    expect(invalidName.status).toBe(400);
    expect(invalidName.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidName.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'name' })]),
    );

    const invalidEmail = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({ ...validUser, email: 'ejemplo@correo.correo' });
    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidEmail.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'email' })]),
    );

    const weakPassword = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({ ...validUser, password: 'contrasenalarga' });
    expect(weakPassword.status).toBe(400);
    expect(weakPassword.body.error.code).toBe('VALIDATION_ERROR');
    expect(weakPassword.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'password' })]),
    );
  });

  it('acepta nombres con acentos y apóstrofos y dominios reales', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookie)
      .send({
        name: "María O'Brien",
        email: 'maria@empresa.es',
        password: 'ClaveTemporal123!',
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "María O'Brien",
      email: 'maria@empresa.es',
    });
  });

  it('permite actualizar nombre y correo sin exponer campos internos', async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Estudiante Actualizado', email: 'nuevo@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: student.id,
      name: 'Estudiante Actualizado',
      email: 'nuevo@example.com',
      role: 'estudiante',
    });
    expect(response.body.data.password_hash).toBeUndefined();
    expect(response.body.data.failed_attempts).toBeUndefined();
    expect(response.body.data.locked_until).toBeUndefined();

    const session = await login({
      email: 'nuevo@example.com',
      password: student.password,
    });
    expect(session.response.status).toBe(200);
  });

  it('rechaza correos duplicados, cuerpos vacíos y campos extra al editar', async () => {
    const duplicate = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', adminCookie)
      .send({ email: admin.email });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE');

    const empty = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', adminCookie)
      .send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const extra = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Nombre', role: 'administrador' });
    expect(extra.status).toBe(400);
    expect(extra.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza nombres y correos inválidos al editar un usuario', async () => {
    const invalidName = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', adminCookie)
      .send({ name: 'Usuario_123' });
    expect(invalidName.status).toBe(400);
    expect(invalidName.body.error.code).toBe('VALIDATION_ERROR');

    const invalidEmail = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', adminCookie)
      .send({ email: 'usuario@dominio.falso' });
    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('no permite cambiar la contraseña de un usuario desde la edición administrativa', async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', adminCookie)
      .send({ password: 'NuevaClave123!' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const session = await login(student);
    expect(session.response.status).toBe(200);
  });

  it('no expone una ruta administrativa para enviar enlace o restablecer contraseñas', async () => {
    const response = await request(app)
      .post(`/api/v1/users/${student.id}/reset-password`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('impide que un no administrador edite usuarios', async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${student.id}`)
      .set('Cookie', studentCookie)
      .send({ name: 'Cambio No Autorizado' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('desactiva una cuenta, revoca sus sesiones y permite reactivarla', async () => {
    const deactivated = await request(app)
      .patch(`/api/v1/users/${student.id}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: false });

    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.is_active).toBe(false);

    await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', studentCookie)
      .expect(401);
    expect((await login(student)).response.status).toBe(401);

    const reactivated = await request(app)
      .patch(`/api/v1/users/${student.id}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: true });

    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.is_active).toBe(true);
    expect((await login(student)).response.status).toBe(200);
  });

  it('impide que un administrador desactive su propia cuenta', async () => {
    const response = await request(app)
      .patch(`/api/v1/users/${admin.id}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: false });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');

    await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('devuelve 404 al operar sobre un usuario inexistente', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';

    const edited = await request(app)
      .patch(`/api/v1/users/${missingId}`)
      .set('Cookie', adminCookie)
      .send({ name: 'No Existe' });
    expect(edited.status).toBe(404);
    expect(edited.body.error.code).toBe('USER_NOT_FOUND');

    const status = await request(app)
      .patch(`/api/v1/users/${missingId}/status`)
      .set('Cookie', adminCookie)
      .send({ is_active: false });
    expect(status.status).toBe(404);
    expect(status.body.error.code).toBe('USER_NOT_FOUND');

    const role = await request(app)
      .patch(`/api/v1/users/${missingId}/role`)
      .set('Cookie', adminCookie)
      .send({ role: 'docente' });
    expect(role.status).toBe(404);
    expect(role.body.error.code).toBe('USER_NOT_FOUND');
  });
});
