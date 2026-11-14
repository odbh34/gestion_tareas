-- 002_roles.sql
-- Normaliza los roles en su propia tabla y los referencia desde users.
-- migrate.js ya envuelve este archivo en una transacción: no usar BEGIN/COMMIT.

CREATE TABLE IF NOT EXISTS roles (
  id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
    CHECK (name = lower(name) AND char_length(name) BETWEEN 3 AND 30),
  description TEXT NOT NULL DEFAULT ''
);

INSERT INTO roles (id, name, description) VALUES
  (1, 'estudiante', 'Crea y gestiona sus propias tareas'),
  (2, 'docente', 'Consulta las tareas de todos los usuarios'),
  (3, 'administrador', 'Gestiona tareas y roles de los usuarios')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id SMALLINT;

-- Copia el rol de texto existente antes de eliminar la columna.
UPDATE users u
SET role_id = r.id
FROM roles r
WHERE r.name = u.role
  AND u.role_id IS NULL;

ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

ALTER TABLE users
  ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id)
  REFERENCES roles (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS users_role_id_idx ON users (role_id);

ALTER TABLE users DROP COLUMN IF EXISTS role;
