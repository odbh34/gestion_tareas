# Referencia de la API

Base URL local: `http://localhost:3000/api/v1` (sin Docker: puerto `3000`;
con Docker: `http://localhost:3001/api/v1`).

Todas las respuestas son JSON. Las rutas protegidas usan la cookie de sesión;
el navegador la envía automáticamente. Para pruebas manuales con `curl` se
puede guardar con `-c cookies.txt` y reutilizar con `-b cookies.txt`.

La cookie `sr_token` contiene un JWT con `sub` (usuario) y `jti` (sesión). Cada
petición protegida valida la firma y consulta `sessions`; por eso un logout o un
cambio de contraseña invalidan la cookie de inmediato, aunque el JWT no haya
caducado.

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

- `name`: 2–80 caracteres, solo letras (incluye acentos), espacios, guiones,
  apóstrofos y puntos. Se colapsan los espacios repetidos.
- `email`: formato estricto, máximo 120, se normaliza a minúsculas. Se rechazan
  puntos consecutivos, guiones al inicio/final del dominio y TLD no alfabético.
- `password`: 10 caracteres mínimo, 72 bytes UTF-8 máximo, con mayúscula,
  minúscula, número y símbolo. No puede ser común, una secuencia simple ni
  contener el nombre o la parte local del correo.
- Correo duplicado → `409 EMAIL_IN_USE`.
- Rol inyectado o campo extra → `400 VALIDATION_ERROR`.

> La validación del correo es solo de **formato**: no comprueba que el dominio
> exista ni que el usuario sea dueño de la dirección. `texto@texto.text` se
> acepta. La verificación de propiedad requiere un correo de confirmación y
> queda como mejora futura.

> El registro mantiene `409 EMAIL_IN_USE` por compatibilidad; por tanto, permite
> saber si un correo ya está registrado. Es un compromiso documentado.

### `POST /auth/login`

```json
{
  "email": "estudiante@demo.com",
  "password": "Demo12345!"
}
```

Respuesta `200` con `{ "data": { ...usuario... } }` y cabecera
`Set-Cookie: sr_token=...; HttpOnly; SameSite=Strict; Path=/` (más `Secure` en
producción).

Cada login crea una sesión nueva. Si la petición ya traía una sesión válida del
mismo usuario, la anterior se revoca antes de crear la nueva.

Credenciales inválidas, usuario inactivo o cuenta bloqueada → `401
INVALID_CREDENTIALS` con el mensaje genérico “Correo o contraseña incorrectos”.
El tiempo de respuesta se mantiene comparable aunque el correo no exista.

### Bloqueo por cuenta

Tras 5 fallos, la cuenta queda bloqueada 60 segundos. Cada fallo posterior,
cuando el bloqueo vence, duplica la duración: 120, 240, 480 y 900 segundos como
máximo. Mientras está bloqueada no se incrementa el contador. Un login correcto
lo reinicia.

### `POST /auth/logout`

Revoca la sesión de la cookie y la elimina. Es idempotente: siempre responde
`204`, aunque falte la cookie o el token sea inválido.

### `POST /auth/change-password`

Requiere sesión. Cuerpo:

```json
{
  "currentPassword": "Password123!",
  "newPassword": "NuevaClave456!"
}
```

- `currentPassword` incorrecta → `400 INVALID_CURRENT_PASSWORD`.
- Nueva igual a la actual → `400 SAME_PASSWORD`.
- Nueva fuera de 10 caracteres / 72 bytes → `400 VALIDATION_ERROR`.
- Éxito → `200`, nueva cookie y revocación de **todas** las sesiones anteriores.
- Aplica el limitador de login (20 fallos por IP cada 15 minutos).

### `POST /auth/forgot-password`

Cuerpo: `{ "email": "ana@ejemplo.com" }`. Responde siempre `202` con el mismo
cuerpo, exista o no el correo:

```json
{
  "data": {
    "message": "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña"
  }
}
```

Limitador: 5 solicitudes por IP cada 15 minutos. En desarrollo el correo se ve en
Mailpit (`http://127.0.0.1:8025`); sin SMTP configurado no se envía nada.

### `POST /auth/reset-password`

