# Matriz de requisitos y riesgos

## 1. Trazabilidad de requisitos

| ID | Requisito | Implementación | Evidencia |
| --- | --- | --- | --- |
| RF-01 | Registro de usuarios | `POST /api/v1/auth/register`, `auth.service.js` | `tests/auth.test.js` |
| RF-02 | Inicio de sesión | `POST /api/v1/auth/login`, cookie JWT | `tests/auth.test.js` |
| RF-03 | Cierre de sesión | `POST /api/v1/auth/logout` | `tests/auth.test.js` |
| RF-04 | Crear tarea | `POST /api/v1/tasks` | `tests/tasks.test.js` |
| RF-05 | Listar tareas | `GET /api/v1/tasks` con filtros y paginación | `tests/tasks.test.js` |
| RF-06 | Editar tarea | `PATCH /api/v1/tasks/:id` | `tests/tasks.test.js` |
| RF-07 | Eliminar tarea | `DELETE /api/v1/tasks/:id` | `tests/tasks.test.js` |
| RF-08 | Título, descripción, estado y dueño | Tabla `tasks` y esquemas Zod | `001_initial.sql`, `tasks.schemas.js` |
| RF-09 | Rol estudiante | Solo tareas propias | `tests/tasks.test.js` |
| RF-10 | Rol docente | Lee todas, edita solo las suyas | `tests/tasks.test.js` |
| RF-11 | Rol administrador | CRUD total; crear, editar, cambiar rol y activar/desactivar usuarios (sin cambio de contraseña ni envío de enlaces) | `tests/tasks.test.js`, `tests/security.test.js`, `tests/users.test.js` |
| RF-12 | Interfaz web | React + Vite | `frontend/src/pages` |
| RF-13 | Pruebas automatizadas | 61 backend + 20 frontend | `docs/pruebas.md` |
| RF-14 | Repositorio Git | `main`, `develop`, `feature/*`, PR | `CONTRIBUTING.md` |
| RF-15 | Memoria técnica | `docs/memoria-tecnica.md` | Este repositorio |
| RF-16 | Docker opcional | `compose.yaml` + Dockerfiles | `docs/despliegue.md` |
| RF-17 | Sesiones por dispositivo | Tabla `sessions`, `jti` y middleware | `003_auth_security.sql`, `sessions.service.js` |
| RF-18 | Bloqueo progresivo | `failed_attempts`, `locked_until` | `auth.service.js`, `evidencia-auth.md` |
| RF-19 | Restablecimiento de contraseña | Token de un solo uso + Mailpit/SMTP | `passwordReset.service.js`, `evidencia-auth.md` |
| RF-20 | Cambio de contraseña | `POST /auth/change-password` | `auth.routes.js`, `evidencia-auth.md` |
| RF-21 | Auditoría de autenticación | Tabla `auth_events` | `003_auth_security.sql`, `authEvents.service.js` |

La trazabilidad detallada del ejercicio 1.2 está en
[`matriz-cumplimiento-1-2.md`](matriz-cumplimiento-1-2.md).

## 2. Requisitos no funcionales

| ID | Requisito | Cómo se cumple |
| --- | --- | --- |
| RNF-01 | Seguridad de contraseñas | bcrypt 12 rondas, mínimo 10 caracteres y máximo 72 bytes UTF-8 |
| RNF-02 | Sesión no accesible desde JavaScript | Cookie `HttpOnly` |
| RNF-03 | Protección CSRF | `SameSite=Strict` + validación de `Origin` |
| RNF-04 | Prevención de SQLi | Consultas parametrizadas y lista blanca de orden |
| RNF-05 | Prevención de XSS | Escape de React + CSP + sin HTML crudo |
| RNF-06 | Control de acceso | RBAC y verificación de propiedad |
| RNF-07 | Validación de entrada | Zod con `.strict()` |
| RNF-08 | Resistencia a fuerza bruta | Bloqueo progresivo por cuenta + rate limit global y por IP |
| RNF-09 | Revocación de sesiones | `sessions` con `revoked_at`; logout y cambio invalidan cookies |
| RNF-10 | Restablecimiento seguro | Token de 256 bits, solo SHA-256, un uso y caducidad |
| RNF-11 | Mantenibilidad | Módulos por dominio, lint y documentación |
| RNF-12 | Portabilidad | Ejecución local y con Docker |
| RNF-13 | Trazabilidad | Git, issues, PR, CI y matriz de cumplimiento |
| RNF-14 | Usabilidad | Interfaz en español, responsive y mensajes claros |

## 3. Matriz de riesgos (Probabilidad × Impacto)

Escala: 1 = bajo, 2 = medio, 3 = alto. Prioridad = P × I.

| Riesgo | P | I | Prioridad | Mitigación |
| --- | --- | --- | --- | --- |
| Acceso a tareas ajenas (IDOR) | 2 | 3 | 6 | Verificación de propiedad + pruebas |
| Inyección SQL | 2 | 3 | 6 | Consultas parametrizadas + pruebas |
| Robo de sesión | 1 | 3 | 3 | Cookie HttpOnly, SameSite, HTTPS, revocación por `jti` |
| Escalada de rol | 2 | 3 | 6 | Rol solo desde servidor + RBAC |
| XSS almacenado | 2 | 2 | 4 | Escape de React + CSP + prueba |
| Fuerza bruta de credenciales | 2 | 2 | 4 | Bloqueo progresivo + rate limit por IP |
| Enumeración de cuentas | 2 | 2 | 4 | Mensaje genérico y hash ficticio; registro con `409` aceptado |
| IP falsificada en proxy | 2 | 2 | 4 | Nginx sobrescribe XFF; medir `TRUST_PROXY` en producción |
| Correo de reset interceptado | 1 | 3 | 3 | Token hasheado, un uso, caducidad y fragmento de URL |
| Fuga de secretos en Git | 2 | 3 | 6 | `.gitignore`, `.env.example`, revisión de PR |
| Pérdida de datos | 1 | 3 | 3 | Volumen/backups y migraciones versionadas |
| Conflictos de merge | 2 | 2 | 4 | Ramas cortas, PR y revisión |
| Retraso por dependencias | 2 | 2 | 4 | Reparto por frentes y tablero |
| Docker no disponible en el aula | 2 | 1 | 2 | Alternativa local documentada |
| Puertos ocupados | 2 | 1 | 2 | Puertos configurables (3001/5174/5433) |
| CI roja antes de la entrega | 2 | 3 | 6 | Ejecutar lint y pruebas antes del push |

## 4. Criterios de aceptación globales

- [ ] Los tres roles pueden iniciar sesión.
- [ ] Un estudiante no ve tareas ajenas.
- [ ] Un docente ve todas pero no edita ajenas.
- [ ] Un administrador gestiona tareas y roles.
- [ ] El registro siempre crea estudiantes.
- [ ] Las pruebas de backend y frontend pasan.
- [ ] Lint y build pasan.
- [ ] La app funciona con y sin Docker.
- [ ] La documentación permite a un tercero ejecutar el proyecto.
- [ ] No hay secretos en el repositorio.
- [ ] Logout y cambio de contraseña invalidan las sesiones.
- [ ] El bloqueo progresivo y el restablecimiento se verificaron manualmente.
- [x] Las pruebas de R5 están implementadas y registradas en `docs/pruebas.md`.
