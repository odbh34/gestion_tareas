# Estrategia y casos de prueba

## 1. Enfoque

Se combinaron pruebas de integración de la API con pruebas de componentes del
frontend:

- **Backend**: Supertest ejecuta la aplicación Express completa contra una base
  PostgreSQL real. No se usan mocks de base de datos, porque las pruebas de
  seguridad deben validar también el SQL y las restricciones del esquema.
- **Frontend**: Vitest + Testing Library renderizan componentes en `jsdom` y
  verifican el comportamiento visible para el usuario.
- **CI**: GitHub Actions ejecuta lint, pruebas y build en cada push y PR.

No se buscó una cobertura numérica alta, sino cubrir los flujos críticos y los
riesgos de seguridad del alcance.

## 2. Preparación del entorno

### Backend

```bash
cd backend
npm ci
cp .env.example .env
# Configura POSTGRES_PASSWORD y JWT_SECRET
npm run db:create:test
npm test
```

`backend/tests/setup.js`:

- Fuerza `NODE_ENV=test`.
- Usa `POSTGRES_DB_TEST` como base de datos.
- Desactiva el rate limit para no interferir con las pruebas.
- Reduce bcrypt a 10 rondas.
- Aplica migraciones antes de la suite.
- Usa una bandeja de correo en memoria (no envía SMTP).
- Cierra el pool al terminar.

Cada archivo limpia las tablas con
`TRUNCATE TABLE auth_events, password_reset_tokens, sessions, tasks, users
RESTART IDENTITY CASCADE` antes de cada prueba. La tabla `roles` no se trunca:
es un catálogo fijo de la migración `002_roles.sql`. Vitest se configura con
`fileParallelism: false` para evitar carreras sobre la misma base.

Si usas el PostgreSQL de Docker (publicado en `5433`) y tu `backend/.env` apunta
a `5432`, ejecuta:

```bash
POSTGRES_PORT=5433 npm test
```

### Frontend

```bash
cd frontend
npm ci
npm test
```

No requiere backend: las pruebas de componentes usan datos locales.

## 3. Herramientas

| Herramienta | Uso |
| --- | --- |
| Vitest | Ejecutor de pruebas |
| Supertest | Solicitudes HTTP contra Express |
| Testing Library | Renderizado y consultas por accesibilidad |
| jest-dom | Matchers de DOM |
| @vitest/coverage-v8 | Cobertura del backend |
| ESLint | Calidad estática |
| GitHub Actions | Automatización en CI |

## 4. Casos de backend

### `tests/auth.test.js` — autenticación

| Caso | Resultado esperado |
| --- | --- |
| Registro válido | `201`, correo normalizado, rol `estudiante`, sin `password_hash` |
| Rol inyectado en registro | `400 VALIDATION_ERROR` |
| Correo duplicado | `409 EMAIL_IN_USE` |
| Contraseña corta | `400` |
| Login válido | `200` y cookie `HttpOnly`, `SameSite=Strict` |
| Contraseña incorrecta | `401` con mensaje genérico |
| Usuario inexistente | `401` con el mismo mensaje |
| Usuario inactivo | `401` |
| `/me` sin cookie | `401` |
| Logout | `204` y cookie eliminada |
| Usuario desactivado después del login | La sesión deja de ser válida |
| Respuesta de registro | No contiene `password_hash` |

### `tests/tasks.test.js` — CRUD y reglas

| Caso | Resultado esperado |
| --- | --- |
| Crear tarea | `201`; `owner_id` tomado de la sesión |
| Enviar `owner_id` en el body | `400 VALIDATION_ERROR` |
| Estudiante lista tareas | Solo las propias |
| Docente y administrador listan | Todas |
| Otro estudiante lee/edita/borra | `404` en las tres operaciones |
| Docente lee tarea ajena | `200` |
| Docente edita tarea ajena | `404` |
| Administrador edita/borra tarea ajena | `200` / `204` |
| Dueño edita/borra su tarea | `200` / `204` |
| Título vacío, estado inválido o ID no UUID | `400` |
| Filtro por estado y paginación | Datos y metadatos correctos |

### `tests/security.test.js` — seguridad

| Caso | Resultado esperado |
| --- | --- |
| IDOR en lectura, edición y borrado | `404`; la tarea original no cambia |
| Estudiante o docente accede a `/users` | `403` |
| Estudiante intenta cambiar un rol | `403` |
| Administrador intenta quitarse el rol | `400 CANNOT_DEMOTE_SELF` |
| Registro con rol `administrador` | `400` |
| Búsqueda de usuarios con `' OR '1'='1` | `200` y lista vacía |
| Payload `'; DROP TABLE users; --` | La tabla sigue existiendo |
| Búsqueda de tareas con SQLi | `200` y lista vacía |
| Login con SQLi | `400` o `401`, nunca acceso |
| Tarea con `<script>` e `<img onerror>` | Se guarda y devuelve como texto JSON |
| Cabeceras defensivas | CSP, `nosniff`, `DENY`, sin `X-Powered-By` |
| Respuestas de API | `Cache-Control: no-store` |
| Origen no permitido | `403 CORS_NOT_ALLOWED` |
| Origen permitido | Cabecera CORS correcta |

