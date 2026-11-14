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

app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');

// Evita que CDNs y proxies (por ejemplo, el rewrite de Vercel) cacheen
// respuestas autenticadas o con datos personales.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

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
  // El formato combined es el estándar de Apache; el token xff solo se añade
  // cuando LOG_FORWARDED_FOR está activo (medición de saltos de proxy).
  morgan.token('xff', (req) => req.headers['x-forwarded-for'] || '-');
  const format = env.LOG_FORWARDED_FOR
    ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" xff=":xff"'
    : 'combined';
  app.use(morgan(format));
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
