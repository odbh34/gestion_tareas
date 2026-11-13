const path = require('node:path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
});

process.env.NODE_ENV = 'test';
process.env.POSTGRES_DB =
  process.env.POSTGRES_DB_TEST || 'sportreserve_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters-123456';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.BCRYPT_ROUNDS = '10';
process.env.COOKIE_SECURE = 'false';

const pool = require('../src/config/database');

afterAll(async () => {
  await pool.end();
});
