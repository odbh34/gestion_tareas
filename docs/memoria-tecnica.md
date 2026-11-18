# Memoria técnica

## 1. Datos generales

| Campo | Valor |
| --- | --- |
| Proyecto | SportReserve Tasks |
| Tipo | API web de gestión de tareas con interfaz React |
| Asignatura | Ingeniería de Software |
| Integrantes | _(completar con los 3 nombres)_ |
| Repositorio | _(completar con la URL de GitHub)_ |
| Versión | 1.0.0 |
| Fecha | Noviembre de 2026 |

## 2. Resumen

SportReserve Tasks es una aplicación web que permite registrar usuarios,
iniciar sesión y gestionar tareas académicas. Cada tarea tiene título,
descripción, estado y dueño. El sistema aplica tres roles con permisos
diferenciados y protege el acceso a los datos tanto en el servidor como en la
interfaz.

El backend se implementó con Node.js 22 y Express 5 sobre PostgreSQL 17. El
frontend usa React 19 y Vite. La autenticación se basa en un JWT transportado
en una cookie `HttpOnly`, y las contraseñas se almacenan con bcrypt. La solución
incluye pruebas automatizadas, integración continua, Docker opcional y esta
documentación.

## 3. Planteamiento del problema

Un equipo académico necesita organizar tareas y distinguir responsabilidades
entre estudiantes, docentes y administradores. Una lista compartida sin control
de acceso permitiría que cualquier usuario leyera o modificara tareas ajenas.
Además, un backend que confíe únicamente en la interfaz puede ser atacado
manipulando solicitudes HTTP.

Por ello, el proyecto debe:

1. Autenticar usuarios y mantener sesiones seguras.
2. Restringir cada operación según el rol y la propiedad del recurso.
3. Validar y parametrizar todas las entradas.
4. Ofrecer una interfaz clara en español.
5. Demostrar la calidad mediante pruebas automatizadas y documentación.

## 4. Objetivos

### Objetivo general

Construir una API web segura de gestión de tareas, con interfaz web, roles,
pruebas automatizadas y documentación suficiente para que un equipo de tres
personas pueda mantenerla y evolucionarla.

### Objetivos específicos

- Implementar registro, login, logout y consulta de sesión.
- Implementar CRUD de tareas con dueño asignado desde la sesión.
- Aplicar reglas de acceso para estudiante, docente y administrador.
- Validar entradas y prevenir inyección SQL, XSS, IDOR y mass assignment.
- Automatizar pruebas de API, seguridad e interfaz.
- Facilitar la ejecución local y con Docker.
- Definir un flujo de trabajo Git y un reparto de tareas por integrante.

## 5. Alcance

### Incluido

- Autenticación con correo y contraseña.
- Sesiones por dispositivo con revocación y rotación.
- Bloqueo progresivo por cuenta y límites por IP.
- Restablecimiento de contraseña por correo con token de un solo uso.
- Cambio de contraseña autenticado.
- Auditoría de eventos de autenticación.
- Gestión de tareas propias.
- Lectura global para docentes y administradores.
- CRUD global para administradores.
- Administración de usuarios: crear con contraseña temporal, editar nombre y
  correo, cambiar roles y activar/desactivar (sin eliminación física).
- Búsqueda, filtro, orden y paginación.
- Pruebas automatizadas y CI.
- Docker Compose opcional.

### Excluido de esta versión

- Verificación de correo electrónico.
- Adjuntos o comentarios en tareas.
- Notificaciones en tiempo real.
- Multi-tenant o múltiples organizaciones.
- Auditoría detallada de cambios de tareas.
- Aplicación móvil nativa.

## 6. Arquitectura

```text
Navegador
   │  HTTPS / cookies
   ▼
Frontend React (Vite en desarrollo, Nginx en producción)
   │  /api/v1
   ▼
API Express 5
   ├── middlewares: helmet, CORS, rate limit, cookies, validación
   ├── módulos: auth, users, tasks
   └── pool pg (SQL parametrizado)
          │
          ▼
     PostgreSQL 17
```

### Capas del backend

| Capa | Responsabilidad |
| --- | --- |
| `config` | Variables de entorno validadas y pool de conexiones |
| `middleware` | Autenticación, autorización, validación, límites y errores |
| `modules/*/routes` | Definición de endpoints y composición de middlewares |
| `modules/*/schemas` | Validación estricta con Zod |
| `modules/*/service` | Reglas de negocio y acceso a datos |
| `db` | Migraciones, seed y creación de la base de pruebas |
| `utils` | JWT, bcrypt, errores y utilidades |

