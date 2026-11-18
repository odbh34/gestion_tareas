const request = require('supertest');
const { app, setupDatabase, resetDatabase } = require('./helpers');

beforeAll(setupDatabase);
beforeEach(resetDatabase);

const validUser = {
  name: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  password: 'Password123!',
};

async function register(overrides = {}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ ...validUser, ...overrides });
}

describe('validación estricta del registro', () => {
  it('acepta un registro válido y normaliza el nombre', async () => {
    const response = await register({ name: '  Ana   Pérez  ' });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Ana Pérez');
  });

  it('rechaza nombres con contenido arbitrario', async () => {
    const response = await register({ name: '<script>alert(1)</script>' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details.some((d) => d.path === 'name')).toBe(true);
  });

  it('rechaza correos con dominio mal formado', async () => {
    const response = await register({ email: 'ana@ejemplo..com' });

    expect(response.status).toBe(400);
    expect(response.body.error.details.some((d) => d.path === 'email')).toBe(true);
  });

  it('rechaza contraseñas comunes y con datos personales', async () => {
    const common = await register({ password: 'password' });
    const personal = await register({ password: 'AnaPérez123!' });

    expect(common.status).toBe(400);
    expect(personal.status).toBe(400);
    expect(personal.body.error.details.some((d) => d.path === 'password')).toBe(true);
  });

  it('acepta texto@texto.text porque solo valida el formato', async () => {
    const response = await register({ email: 'texto@texto.text' });

    expect(response.status).toBe(201);
  });
});
