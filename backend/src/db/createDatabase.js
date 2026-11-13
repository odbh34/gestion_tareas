const { Client } = require('pg');
const env = require('../config/env');

const targetDatabase = env.POSTGRES_DB_TEST;

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(targetDatabase)) {
  console.error('Nombre de base de datos de pruebas inválido.');
  process.exit(1);
}

function adminConnectionConfig() {
  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    url.pathname = '/postgres';
    return { connectionString: url.toString() };
  }

  return {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: 'postgres',
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
  };
}

async function createTestDatabase() {
  const client = new Client(adminConnectionConfig());
  await client.connect();

  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDatabase],
    );

    if (existing.rows.length > 0) {
      console.log(`Base de datos de pruebas ya existe: ${targetDatabase}`);
      return;
    }

    await client.query(`CREATE DATABASE "${targetDatabase}"`);
    console.log(`Base de datos de pruebas creada: ${targetDatabase}`);
  } finally {
    await client.end();
  }
}

createTestDatabase().catch((error) => {
  console.error('No se pudo crear la base de pruebas:', error.message);
  process.exit(1);
});
