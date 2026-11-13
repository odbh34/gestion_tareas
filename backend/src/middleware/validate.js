const AppError = require('../utils/AppError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError(400, 'VALIDATION_ERROR', 'Datos inválidos', details));
    }

    req.validated = {
      ...(req.validated || {}),
      [source]: result.data,
    };

    return next();
  };
}

module.exports = validate;
