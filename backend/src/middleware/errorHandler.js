const env = require('../config/env');
const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Recurso no encontrado'));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Error interno del servidor';
  let details;

  if (error instanceof AppError) {
    status = error.status;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ZodError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Datos inválidos';
    details = error.issues;
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'El cuerpo de la solicitud no es JSON válido';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'El cuerpo de la solicitud es demasiado grande';
  } else if (error.code === '23505') {
    status = 409;
    code = 'CONFLICT';
    message = 'El recurso ya existe';
  } else if (error.code === '23503') {
    status = 409;
    code = 'CONFLICT';
    message = 'El recurso está relacionado con otros datos';
  } else if (error.code === '23514' || error.code === '22P02') {
    status = 400;
    code = 'INVALID_DATA';
    message = 'Datos inválidos';
  }

  if (status >= 500 && !env.isTest) {
    console.error('Error no controlado:', error);
  }

  return res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

module.exports = { notFound, errorHandler };
