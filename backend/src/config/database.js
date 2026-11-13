const { Pool } = require('pg');
const env = require('./env');

const connection = env.DATABASE_URL
  ? { connectionString: env.DATABASE_URL }
  : {
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
    };

const pool = new Pool({
  ...connection,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
  if (!env.isTest) {
    console.error('Error inesperado del pool de PostgreSQL:', error.message);
  }
});

module.exports = pool;