La separación routes → schemas → service evita duplicar reglas y permite probar
la API completa con Supertest sin levantar un servidor externo.

### Frontend

| Elemento | Responsabilidad |
| --- | --- |
| `api/client.js` | Cliente `fetch` con cookies y manejo uniforme de errores |
| `context/AuthProvider.jsx` | Estado de sesión y operaciones de autenticación |
| `hooks/useAuth.js` | Acceso al contexto de autenticación |
| `components/ProtectedRoute.jsx` | Protección de rutas por sesión y rol |
| `pages/TasksPage.jsx` | CRUD, filtros, búsqueda y paginación |
| `pages/AdminUsersPage.jsx` | Crear, editar, cambiar rol y activar/desactivar usuarios |

## 7. Modelo de datos

### Tabla `roles`

| Columna | Tipo | Restricción |
| --- | --- | --- |
| `id` | SMALLINT | PK |
| `name` | TEXT | único, minúsculas, 3–30 caracteres |
| `description` | TEXT | descripción del rol |

Catálogo: `estudiante` (1), `docente` (2), `administrador` (3).

### Tabla `users`

| Columna | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK, `gen_random_uuid()` |
| `name` | TEXT | 2–80 caracteres |
| `email` | TEXT | único, minúsculas |
| `password_hash` | TEXT | bcrypt |
| `role_id` | SMALLINT | FK a `roles.id`, `ON DELETE RESTRICT` |
| `is_active` | BOOLEAN | por defecto `true` |
| `failed_attempts` | INTEGER | por defecto 0, `>= 0` |
| `locked_until` | TIMESTAMPTZ | `NULL` si no está bloqueada |
| `created_at` | TIMESTAMPTZ | por defecto `now()` |
| `updated_at` | TIMESTAMPTZ | por defecto `now()` |

### Tabla `tasks`

| Columna | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `title` | TEXT | 1–120 caracteres |
| `description` | TEXT | hasta 2000 caracteres |
| `status` | TEXT | `pendiente`, `en_progreso`, `completada`, `cancelada` |
| `owner_id` | UUID | FK a `users.id`, `ON DELETE CASCADE` |
| `created_at` | TIMESTAMPTZ | por defecto `now()` |
| `updated_at` | TIMESTAMPTZ | por defecto `now()` |

### Tabla `sessions`

| Columna | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK, `gen_random_uuid()` |
| `user_id` | UUID | FK a `users.id`, `ON DELETE CASCADE` |
| `created_at` | TIMESTAMPTZ | por defecto `now()` |
| `expires_at` | TIMESTAMPTZ | obligatorio |
| `revoked_at` | TIMESTAMPTZ | `NULL` mientras está activa |

### Tabla `password_reset_tokens`

| Columna | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK |
| `user_id` | UUID | FK a `users.id`, `ON DELETE CASCADE` |
| `token_hash` | TEXT | único (SHA-256 hexadecimal) |
| `expires_at` | TIMESTAMPTZ | obligatorio |
| `used_at` | TIMESTAMPTZ | `NULL` mientras no se use |
| `created_at` | TIMESTAMPTZ | por defecto `now()` |

### Tabla `auth_events`

| Columna | Tipo | Restricción |
| --- | --- | --- |
| `id` | BIGINT | identidad |
| `user_id` | UUID | FK a `users.id`, `ON DELETE SET NULL`, nullable |
| `event_type` | TEXT | lista cerrada con `CHECK` |
| `ip` | TEXT | hasta 64 caracteres |
| `created_at` | TIMESTAMPTZ | por defecto `now()` |

Índices: `users(email)`, `users(role_id)`, `users(created_at)`,
`tasks(owner_id)`, `tasks(status)`, `tasks(created_at)`, `sessions(user_id)`,
`password_reset_tokens(user_id)`, `auth_events(user_id, created_at)` y
`auth_events(event_type, created_at)`.

### Migraciones

- `001_initial.sql`: esquema inicial.
- `002_roles.sql`: catálogo `roles`, `users.role_id` y eliminación de
  `users.role`.
- `003_auth_security.sql`: bloqueo, sesiones, tokens de reset y auditoría.

