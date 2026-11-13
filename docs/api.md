# Referencia de la API

Base URL local: `http://localhost:3000/api/v1` (sin Docker: puerto `3000`;
con Docker: `http://localhost:3001/api/v1`).

Todas las respuestas son JSON. Las rutas protegidas usan la cookie de sesión;
el navegador la envía automáticamente. Para pruebas manuales con `curl` se
puede guardar con `-c cookies.txt` y reutilizar con `-b cookies.txt`.

## Formato de respuesta

Recurso individual:

```json
{ "data": { "id": "..." } }
```

Listado paginado:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos",
    "details": [{ "path": "email", "message": "Invalid email address" }]
  }
}
```

## Autenticación

### `POST /auth/register`

Crea una cuenta con rol `estudiante`. No acepta `role` ni campos desconocidos.

Solicitud:

```json
{
  "name": "Ana Pérez",
  "email": "ana@ejemplo.com",
  "password": "Password123!"
}
```

Respuesta `201`:

```json
{
  "data": {
    "id": "6f4a2c1e-...",
    "name": "Ana Pérez",
    "email": "ana@ejemplo.com",
    "role": "estudiante",
    "is_active": true,
    "created_at": "2026-11-13T17:00:00.000Z",
    "updated_at": "2026-11-13T17:00:00.000Z"
  }
}
```

Reglas:

- `name`: 2–80 caracteres.
- `email`: válido, máximo 120, se normaliza a minúsculas.
- `password`: 10–72 caracteres.
- Correo duplicado → `409 EMAIL_IN_USE`.
- Rol inyectado o campo extra → `400 VALIDATION_ERROR`.

### `POST /auth/login`

```json
{
  "email": "estudiante@demo.com",
  "password": "Demo12345!"
}
```

Respuesta `200` con `{ "data": { ...usuario... } }` y cabecera
`Set-Cookie: sr_token=...; HttpOnly; SameSite=Strict; Path=/`.

Credenciales inválidas o usuario inactivo → `401 INVALID_CREDENTIALS` con el
mensaje genérico “Correo o contraseña incorrectos”.

### `POST /auth/logout`

Elimina la cookie. Respuesta `204` sin cuerpo.

### `GET /auth/me`

Devuelve el usuario de la sesión. Requiere cookie válida.

```bash
curl -b cookies.txt http://localhost:3000/api/v1/auth/me
```

## Tareas

Todas las rutas requieren autenticación.

### `GET /tasks`

Parámetros de consulta:

| Parámetro | Valores | Por defecto |
| --- | --- | --- |
| `page` | entero ≥ 1 | `1` |
| `limit` | entero 1–100 | `20` |
| `status` | `pendiente`, `en_progreso`, `completada`, `cancelada` | todos |
| `q` | texto de búsqueda en título/descripción | — |
| `sort` | `created_at`, `updated_at`, `title`, `status` | `created_at` |
| `order` | `asc`, `desc` | `desc` |

Visibilidad:

- Estudiante: solo sus tareas.
- Docente: todas.
- Administrador: todas.

```bash
curl -b cookies.txt \
  "http://localhost:3000/api/v1/tasks?status=pendiente&limit=10&page=1"
```

### `POST /tasks`

```json
{
  "title": "Entregar informe",
  "description": "Subirlo antes del viernes",
  "status": "pendiente"
}
```

- `title`: obligatorio, 1–120 caracteres.
- `description`: opcional, hasta 2000 caracteres; por defecto `""`.
- `status`: opcional, por defecto `pendiente`.
- `owner_id` no se acepta: se toma de la sesión.

Respuesta `201` con la tarea creada.

### `GET /tasks/:id`

Devuelve la tarea si el usuario es dueño, docente o administrador. En caso
contrario responde `404 TASK_NOT_FOUND`.

### `PATCH /tasks/:id`

Actualiza uno o más campos. Debe enviarse al menos uno.

```json
{
  "title": "Informe final",
  "status": "completada"
}
```

Permitido para el dueño o un administrador. Un docente puede leer tareas ajenas
pero no editarlas. Respuesta `200` con la tarea actualizada.

### `DELETE /tasks/:id`

Permitido para el dueño o un administrador. Respuesta `204`.

## Usuarios (solo administrador)

### `GET /users`

| Parámetro | Descripción |
| --- | --- |
| `email` | búsqueda parcial por correo (ILIKE) |
| `page` | página, por defecto `1` |
| `limit` | 1–100, por defecto `20` |

```bash
curl -b cookies.txt \
  "http://localhost:3000/api/v1/users?email=ana&page=1&limit=20"
```

### `PATCH /users/:id/role`

```json
{ "role": "docente" }
```

Valores permitidos: `estudiante`, `docente`, `administrador`.

- Un administrador no puede quitarse su propio rol →
  `400 CANNOT_DEMOTE_SELF`.
- Usuario inexistente → `404 USER_NOT_FOUND`.
- Cualquier otro rol → `403 FORBIDDEN`.

## Salud y raíz

| Ruta | Descripción |
| --- | --- |
| `GET /` | Nombre y versión de la API |
| `GET /health` | Estado de la API y de PostgreSQL |

`GET /health` responde `200 { "status": "OK", "database": "up" }` o
`503 { "status": "DEGRADED", "database": "down" }`.

## Códigos de error

| Código HTTP | Código interno | Cuándo aparece |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Datos inválidos o campos extra |
| 400 | `INVALID_JSON` | JSON malformado |
| 400 | `CANNOT_DEMOTE_SELF` | Administrador intenta quitarse el rol |
| 401 | `UNAUTHENTICATED` | Falta la cookie |
| 401 | `INVALID_SESSION` | Token inválido, expirado o usuario inactivo |
| 401 | `INVALID_CREDENTIALS` | Login incorrecto |
| 403 | `FORBIDDEN` | Rol sin permiso |
| 403 | `CORS_NOT_ALLOWED` | Origen no permitido |
| 403 | `ORIGIN_NOT_ALLOWED` | `Origin` no permitido en escritura |
| 404 | `TASK_NOT_FOUND` | Tarea inexistente o ajena |
| 404 | `USER_NOT_FOUND` | Usuario inexistente |
| 404 | `NOT_FOUND` | Ruta inexistente |
| 409 | `EMAIL_IN_USE` | Correo ya registrado |
| 413 | `PAYLOAD_TOO_LARGE` | Cuerpo mayor a 10 kb |
| 429 | `RATE_LIMITED` | Demasiadas solicitudes |

## Ejemplo completo con curl

```bash
BASE=http://localhost:3000/api/v1

# Registro
curl -s -X POST "$BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Pérez","email":"ana@ejemplo.com","password":"Password123!"}'

# Login y guardado de cookie
curl -s -c cookies.txt -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@ejemplo.com","password":"Password123!"}'

# Crear tarea
curl -s -b cookies.txt -X POST "$BASE/tasks" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Mi primera tarea","status":"pendiente"}'

# Listar tareas
curl -s -b cookies.txt "$BASE/tasks"

# Cerrar sesión
curl -s -b cookies.txt -X POST "$BASE/auth/logout"
```
