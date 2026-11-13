const app = require('./app');
const env = require('./config/env');
const pool = require('./config/database');

const server = app.listen(env.PORT, () => {
  console.log(`SportReserve Tasks API escuchando en http://localhost:${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Recibida señal ${signal}. Cerrando servidor...`);

  const forceExit = setTimeout(() => {
    console.error('Cierre forzado por tiempo de espera.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await pool.end();
    } finally {
      clearTimeout(forceExit);
      process.exit(0);
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