Cuerpo:

```json
{
  "token": "<token del enlace>",
  "newPassword": "NuevaClave456!"
}
```

El enlace recibido tiene la forma `FRONTEND_URL/restablecer#token=<token>`. El
token es de un solo uso, caduca en `RESET_TOKEN_TTL_MINUTES` (15 por defecto) y
solo se guarda su SHA-256.

- Token inválido, usado, vencido o de cuenta inactiva →
  `400 INVALID_RESET_TOKEN`.
- Éxito → `200`, contraseña actualizada, cuentas desbloqueada y todas las
  sesiones revocadas. No inicia sesión automáticamente.

### `GET /auth/me`

Devuelve el usuario de la sesión. Requiere cookie válida y una fila de `sessions`
no revocada ni vencida.

```bash
curl -b cookies.txt http://localhost:3000/api/v1/auth/me
```

Una cookie revocada, vencida o sin `jti` responde `401 INVALID_SESSION`.

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

### `POST /users`

Crea una cuenta con contraseña temporal. Solo administrador.

```json
{
  "name": "Ana Pérez",
  "email": "ana@ejemplo.com",
  "password": "ClaveTemporal123!",
  "role": "docente"
}
```

- `name`: obligatorio, 2–80 caracteres; solo letras (incluidos acentos y `ñ`),
  espacios, apóstrofos y guiones.
- `email`: obligatorio, con formato válido y TLD real reconocido; se rechazan
  dominios inventados como `ejemplo@correo.correo`. Se normaliza a minúsculas y
  debe ser único.
- `password`: obligatoria, entre 10 caracteres y 72 bytes UTF-8, con al menos
  una mayúscula, una minúscula, un número y un símbolo. Se exige fortaleza
  porque es la credencial inicial de la cuenta.
- `role`: opcional, por defecto `estudiante`; valores permitidos más abajo.

Respuesta `201` con el usuario creado (sin `password_hash`). Correo duplicado →
`409 EMAIL_IN_USE`. Cualquier campo fuera de estas reglas → `400
VALIDATION_ERROR` con el detalle por campo.

> La contraseña se define únicamente al crear la cuenta. No hay ninguna ruta
> administrativa para cambiar la contraseña de otro usuario ni para enviar
> enlaces de restablecimiento: esas acciones pertenecen solo al flujo propio del
> usuario (`/auth/change-password` y `/auth/forgot-password`).

### `PATCH /users/:id`

Edita `name` y/o `email` de un usuario. Solo administrador.

```json
{ "name": "Ana Pérez", "email": "ana@ejemplo.com" }
```

Se debe enviar al menos uno de los dos campos, con las mismas reglas de formato
que en `POST /users`. Respuesta `200` con el usuario actualizado. Correo
duplicado → `409 EMAIL_IN_USE`. Cualquier otro campo (incluido `password` o
`role`) → `400 VALIDATION_ERROR`. Usuario inexistente →
`404 USER_NOT_FOUND`.

### `PATCH /users/:id/status`

Activa o desactiva una cuenta. Solo administrador.

```json
{ "is_active": false }
```

Respuesta `200` con el usuario actualizado. Al desactivar se revocan todas sus
sesiones; al reactivar vuelve a poder iniciar sesión. No se elimina ningún
usuario, para conservar sus tareas. Un administrador no puede desactivar su
propia cuenta → `400 CANNOT_DEACTIVATE_SELF`. Usuario inexistente →
`404 USER_NOT_FOUND`.

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
| 400 | `CANNOT_DEACTIVATE_SELF` | Administrador intenta desactivar su propia cuenta |
| 400 | `INVALID_CURRENT_PASSWORD` | La contraseña actual no coincide |
| 400 | `SAME_PASSWORD` | La nueva contraseña es igual a la actual |
| 400 | `INVALID_RESET_TOKEN` | Token de restablecimiento inválido, usado o vencido |
| 401 | `UNAUTHENTICATED` | Falta la cookie |
| 401 | `INVALID_SESSION` | Token inválido, sesión revocada/vencida o usuario inactivo |
| 401 | `INVALID_CREDENTIALS` | Login incorrecto o cuenta bloqueada |
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
