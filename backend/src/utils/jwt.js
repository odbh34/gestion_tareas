const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ISSUER = 'sportreserve-api';
const AUDIENCE = 'sportreserve-web';

function signToken(userId, sessionId) {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    // jti identifica la fila de sessions; sin él el token no es válido.
    jwtid: sessionId,
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

module.exports = { signToken, verifyToken };