El script `backend/src/db/migrate.js` registra cada archivo en
`schema_migrations` con un checksum SHA-256; si un archivo ya aplicado cambia,
la migración falla y obliga a crear una nueva. Las migraciones se ejecutan
automáticamente al iniciar el contenedor del backend.

## 8. Autenticación y sesión

### Registro

1. El usuario se registra con nombre, correo y contraseña.
2. El servidor normaliza el nombre (espacios) y el correo (minúsculas), valida
   sus formatos con Zod y verifica que el correo no exista.
3. La contraseña se valida: 10 caracteres mínimo, 72 bytes UTF-8 máximo,
   mayúscula, minúscula, número y símbolo; se rechazan contraseñas comunes,
   secuencias simples y contraseñas que incluyan el nombre o el correo. Después
   se cifra con bcrypt (12 rondas por defecto).
4. El registro siempre asigna el rol `estudiante` mediante `role_id`.
5. Se registra el evento `register` con la IP, sin correo.

La validación del correo es solo de formato. No se comprueba la existencia del
dominio ni la propiedad de la dirección; eso exigiría un correo de confirmación
con token y queda fuera del alcance actual.

### Login y bloqueo

1. Se busca el usuario por correo. Si no existe, se compara igualmente contra un
   hash ficticio para que el tiempo no revele si la cuenta existe.
2. Correo inexistente, contraseña incorrecta, cuenta inactiva o bloqueada
   devuelven el mismo `401 INVALID_CREDENTIALS`.
3. Si la cuenta está bloqueada, no se incrementa el contador ni se prolonga el
   bloqueo.
4. Si la contraseña es incorrecta, un `UPDATE` atómico incrementa
   `failed_attempts`. Al llegar a 5 fallos se calcula `locked_until` con
   `min(60 · 2^(n − 5), 900)` segundos.
5. Un login correcto reinicia el contador y crea una sesión nueva.
6. Si la petición traía una sesión válida del mismo usuario, se revoca antes de
   crear la nueva (rotación).
7. El JWT HS256 incluye `sub`, `jti`, `iss`, `aud`, `exp` y algoritmo fijado.
   `jti` es el id de la fila de `sessions`.
8. La cookie es `HttpOnly`, `SameSite=Strict`, `Path=/` y `Secure` según el
   entorno.

### Peticiones autenticadas

El middleware verifica la firma y el `exp` del JWT, exige `jti` y consulta:

```sql
SELECT ... FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.id = $1 AND s.user_id = $2
  AND s.revoked_at IS NULL
  AND s.expires_at > now()
  AND u.is_active;
```

La caducidad se evalúa con el reloj de PostgreSQL. Un token revocado, vencido,
sin `jti` o de un usuario inactivo devuelve `401 INVALID_SESSION`.

### Logout, cambio y restablecimiento

- **Logout**: revoca la sesión y limpia la cookie; siempre responde `204`.
- **Cambio de contraseña**: exige la contraseña actual, actualiza el hash, revoca
  todas las sesiones y emite una nueva cookie.
- **Restablecimiento**: token aleatorio de 32 bytes, guardado solo como SHA-256,
  de un solo uso y con caducidad. El enlace viaja en el fragmento de la URL. El
  éxito cambia la contraseña, anula los tokens pendientes, revoca todas las
  sesiones y desbloquea la cuenta.

El frontend nunca lee el token: solo envía la cookie con
`credentials: 'include'`. Esto reduce el riesgo de robo de tokens mediante
JavaScript.

## 9. Control de acceso

| Operación | Regla |
| --- | --- |
| Listar tareas | Estudiante: solo `owner_id = user.id`. Docente y administrador: todas. |
| Leer tarea | Dueño, docente o administrador. |
| Crear tarea | Cualquier usuario autenticado; el dueño se toma de la sesión. |
| Editar/eliminar | Dueño o administrador. Docente no edita tareas ajenas. |
| Listar usuarios | Solo administrador. |
| Crear usuarios | Solo administrador; fija una contraseña temporal y un rol. |
| Editar nombre/correo | Solo administrador; `password` y `role` se rechazan aquí. |
| Cambiar rol | Solo administrador; no puede degradarse a sí mismo. |
| Activar/desactivar | Solo administrador; desactivar revoca las sesiones y no elimina la cuenta. No puede desactivarse a sí mismo. |
| Cambiar contraseña de otro usuario | No disponible para el administrador; solo el propio usuario vía `/auth/change-password` o `/auth/forgot-password`. |

