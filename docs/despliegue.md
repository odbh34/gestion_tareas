# Guía de despliegue

> Para una demo académica sin coste, consulta la guía
> [`despliegue-gratuito.md`](despliegue-gratuito.md) (Neon + Render + Vercel).

## 1. Modos de ejecución

| Modo | Base de datos | Backend | Frontend | Uso |
| --- | --- | --- | --- | --- |
| Local | PostgreSQL instalado | `npm run dev` (3000) | `npm run dev` (5173) | Desarrollo diario |
| Docker | Contenedor PostgreSQL (5433) | Contenedor (3001) | Nginx (5174) | Demostración / entrega |
| Producción | PostgreSQL gestionado | Node + proxy inverso | Nginx / CDN | HTTPS real |

## 2. Variables de entorno

El backend valida todas las variables al iniciar y termina si falta algo
obligatorio. La plantilla está en `backend/.env.example`.

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NODE_ENV` | No | `development`, `test` o `production` |
| `PORT` | No | Puerto del backend (3000 por defecto) |
| `POSTGRES_HOST` | Sí | Host de PostgreSQL |
| `POSTGRES_PORT` | No | Puerto (5432 por defecto) |
| `POSTGRES_DB` | Sí | Nombre de la base |
| `POSTGRES_USER` | Sí | Usuario de la base |
| `POSTGRES_PASSWORD` | Sí | Contraseña de la base |
| `POSTGRES_DB_TEST` | No | Base para pruebas |
| `DATABASE_URL` | No | Alternativa completa a las variables `POSTGRES_*` |
| `JWT_SECRET` | Sí | Mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | No | Duración del token (`2h` por defecto) |
| `JWT_MAX_AGE_MS` | No | Duración de la cookie en ms |
| `COOKIE_NAME` | No | Nombre de la cookie (`sr_token`) |
| `COOKIE_SECURE` | No | `true` obligatorio con HTTPS |
| `CORS_ORIGINS` | No | Orígenes separados por coma |
| `TRUST_PROXY` | No | `true` detrás de proxy inverso |
| `BCRYPT_ROUNDS` | No | 10–14 (12 por defecto) |
| `RATE_LIMIT_ENABLED` | No | Activa/desactiva límites |
| `RATE_LIMIT_AUTH_MAX` | No | Intentos de auth por ventana |
| `RATE_LIMIT_GLOBAL_MAX` | No | Solicitudes globales por ventana |
| `SEED_*_PASSWORD` | No | Contraseñas de usuarios demo |

Generar un secreto:

```bash
openssl rand -hex 32
```

Nunca subas `backend/.env` al repositorio. El `.gitignore` ya lo excluye.

## 3. Desarrollo local

### PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER sportreserve_user WITH PASSWORD 'tu_password_local';
CREATE DATABASE sportreserve OWNER sportreserve_user;
ALTER USER sportreserve_user CREATEDB;
SQL
```

### Backend

```bash
cd backend
npm ci
cp .env.example .env
# Editar .env
npm run db:create:test
npm run db:migrate
npm run db:seed
npm run dev
```

Verificar:

```bash
curl http://localhost:3000/health
```

### Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Abrir http://localhost:5173.

## 4. Docker Compose

### Requisitos

- Docker Engine 24+
- Docker Compose v2
- Permisos para usar el socket de Docker

En Linux, si aparece `permission denied ... /var/run/docker.sock`:

```bash
sudo usermod -aG docker "$USER"
# Cerrar sesión y volver a entrar, o reiniciar el equipo
```

### Preparación

```bash
cp backend/.env.example backend/.env
# Editar POSTGRES_PASSWORD y JWT_SECRET
```

Compose usa `backend/.env` para la base y el backend. Los valores de
`environment` en `compose.yaml` sobrescriben los necesarios para la red interna
(`POSTGRES_HOST=db`).

### Arranque

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

Servicios:

- Frontend: http://localhost:5174
- API: http://localhost:3001
- PostgreSQL: `localhost:5433`

