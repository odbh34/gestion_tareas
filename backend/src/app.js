const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const pool = require('./config/database');
const AppError = require('./utils/AppError');
const asyncHandler = require('./utils/asyncHandler');
const { globalLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const tasksRoutes = require('./modules/tasks/tasks.routes');

const app = express();

app.set('trust proxy', env.TRUST_PROXY ? 1 : false);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(
        new AppError(403, 'CORS_NOT_ALLOWED', 'Origen no permitido'),
      );
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '10kb', strict: true }));
app.use(cookieParser());

if (!env.isTest) {
  app.use(morgan('combined'));
}

// Defensa CSRF adicional: SameSite=Strict + validación de Origin.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  if (origin && !env.corsOrigins.includes(origin)) {
    return next(
      new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origen de la solicitud no permitido'),
    );
  }

  return next();
});

app.get('/', (req, res) => {
  res.status(200).json({
    data: {
      name: 'SportReserve Tasks API',
      version: '1.0.0',
      docs: '/api/v1',
    },
  });
});

app.get(
  '/health',
  asyncHandler(async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'OK', database: 'up' });
    } catch {
      res.status(503).json({ status: 'DEGRADED', database: 'down' });
    }
  }),
);

app.use('/api', globalLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/tasks', tasksRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