Cuando un usuario no puede ver o modificar una tarea, la API responde `404`
en lugar de `403` para no revelar la existencia del recurso.

## 10. Seguridad

### Medidas implementadas

| Amenaza | Mitigación |
| --- | --- |
| Inyección SQL | Consultas parametrizadas y columnas de ordenamiento en lista blanca |
| XSS | React escapa por defecto; no se usa `dangerouslySetInnerHTML`; CSP en backend y Nginx |
| IDOR | Verificación de propiedad en lectura, edición y borrado |
| Mass assignment | Esquemas Zod `.strict()`; el rol y el dueño no se aceptan del cliente |
| Fuerza bruta | Bloqueo progresivo por cuenta (60–900 s) + límites por IP (login 20, registro 10, forgot 5) |
| CSRF | `SameSite=Strict`, CORS con lista blanca y validación de `Origin` |
| Clickjacking | `X-Frame-Options: DENY` y `frame-ancestors 'none'` |
| Fijación de sesión | `jti` por dispositivo, rotación al reautenticarse y revocación en logout |
| Reutilización de tokens | Token de reset de un solo uso, solo SHA-256, caducidad y anulación de pendientes |
| Enumeración de usuarios | Mensaje genérico y hash ficticio en login; `404` en recursos ajenos. El registro conserva `409` como compromiso |
| Escalada de privilegios | Rol asignado en servidor; cambio de rol solo por administrador |
| Fuga de información | `x-powered-by` deshabilitado; errores internos no expuestos |
| Cacheo de respuestas | `Cache-Control: no-store` en `/api`; rewrite de Vercel sin caché |

### Decisiones y compensaciones

- **JWT en cookie en lugar de `localStorage`**: evita el acceso desde
  JavaScript, a costa de requerir protección CSRF, cubierta con `SameSite` y
  validación de `Origin`.
- **Sesión consulta la base en cada solicitud**: permite revocar y expirar
  sesiones de inmediato; tiene un costo adicional por petición aceptable para
  este alcance.
- **Sesiones por dispositivo**: cada login genera una fila y un `jti`; el logout
  revoca solo ese dispositivo, mientras que el cambio y el restablecimiento
  revocan todas.
- **Bloqueo en base + rate limit en memoria**: el bloqueo por cuenta persiste y
  es la protección principal; el límite por IP es “best effort” y depende del
  proxy.
- **Token de reset hasheado**: la base no puede reconstruir el enlace; si se
  pierde el correo, hay que solicitar otro.
- **`404` en lugar de `403` para tareas ajenas**: prioriza la confidencialidad
  sobre la explicitud del error.

### Limitaciones conocidas

- El rate limit por IP usa memoria del proceso; con varias instancias hace falta
  un almacén compartido (Redis). El bloqueo por cuenta sí está en PostgreSQL.
- `TRUST_PROXY` en producción (Cloudflare/Render) no se asumió: hay que medir los
  saltos con `LOG_FORWARDED_FOR` antes de ajustarlo. Mientras tanto, el límite
  por IP puede compartir la IP del proxy.
- Sin SMTP configurado, el restablecimiento no envía correo. Render Free bloquea
  los puertos SMTP; se necesita un proveedor con API HTTPS o un plan superior.
- El registro revela si un correo existe (`409 EMAIL_IN_USE`), por compatibilidad
  con el cliente y las pruebas existentes.
- No hay verificación de correo electrónico.
- Para producción real se requiere HTTPS, `COOKIE_SECURE=true` y secretos
  gestionados fuera del repositorio.

## 11. API

La API se expone bajo `/api/v1`. La referencia completa, con ejemplos de
solicitud y respuesta, está en [`api.md`](api.md).

Resumen:

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/auth/register` | Público |
| POST | `/auth/login` | Público |
| POST | `/auth/logout` | Público (idempotente) |
| POST | `/auth/change-password` | Autenticado |
| POST | `/auth/forgot-password` | Público |
| POST | `/auth/reset-password` | Público con token |
| GET | `/auth/me` | Autenticado |
| GET | `/tasks` | Autenticado (filtrado por rol) |
| POST | `/tasks` | Autenticado |
| GET | `/tasks/:id` | Dueño, docente o administrador |
| PATCH | `/tasks/:id` | Dueño o administrador |
| DELETE | `/tasks/:id` | Dueño o administrador |
| GET | `/users` | Administrador |
| POST | `/users` | Administrador (contraseña temporal) |
| PATCH | `/users/:id` | Administrador (nombre y correo) |
| PATCH | `/users/:id/role` | Administrador |
| PATCH | `/users/:id/status` | Administrador (activar/desactivar) |

Formato de error uniforme:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos",
    "details": [{ "path": "email", "message": "Invalid email address" }]
  }
}
```

