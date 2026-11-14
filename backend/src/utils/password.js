const bcrypt = require('bcryptjs');
const env = require('../config/env');

// Hash ficticio calculado una sola vez al arrancar. Se usa en el login cuando
// el correo no existe para que el tiempo de respuesta sea comparable al de un
// usuario real y no se pueda enumerar cuentas midiendo latencias.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  'hash-ficticio-para-igualar-tiempos',
  env.BCRYPT_ROUNDS,
);

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, env.BCRYPT_ROUNDS);
}

function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function verifyDummyPassword(plainPassword) {
  return bcrypt.compare(plainPassword, DUMMY_PASSWORD_HASH);
}

module.exports = { hashPassword, verifyPassword, verifyDummyPassword };
