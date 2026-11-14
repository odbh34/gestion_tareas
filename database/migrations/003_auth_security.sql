-- 003_auth_security.sql
-- Estado de bloqueo por cuenta, sesiones por dispositivo, tokens de
-- restablecimiento y auditoría de eventos de autenticación.
-- migrate.js ya envuelve este archivo en una transacción: no usar BEGIN/COMMIT.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE users
  ADD CONSTRAINT users_failed_attempts_check CHECK (failed_attempts >= 0);

-- Cada inicio de sesión crea una fila; el JWT lleva su id en el claim jti.
-- expires_at se calcula con now() de PostgreSQL, nunca con el reloj de Node.
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- Solo se guarda el SHA-256 del token; el valor original viaja únicamente al
-- usuario por correo y nunca se persiste ni se registra en logs.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON password_reset_tokens (user_id);

-- Auditoría mínima: nunca guarda correos, contraseñas ni tokens.
CREATE TABLE IF NOT EXISTS auth_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'register',
    'login_success',
    'login_failed',
    'account_locked',
    'logout',
    'password_changed',
    'password_reset_requested',
    'password_reset_completed',
    'password_reset_failed'
  )),
  ip TEXT CHECK (ip IS NULL OR char_length(ip) <= 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_events_user_created_idx
  ON auth_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_events_type_created_idx
  ON auth_events (event_type, created_at DESC);