## 12. Pruebas

Se implementaron 66 pruebas de backend (9 archivos) y 26 de frontend (7 archivos). Las pruebas
de backend se ejecutan contra una base PostgreSQL real (`sportreserve_test`) y
cubren:

- Registro, login, logout, sesión y usuarios inactivos.
- CRUD, filtros, paginación y validación.
- IDOR, RBAC, mass assignment, SQLi y XSS.
- Cabeceras de seguridad, CORS y manejo de errores.
- Límite de tamaño de solicitudes.
- Parseo numérico de `TRUST_PROXY`.
- Gestión administrativa de usuarios: crear, editar nombre y correo, cambiar
  rol y activar/desactivar, con verificación de que no existe cambio de
  contraseña ni envío de enlaces desde administración.

Los flujos nuevos de seguridad (mensaje genérico, fuerza bruta, reutilización de
token y sesión expirada, R5) también están cubiertos por pruebas automáticas. El
detalle manual y los comandos están en [`evidencia-auth.md`](evidencia-auth.md) y
la trazabilidad en [`matriz-cumplimiento-1-2.md`](matriz-cumplimiento-1-2.md).

El frontend prueba que React renderiza contenido peligroso como texto, que las
acciones solo aparecen cuando el usuario puede editar y el flujo completo de
administración de usuarios.

El detalle está en [`pruebas.md`](pruebas.md).

## 13. Integración continua

`.github/workflows/ci.yml` define tres trabajos:

1. **Backend**: PostgreSQL 17 como servicio, lint y pruebas.
2. **Frontend**: lint, pruebas y build de producción.
3. **Docker**: construcción de ambas imágenes.

La CI se ejecuta en cada push a `main` o `develop` y en cada Pull Request.

## 14. Despliegue

La guía completa está en [`despliegue.md`](despliegue.md). Resumen:

- **Desarrollo local**: PostgreSQL + `npm run dev` en backend y frontend.
- **Docker local**: `docker compose up --build`, con Mailpit para correo.
- **Producción**: backend con `NODE_ENV=production`, HTTPS, cookie segura,
  base gestionada, secretos externos y Nginx como proxy inverso.
- **Demo gratuita**: Neon (PostgreSQL) + Render (backend) + Vercel (frontend con
  rewrite `/api`), detallada en [`despliegue-gratuito.md`](despliegue-gratuito.md).

Antes de desplegar esta versión hay que tener en cuenta:

- La migración `002_roles.sql` elimina `users.role`; conviene un respaldo previo.
- Las sesiones existentes quedan inválidas al cambiar a JWT con `jti`.
- `TRUST_PROXY` debe medirse con `LOG_FORWARDED_FOR`; no se fijó un valor de
  producción a ciegas.
- Sin SMTP real, el restablecimiento no envía correo en producción.

## 15. Trabajo en equipo

El proyecto se dividió en tres frentes compatibles entre sí:

- **Integrante A**: backend, base de datos y seguridad.
- **Integrante B**: frontend, experiencia de usuario y accesibilidad.
- **Integrante C**: pruebas, CI, Docker y documentación.

Las tareas tienen dependencias y criterios de aceptación en
[`equipo-y-tareas.md`](equipo-y-tareas.md). El flujo Git se basa en `main`,
`develop`, ramas `feature/*` y Pull Requests revisados.

## 16. Conclusiones

La aplicación cumple el alcance funcional solicitado y agrega controles de
seguridad verificables: roles normalizados, sesiones revocables por dispositivo,
bloqueo progresivo, restablecimiento con token de un solo uso y auditoría. La
separación por módulos, la validación estricta y el uso de consultas
parametrizadas facilitan el mantenimiento. La documentación y la CI permiten que
los tres integrantes trabajen en paralelo con un criterio común de calidad.

Como siguiente etapa se recomienda agregar las pruebas automatizadas de R5,
configurar un proveedor de correo con API HTTPS para producción, medir los saltos
reales de proxy y añadir un almacén compartido para rate limiting si se ejecutan
varias instancias.
