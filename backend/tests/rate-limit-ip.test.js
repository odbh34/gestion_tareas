const express = require('express');
const request = require('supertest');
const env = require('../src/config/env');
const { forgotPasswordLimiter } = require('../src/middleware/rateLimit');

it('limita por IP las solicitudes de recuperación', async () => {
  const previous = env.RATE_LIMIT_ENABLED;
  env.RATE_LIMIT_ENABLED = true;
  const app = express();
  app.post('/forgot', forgotPasswordLimiter, (_req, res) => res.sendStatus(202));
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/forgot').expect(202);
    }
    const limited = await request(app).post('/forgot');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  } finally {
    env.RATE_LIMIT_ENABLED = previous;
  }
});
