const pool = require('../../config/database');
const env = require('../../config/env');

// Registro de auditoría de autenticación. Nunca lanza excepciones: un fallo al
// auditar no debe tumbar el login ni revelar información al cliente.
// Tampoco guarda correos, contraseñas ni tokens.
async function record(eventType, { userId = null, ip = null } = {}, client = pool) {
  try {
    const safeIp =
      typeof ip === 'string' && ip.length > 0 ? ip.slice(0, 64) : null;

    await client.query(
      `INSERT INTO auth_events (user_id, event_type, ip)
       VALUES ($1, $2, $3)`,
      [userId, eventType, safeIp],
    );
  } catch (error) {
    if (!env.isTest) {
      console.error('No se pudo registrar el evento de autenticación:', error.message);
    }
  }
}

module.exports = { record };
