const request = require('supertest');
const { app, setupDatabase } = require('./helpers');

beforeAll(setupDatabase);

describe('Salud y manejo de errores', () => {
  it('responde en la ruta raíz', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('SportReserve Tasks API');
  });

  it('verifica la conexión a la base de datos', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'OK', database: 'up' });
  });

  it('devuelve 404 JSON para rutas inexistentes', async () => {
    const response = await request(app).get('/api/v1/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('rechaza JSON inválido con un error controlado', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });

  it('limita el tamaño del cuerpo de las solicitudes', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'x'.repeat(11_000),
        email: 'grande@example.com',
        password: 'Password123!',
      });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
