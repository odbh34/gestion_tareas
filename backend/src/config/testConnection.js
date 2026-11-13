require('dotenv').config({ quiet: true });

const pool = require('./database');

async function testConnection() {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, current_user AS user, NOW() AS now',
    );

    console.log('Conexión a PostgreSQL exitosa');
    console.log('Base de datos:', result.rows[0].database);
    console.log('Usuario:', result.rows[0].user);
    console.log('Hora del servidor:', result.rows[0].now);
  } catch (error) {
    console.error('Error al conectar con PostgreSQL:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();
