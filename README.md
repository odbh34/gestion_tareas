# SportReserve Tasks

API web de gestión de tareas con autenticación, roles y pruebas automatizadas.
Proyecto pensado para un equipo de 3 integrantes, con Docker opcional: la
aplicación también funciona con Node.js y PostgreSQL instalados localmente.

## Funcionalidades

- Registro e inicio de sesión con contraseñas cifradas (bcrypt).
- Sesión mediante JWT en cookie `HttpOnly`, `SameSite=Strict`.
- CRUD de tareas con título, descripción, estado y dueño.
- Roles **estudiante**, **docente** y **administrador**.
- Búsqueda, filtro por estado, ordenamiento y paginación.
- Administración de usuarios y roles (solo administrador).
- Pruebas de API, seguridad (IDOR, SQLi, XSS, RBAC) e interfaz.
- Docker Compose con PostgreSQL, backend y frontend Nginx.
- Integración continua con GitHub Actions.

## Stack

| Capa | Tecnología |
| --- | --- |
| Backend | Node.js 22 + Express 5 |
| Base de datos | PostgreSQL 17, SQL parametrizado (sin ORM) |
| Frontend | React 19 + Vite 8 |
| Autenticación | JWT + cookie HttpOnly, bcryptjs |
| Validación | Zod |
| Pruebas | Vitest + Supertest + Testing Library |
| Contenedores | Docker + Docker Compose + Nginx |

## Roles y permisos

| Acción | Estudiante | Docente | Administrador |
| --- | --- | --- | --- |
| Crear tareas | Sí | Sí | Sí |
| Ver sus propias tareas | Sí | Sí | Sí |
| Ver tareas de todos | No | Sí | Sí |
| Editar/eliminar sus tareas | Sí | Sí | Sí |
| Editar/eliminar tareas ajenas | No | No | Sí |
| Listar usuarios y cambiar roles | No | No | Sí |

Los registros nuevos siempre se crean con rol `estudiante`. El rol no se acepta
desde el cuerpo de la solicitud.

## Estructura del repositorio

```text
.
├── backend/                 API Express
│   ├── src/
│   │   ├── config/          Variables de entorno y pool de PostgreSQL
│   │   ├── db/              Migraciones, seed y creación de BD de pruebas
│   │   ├── middleware/      Auth, RBAC, validación, rate limit, errores
│   │   ├── modules/         auth, users y tasks
│   │   └── utils/           JWT, contraseñas, errores, asyncHandler
│   └── tests/               Pruebas de API y seguridad
├── database/migrations/     Esquema SQL versionado
├── frontend/                React + Vite
├── docs/                    Memoria técnica y guías
├── compose.yaml             PostgreSQL + backend + frontend
└── .github/                 CI y plantillas de issues/PR
```

## Inicio rápido con Docker

Requisitos: Docker Engine 24+ y Docker Compose v2.

```bash
git clone <URL_DEL_REPOSITORIO>
cd <repositorio>

cp backend/.env.example backend/.env
# Edita backend/.env:
#   - POSTGRES_PASSWORD (una contraseña local)
#   - JWT_SECRET (genera uno con: openssl rand -hex 32)

docker compose up --build -d
docker compose exec -e ALLOW_SEED=true backend npm run db:seed
```

Servicios publicados en el host:

| Servicio | URL |
| --- | --- |
| Aplicación web | http://localhost:5174 |
| API | http://localhost:3001 |
| PostgreSQL | `localhost:5433` |

Los puertos se eligieron para no chocar con un entorno local que ya use
`3000`, `5173` o `5432`. Puedes cambiarlos en `compose.yaml`.

Detener los servicios:

```bash
docker compose down          # conserva la base de datos
docker compose down -v       # elimina también el volumen de PostgreSQL
```

> Si cambias `POSTGRES_PASSWORD` después de crear el volumen, ejecuta
> `docker compose down -v` para reinicializar la base.

## Inicio rápido sin Docker

Requisitos: Node.js 22+, npm y PostgreSQL 15+.

### 1. Preparar PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER sportreserve_user WITH PASSWORD 'tu_password_local';
CREATE DATABASE sportreserve OWNER sportreserve_user;
ALTER USER sportreserve_user CREATEDB;
SQL
```

`CREATEDB` es necesario para crear `sportreserve_test` con
`npm run db:create:test`. Si no quieres otorgarlo, crea la base de pruebas
manualmente:

```bash
sudo -u postgres createdb -O sportreserve_user sportreserve_test
```

### 2. Backend

```bash
cd backend
npm ci
cp .env.example .env
# Edita POSTGRES_PASSWORD y genera JWT_SECRET con: openssl rand -hex 32
npm run db:create:test
npm run db:migrate
npm run db:seed
npm run dev
```

La API queda en http://localhost:3000.

### 3. Frontend

En otra terminal:

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

La interfaz queda en http://localhost:5173 y Vite redirige `/api` al backend.

### Usuarios demo

| Correo | Contraseña | Rol |
| --- | --- | --- |
| estudiante@demo.com | Demo12345! | estudiante |
| docente@demo.com | Demo12345! | docente |
| admin@demo.com | Demo12345! | administrador |

Las credenciales demo son solo para desarrollo. Cámbialas en `backend/.env`
mediante `SEED_*_PASSWORD` antes de sembrar una base compartida.

## Pruebas y calidad

```bash
# Backend
cd backend
npm test                  # 39 pruebas
npm run test:coverage
npm run lint

# Frontend
cd frontend
npm test                  # 3 pruebas
npm run lint
npm run build
```

Las pruebas del backend requieren la base `sportreserve_test`. Las migraciones
se aplican automáticamente antes de ejecutar la suite.

## Seguridad implementada

- Contraseñas con bcrypt (12 rondas por defecto).
- JWT firmado con HS256, emisor y audiencia verificados.
- Cookie `HttpOnly`, `SameSite=Strict` y `Secure` configurable.
- Validación estricta con Zod (rechaza campos desconocidos).
- Consultas SQL siempre parametrizadas.
- Control de acceso por rol y por propiedad del recurso.
- Respuestas `404` para recursos ajenos, evitando enumerar IDs.
- Rate limiting global y específico en autenticación.
- Helmet, CSP, CORS con lista blanca y validación de `Origin`.
- Límite de tamaño del cuerpo JSON (10 kb).
- React escapa el contenido por defecto (sin `dangerouslySetInnerHTML`).

Los detalles y las limitaciones se explican en
[`docs/memoria-tecnica.md`](docs/memoria-tecnica.md).

## Documentación

- [Memoria técnica](docs/memoria-tecnica.md)
- [Referencia de la API](docs/api.md)
- [Estrategia y casos de prueba](docs/pruebas.md)
- [Guía de despliegue](docs/despliegue.md)
- [Despliegue gratuito: Neon + Render + Vercel](docs/despliegue-gratuito.md)
- [Matriz de requisitos](docs/matriz-requisitos.md)
- [Plan de trabajo para 3 integrantes](docs/equipo-y-tareas.md)
- [Guía de contribución](CONTRIBUTING.md)

## Flujo de trabajo del equipo

- Ramas: `main` (entregable), `develop` (integración) y `feature/<tema>`.
- Cada cambio entra por Pull Request con al menos una revisión.
- Los mensajes de commit siguen Conventional Commits.
- La CI debe pasar antes de fusionar.

El detalle y el reparto de tareas están en
[`docs/equipo-y-tareas.md`](docs/equipo-y-tareas.md).
