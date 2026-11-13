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
- Gestión de tareas propias.
- Lectura global para docentes y administradores.
- CRUD global para administradores.
- Administración de roles.
- Búsqueda, filtro, orden y paginación.
- Pruebas automatizadas y CI.
- Docker Compose opcional.

### Excluido de esta versión

- Recuperación de contraseña por correo.
- Verificación de correo electrónico.
- Adjuntos o comentarios en tareas.
- Notificaciones en tiempo real.
- Multi-tenant o múltiples organizaciones.
- Auditoría detallada de cambios.
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
| `pages/AdminUsersPage.jsx` | Listado de usuarios y cambio de rol |

## 7. Modelo de datos

### Tabla `users`

| Columna | Tipo | Restricción |
| --- | --- | --- |
| `id` | UUID | PK, `gen_random_uuid()` |
| `name` | TEXT | 2–80 caracteres |
| `email` | TEXT | único, minúsculas |
| `password_hash` | TEXT | bcrypt |
| `role` | TEXT | `estudiante`, `docente`, `administrador` |
| `is_active` | BOOLEAN | por defecto `true` |
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

Índices: `users(email)` por la restricción única, `users(role)`,
`users(created_at)`, `tasks(owner_id)`, `tasks(status)` y `tasks(created_at)`.

### Migraciones

`database/migrations/001_initial.sql` crea el esquema. El script
`backend/src/db/migrate.js` registra cada archivo en `schema_migrations` con un
checksum SHA-256; si un archivo ya aplicado cambia, la migración falla y obliga
a crear una nueva. Las migraciones se ejecutan automáticamente al iniciar el
contenedor del backend.

## 8. Autenticación y sesión

1. El usuario se registra con nombre, correo y contraseña.
2. El servidor normaliza el correo y verifica que no exista.
3. La contraseña se cifra con bcrypt (12 rondas por defecto).
4. El registro siempre asigna el rol `estudiante`.
5. En el login se comparan las credenciales y se firma un JWT HS256 con
   `sub`, `iss`, `aud`, expiración y algoritmo fijado.
6. El token se envía en una cookie `HttpOnly`, `SameSite=Strict`, `Path=/` y
   `Secure` según el entorno.
7. En cada solicitud protegida, el middleware verifica el JWT y vuelve a
   consultar al usuario en la base. Si está inactivo o no existe, la sesión se
   invalida.
8. El logout elimina la cookie.

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
| Cambiar rol | Solo administrador; no puede degradarse a sí mismo. |

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
| Fuerza bruta | Rate limit global y límite más estricto en `/auth` |
| CSRF | `SameSite=Strict`, CORS con lista blanca y validación de `Origin` |
| Clickjacking | `X-Frame-Options: DENY` y `frame-ancestors 'none'` |
| Fijación de sesión | JWT firmado con expiración y cookie reemplazada en cada login |
| Enumeración de usuarios | Mensaje genérico en login y `404` en recursos ajenos |
| Escalada de privilegios | Rol asignado en servidor; cambio de rol solo por administrador |
| Fuga de información | `x-powered-by` deshabilitado; errores internos no expuestos |
| Cacheo de respuestas | `Cache-Control: no-store` en `/api`; rewrite de Vercel sin caché |

### Decisiones y compensaciones

- **JWT en cookie en lugar de `localStorage`**: evita el acceso desde
  JavaScript, a costa de requerir protección CSRF, cubierta con `SameSite` y
  validación de `Origin`.
- **Sin ORM**: las consultas son explícitas y parametrizadas; se gana control y
  se pierde comodidad para consultas complejas.
- **Sesión consulta la base en cada solicitud**: permite desactivar usuarios de
  inmediato; tiene un costo adicional por petición aceptable para este alcance.
- **`404` en lugar de `403` para tareas ajenas**: prioriza la confidencialidad
  sobre la explicitud del error.

### Limitaciones conocidas

- No hay verificación de correo ni recuperación de contraseña.
- El rate limit usa memoria del proceso; en varias instancias se necesita un
  almacén compartido (Redis).
- No se implementó rotación de JWT ni lista de revocación.
- La configuración de Docker debe validarse en un entorno con Docker activo y
  con los secretos adecuados.
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
| POST | `/auth/logout` | Público |
| GET | `/auth/me` | Autenticado |
| GET | `/tasks` | Autenticado (filtrado por rol) |
| POST | `/tasks` | Autenticado |
| GET | `/tasks/:id` | Dueño, docente o administrador |
| PATCH | `/tasks/:id` | Dueño o administrador |
| DELETE | `/tasks/:id` | Dueño o administrador |
| GET | `/users` | Administrador |
| PATCH | `/users/:id/role` | Administrador |

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

Se implementaron 39 pruebas de backend y 3 de frontend. Las pruebas de backend
se ejecutan contra una base PostgreSQL real (`sportreserve_test`) y cubren:

- Registro, login, logout, sesión y usuarios inactivos.
- CRUD, filtros, paginación y validación.
- IDOR, RBAC, mass assignment, SQLi y XSS.
- Cabeceras de seguridad, CORS y manejo de errores.
- Límite de tamaño de solicitudes.

El frontend prueba que React renderiza contenido peligroso como texto y que las
acciones solo aparecen cuando el usuario puede editar.

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
- **Docker local**: `docker compose up --build`.
- **Producción**: backend con `NODE_ENV=production`, HTTPS, cookie segura,
  base gestionada, secretos externos y Nginx como proxy inverso.
- **Demo gratuita**: Neon (PostgreSQL) + Render (backend) + Vercel (frontend con
  rewrite `/api`), detallada en [`despliegue-gratuito.md`](despliegue-gratuito.md).

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
seguridad verificables mediante pruebas. La separación por módulos, la
validación estricta y el uso de consultas parametrizadas facilitan el
mantenimiento. La documentación y la CI permiten que los tres integrantes
trabajen en paralelo con un criterio común de calidad.

Como siguiente etapa se recomienda agregar recuperación de contraseña,
verificación de correo, auditoría de cambios y un almacén compartido para rate
limiting antes de un despliegue con múltiples instancias.