### `tests/health.test.js` — infraestructura y errores

| Caso | Resultado esperado |
| --- | --- |
| `GET /` | `200` con nombre de la API |
| `GET /health` | `200` y base `up` |
| Ruta inexistente | `404 NOT_FOUND` |
| JSON malformado | `400 INVALID_JSON` |
| Cuerpo mayor a 10 kb | `413 PAYLOAD_TOO_LARGE` |

### `tests/config.test.js` — configuración

| Caso | Resultado esperado |
| --- | --- |
| `TRUST_PROXY=0/1/2` | Devuelve el número de saltos |
| `true` / `false` | `1` / `0` (compatibilidad) |
| Valor vacío | Usa el valor por defecto |
| `dos`, `1.5`, `-1` | Error de configuración |

### `tests/validation.test.js` — registro robusto

| Caso | Resultado esperado |
| --- | --- |
| Nombre con etiquetas o dígitos | `400 VALIDATION_ERROR` |
| Correo con puntos consecutivos | `400 VALIDATION_ERROR` |
| Contraseña común o con datos personales | `400 VALIDATION_ERROR` |
| `texto@texto.text` | `201` (solo se valida el formato) |

## 4.1. Pruebas pendientes de R5

Las pruebas de los flujos nuevos de seguridad se acordaron con otro integrante y
no se agregaron en esta rama. Faltan:

| Caso | Resultado esperado |
| --- | --- |
| Credenciales inválidas en los cuatro escenarios | Mismo `401 INVALID_CREDENTIALS` |
| Fuerza bruta simulada | Bloqueo a los 5 fallos; sin incremento durante el bloqueo |
| Reutilización de token de reset | `400 INVALID_RESET_TOKEN` |
| Sesión expirada (`UPDATE sessions.expires_at`) | `401 INVALID_SESSION` |

Mientras tanto, el comportamiento se verificó manualmente con `curl` y SQL. Los
comandos y las salidas están en [`evidencia-auth.md`](evidencia-auth.md).

## 5. Casos de frontend

Las páginas nuevas de contraseña (`/olvide-contrasena`, `/restablecer` y
`/cambiar-contrasena`) se verificaron con `npm run build` y comprobaciones
manuales de renderizado. Sus pruebas de componente quedan pendientes junto con
las de R5.

`frontend/src/components/TaskCard.test.jsx`:

1. Un título con `<script>` y una descripción con `<img onerror>` se muestran
   como texto; el DOM no contiene etiquetas `script` ni `img`.
2. El dueño se muestra cuando `showOwner` está activo.
3. Los botones “Editar” y “Eliminar” solo aparecen si `canEdit` es verdadero.

## 6. Ejecución

```bash
# Backend
cd backend
npm test
npm run test:coverage
npm run lint

# Frontend
cd frontend
npm test
npm run lint
npm run build
```

Resultado esperado de la versión actual:

```text
Backend:  8 archivos, 55 pruebas aprobadas
Frontend: 6 archivos, 20 pruebas aprobadas
```

Las 41 incluyen 39 pruebas previas y 2 del parser de `TRUST_PROXY`. Las pruebas
de los flujos nuevos de seguridad (R5) están pendientes por acuerdo del equipo.

## 7. Integración continua

`.github/workflows/ci.yml`:

1. Levanta PostgreSQL 17 como servicio.
2. Ejecuta `npm ci`, `npm run lint` y `npm test` en backend.
3. Ejecuta `npm ci`, `npm run lint`, `npm test` y `npm run build` en frontend.
4. Construye las imágenes Docker de backend y frontend.

Si la CI falla, el Pull Request no debe fusionarse.

## 8. Cómo agregar pruebas

- Para un endpoint nuevo, agrega el caso feliz y al menos un caso de permiso
  denegado.
- Para un cambio de validación, prueba el límite y un campo desconocido.
- Para un cambio visual, prueba el texto visible y la ausencia de HTML
  interpretado.
- Mantén las pruebas independientes: no dependas del orden ni de datos previos.
- No uses datos reales ni secretos en las pruebas.

## 9. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `database "sportreserve_test" does not exist` | No se creó la base | `npm run db:create:test` |
| `password authentication failed` | `.env` incorrecto | Revisa usuario y contraseña |
| `ECONNREFUSED 5432` | PostgreSQL detenido o puerto incorrecto | Inicia el servicio o usa `POSTGRES_PORT=5433` con Docker |
| Las pruebas se pisan | Paralelismo | Mantén `fileParallelism: false` |
| Rate limit en pruebas | Configuración heredada | Asegura `RATE_LIMIT_ENABLED=false` |
| `password authentication failed` | `.env` distinto al volumen de Docker | Revisa credenciales o recrea el volumen |
| Correos de reset no aparecen | `NODE_ENV` no es `test` o SMTP mal configurado | En pruebas se usa la bandeja en memoria; en local revisa Mailpit |
