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
| `TRUST_PROXY` | No | Número de proxies de confianza (`0` sin proxy, `1` Nginx de Compose). `true` se acepta como `1` por compatibilidad |
| `LOG_FORWARDED_FOR` | No | `true` agrega el `X-Forwarded-For` crudo al log; apagado por defecto |
| `LOCKOUT_THRESHOLD` | No | Fallos antes de bloquear (5 por defecto) |
| `LOCKOUT_BASE_SECONDS` | No | Bloqueo inicial (60 s) |
| `LOCKOUT_MAX_SECONDS` | No | Tope del bloqueo (900 s) |
| `FRONTEND_URL` | Sí para reset | Origen del frontend para construir el enlace de restablecimiento |
| `RESET_TOKEN_TTL_MINUTES` | No | Caducidad del token de reset (15 min) |
| `SMTP_HOST` | No | Servidor SMTP; vacío = no se envían correos |
| `SMTP_PORT` | No | Puerto SMTP (2525 por defecto; Mailpit usa 1025 en Compose) |
| `SMTP_SECURE` | No | `true` para TLS implícito |
| `SMTP_USER` / `SMTP_PASS` | No | Credenciales SMTP; nunca en el repositorio |
| `MAIL_FROM` | No | Remitente de los correos |
| `BCRYPT_ROUNDS` | No | 10–14 (12 por defecto) |
| `RATE_LIMIT_ENABLED` | No | Activa/desactiva límites |
| `RATE_LIMIT_AUTH_MAX` | No | Solicitudes de registro por ventana (10) |
| `RATE_LIMIT_GLOBAL_MAX` | No | Solicitudes globales por ventana |
| `SEED_*_PASSWORD` | No | Contraseñas de usuarios demo |

Límites de autenticación por IP y ventana de 15 minutos: login 20 fallos,
registro 10 solicitudes, forgot-password 5 solicitudes.

### Correo en desarrollo

Compose levanta Mailpit y apunta el backend a `smtp://mailpit:1025`; la bandeja
está en <http://127.0.0.1:8025>. No se publica el puerto SMTP al host. En
producción, Mailpit no existe.

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
- Mailpit: http://127.0.0.1:8025

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
- [ ] `FRONTEND_URL` con el origen real (para el enlace de reset).
- [ ] `TRUST_PROXY` medido y ajustado al número de saltos; no asumirlo.
- [ ] `LOG_FORWARDED_FOR=false` en operación normal (activarlo solo para medir).
- [ ] `JWT_SECRET` y credenciales SMTP fuera del repositorio.
- [ ] SMTP configurado (o restablecimiento asumido como inoperante).
- [ ] Contraseña de base robusta y usuario sin privilegios de superusuario.
- [ ] Respaldo antes de aplicar `002_roles.sql` (elimina `users.role`).
- [ ] Respaldos automáticos y prueba de restauración.
- [ ] Rate limiting con almacén compartido si hay varias instancias.
- [ ] Logs centralizados y alertas de errores 5xx.
- [ ] Migraciones ejecutadas antes de habilitar tráfico.
- [ ] Seed deshabilitado (solo se ejecuta con `ALLOW_SEED=true`).

### Medir los saltos de proxy

El límite por IP necesita la IP real del cliente. No se fijó `TRUST_PROXY` en
producción porque la cadena Vercel → Cloudflare → Render → Node no se ha medido.

1. Pon `LOG_FORWARDED_FOR=true` y redespliega.
2. Desde una IP conocida, haz una petición al backend (por ejemplo,
   `/auth/login`).
3. Mira el log: `xff="cliente, proxy1, proxy2, ..."`. Cuenta cuántos proxies hay
   **a la derecha** de la IP conocida; ese es el número de saltos de confianza.
4. Ajusta `TRUST_PROXY` a ese número y vuelve a poner
   `LOG_FORWARDED_FOR=false`.

Acceder directamente al dominio `*.onrender.com` puede tener un número de saltos
distinto al de acceder por Vercel. Mide la ruta que usan los usuarios. El límite
por IP es “best effort”; el control principal es el bloqueo por cuenta.

### Restablecimiento en producción

Render Free bloquea los puertos SMTP salientes. Sin un proveedor con API HTTPS o
un plan que permita SMTP, `POST /auth/forgot-password` responderá `202` pero no
enviará correo. El login, el bloqueo y el cambio de contraseña siguen
funcionando. Está documentado como limitación, no como fallo silencioso.

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
- El login devuelve el mismo `401` para correo inexistente y clave incorrecta.
- Logout invalida la cookie (`/auth/me` devuelve `401`).
- La migración `002_roles.sql` se aplicó y `users.role` ya no existe.
- `LOG_FORWARDED_FOR` está apagado y no se registran tokens ni contraseñas.
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
| Todos los usuarios pierden la sesión tras desplegar | JWT antiguos sin `jti` | Esperado; vuelve a iniciar sesión |
| No llega el correo de reset | SMTP vacío o bloqueado | Configura SMTP; Render Free bloquea puertos SMTP |
| Todos los intentos comparten IP | `TRUST_PROXY` mal ajustado | Mide con `LOG_FORWARDED_FOR` y ajusta el número de saltos |
| `users.role does not exist` | Código viejo contra esquema nuevo | Despliega el código de esta rama junto con las migraciones |