Sembrar datos demo:

```bash
docker compose exec -e ALLOW_SEED=true backend npm run db:seed
```

Detener:

```bash
docker compose down
```

Eliminar también los datos:

```bash
docker compose down -v
```

### Cambiar puertos

Edita `compose.yaml`:

```yaml
backend:
  ports:
    - "127.0.0.1:3001:3000"
frontend:
  ports:
    - "127.0.0.1:5174:80"
db:
  ports:
    - "127.0.0.1:5433:5432"
```

Si cambias el puerto del frontend, agrega el nuevo origen a `CORS_ORIGINS` en el
servicio `backend`.

## 5. Producción

### Checklist mínimo

- [ ] `NODE_ENV=production`.
- [ ] `JWT_SECRET` aleatorio y almacenado en un gestor de secretos.
- [ ] `COOKIE_SECURE=true` y HTTPS obligatorio.
- [ ] `CORS_ORIGINS` con el dominio real, sin comodines.
- [ ] `TRUST_PROXY=true` si hay proxy inverso.
- [ ] Contraseña de base robusta y usuario sin privilegios de superusuario.
- [ ] Respaldos automáticos y prueba de restauración.
- [ ] Rate limiting con almacén compartido si hay varias instancias.
- [ ] Logs centralizados y alertas de errores 5xx.
- [ ] Migraciones ejecutadas antes de habilitar tráfico.
- [ ] Seed deshabilitado (solo se ejecuta con `ALLOW_SEED=true`).

### Backend

```bash
cd backend
npm ci --omit=dev
NODE_ENV=production npm run db:migrate
NODE_ENV=production npm start
```

Usa un supervisor de procesos (systemd, PM2, contenedor orquestado) y un proxy
inverso (Nginx, Caddy, Traefik) que termine TLS.

### Frontend

```bash
cd frontend
npm ci
npm run build
```

Sirve `frontend/dist` con Nginx. El `nginx.conf` incluido hace proxy de `/api`
al servicio `backend` y aplica cabeceras de seguridad. Si el backend tiene otro
host, ajusta `proxy_pass`.

### Base de datos

- Usa un servicio gestionado o PostgreSQL con respaldos.
- Crea un usuario de aplicación sin `SUPERUSER` ni `CREATEDB` en producción.
- Ejecuta las migraciones como paso de despliegue.
- No ejecutes el seed en producción.

Respaldo y restauración:

```bash
pg_dump -Fc "$DATABASE_URL" > sportreserve.dump
pg_restore -d "$DATABASE_URL" --clean --if-exists sportreserve.dump
```

## 6. Verificación posterior al despliegue

```bash
curl -f https://tu-dominio.example/health
curl -i https://tu-dominio.example/api/v1/auth/me
```

Comprobar:

- `/health` responde `200` y `database: up`.
- La cookie incluye `Secure`, `HttpOnly` y `SameSite=Strict`.
- Un origen no permitido recibe `403`.
- El registro crea usuarios con rol `estudiante`.
- Un estudiante no puede acceder a tareas ajenas.
- Los logs no muestran contraseñas ni tokens.

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `permission denied` en Docker | Usuario sin grupo `docker` | `sudo usermod -aG docker $USER` y reiniciar sesión |
| `port is already allocated` | Puerto ocupado | Cambia el puerto del host en `compose.yaml` |
| Backend reinicia en bucle | Variables inválidas o BD no lista | `docker compose logs backend` |
| `password authentication failed` | Contraseña distinta a la del volumen | `docker compose down -v` y volver a crear |
| Cookie no se guarda | `SameSite`/dominio/HTTPS mal configurado | Revisa `COOKIE_SECURE`, dominio y proxy |
| `403 CORS_NOT_ALLOWED` | Origen no incluido | Agrega el origen exacto a `CORS_ORIGINS` |
| Migración con checksum distinto | Se editó una migración aplicada | Crea una migración nueva |
