# Matriz de cumplimiento — Ejercicio 1.2 (seguridad de autenticación)

Fecha de implementación: noviembre de 2026. Rama: `feature/seguridad-auth`.

Este documento traza cada requisito del ejercicio 1.2 con el código que lo
implementa, la evidencia disponible y su estado. Los mensajes de la API y los
comentarios del código están en español; los nombres de archivos, tablas y
variables siguen la convención del repositorio (inglés).

## 1. Resumen

| ID | Requisito | Estado | Evidencia principal |
| --- | --- | --- | --- |
| R1 | Roles normalizados en base de datos | Cumplido | `002_roles.sql`, `users.service.js`, `tests/auth.test.js` |
| R2 | Política de contraseñas (10 caracteres / 72 bytes UTF-8; fortaleza en registro y alta admin) | Cumplido | `auth.schemas.js`, `users.schemas.js`, `tests/validation.test.js`, `tests/users.test.js` |
| R3 | Endurecimiento de login, sesiones y restablecimiento | Cumplido | `auth.service.js`, `sessions.service.js`, `passwordReset.service.js` |
| R4 | Registro de eventos de autenticación sin datos sensibles | Cumplido | `authEvents.service.js`, `003_auth_security.sql` |
| R5 | Pruebas automatizadas de los flujos nuevos | Cumplido | `tests/auth-lifecycle.test.js`, `tests/rate-limit-ip.test.js` |

La suite queda verde: **69 pruebas de backend** (9 archivos) y **30 de frontend**
(7 archivos). Incluye las pruebas específicas de R5 incorporadas después de la
evidencia manual recogida en `evidencia-auth.md` y las validaciones estrictas
del registro añadidas en `login_robusto`.

## 2. R1 — Roles normalizados

| Aspecto | Implementación |
| --- | --- |
| Catálogo | Tabla `roles (id SMALLINT PK, name, description)` |
| Roles | `estudiante`, `docente`, `administrador` |
| Referencia | `users.role_id SMALLINT NOT NULL` con FK a `roles.id` |
| Migración | `database/migrations/002_roles.sql` |
| Código | `users.service.js` usa `JOIN roles` y devuelve `role` calculado |
| Seed y pruebas | `seed.js` y `tests/helpers.js` insertan con subconsulta a `roles` |
| Eliminación | Se elimina la columna de texto `users.role` |

Comprobación:

```sql
SELECT id, name FROM roles ORDER BY id;
-- 1 | estudiante
-- 2 | docente
-- 3 | administrador

SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'role';
-- 0 filas: ya no existe users.role
```

La API sigue exponiendo `"role": "estudiante"` (texto) para no romper el
frontend ni las pruebas existentes. `role_id`, `failed_attempts` y
`locked_until` nunca salen en una respuesta.

## 3. R2 — Política de contraseñas

| Regla | Dónde se aplica |
| --- | --- |
| Mínimo 10 caracteres (puntos de código) | Registro, cambio y restablecimiento |
| Máximo 72 bytes en UTF-8 | Registro, cambio, restablecimiento y login |
| Se rechaza sin truncar silenciosamente | `auth.schemas.js` (`utf8Password`) |

El máximo se valida en bytes porque bcrypt trunca a 72 bytes. Validar solo
caracteres permitiría que una contraseña con emojis superara el límite real.
El login también limita a 72 bytes para impedir que una contraseña más larga
coincida con los primeros 72 bytes de la contraseña almacenada.

Evidencia manual (detalle en `evidencia-auth.md`):

| Entrada | Resultado |
| --- | --- |
| Nueva contraseña de 80 caracteres ASCII | `400 VALIDATION_ERROR` |
| Nueva contraseña de 20 emojis (80 bytes) | `400 VALIDATION_ERROR` |
| Nueva contraseña de 10 caracteres | Aceptada |
| Nueva igual a la actual | `400 SAME_PASSWORD` |

## 4. R3 — Endurecimiento de la autenticación

### R3.1 — Mensaje genérico y tiempos comparables

- Correo inexistente, contraseña incorrecta, cuenta inactiva y cuenta bloqueada
  devuelven el mismo `401 INVALID_CREDENTIALS` con el mensaje
  “Correo o contraseña incorrectos. Si has tenido varios intentos fallidos,
  espera unos minutos antes de volver a intentarlo.”
- Si el correo no existe, se compara igualmente contra un hash ficticio
  calculado al arrancar con `BCRYPT_ROUNDS` (`utils/password.js`).
- Evidencia de tiempos locales: ~0,36 s para una cuenta existente y ~0,37 s
  para una inexistente (una muestra; no es una prueba estadística).

### R3.2 — Bloqueo progresivo por cuenta

- Variables: `LOCKOUT_THRESHOLD=5`, `LOCKOUT_BASE_SECONDS=60`,
  `LOCKOUT_MAX_SECONDS=900`.
- Fórmula: `min(60 · 2^(n − 5), 900)` segundos, donde `n` es el número de
  fallos acumulados.
- El incremento es atómico en SQL (`users.service.js`).
- Mientras la cuenta está bloqueada **no** se incrementa el contador ni se
  prolonga el bloqueo; una contraseña correcta sigue devolviendo `401`.
- Un login correcto reinicia `failed_attempts` y limpia `locked_until`.

Evidencia manual:

| Fallos acumulados | Bloqueo resultante |
| --- | --- |
| 5 | 60 s |
| 6 | 120 s |
| 7 | 240 s |
| 8 | 480 s |
| 9 o más | 900 s (tope) |

### R3.3 — Restablecimiento de contraseña

- Token aleatorio de 32 bytes (`base64url`, 256 bits).
- Solo se guarda su SHA-256; el token original nunca se persiste ni se registra.
- Un solo uso, caducidad configurable (`RESET_TOKEN_TTL_MINUTES=15`).
- Una solicitud nueva anula los tokens pendientes del mismo usuario.
- El enlace usa el fragmento: `${FRONTEND_URL}/restablecer#token=...`, para que
  el token no llegue al servidor ni a los logs de proxies/CDN.
- Éxito: cambia la contraseña, marca el token y los pendientes como usados,
  revoca todas las sesiones y reinicia `failed_attempts`/`locked_until` en una
  sola transacción.
- Cualquier token inválido, usado, vencido o de una cuenta inactiva devuelve el
  mismo `400 INVALID_RESET_TOKEN`.
- `POST /auth/forgot-password` responde siempre `202` con el mismo cuerpo para
  correos existentes e inexistentes.
- Sin SMTP configurado el endpoint sigue respondiendo igual, pero no se envía el
  correo (el restablecimiento queda inoperante). Se registra una advertencia sin
  token. En producción con Render Free esto es una limitación conocida porque
  los puertos SMTP están bloqueados.

### R3.4 — Sesiones por dispositivo y caducidad en servidor

- Tabla `sessions` con `id UUID`, `user_id`, `created_at`, `expires_at` y
  `revoked_at`.
- Cada login crea una sesión nueva. El JWT incluye el claim estándar `jti` con el
  id de la sesión.
- El middleware exige `jti`, valida la firma, verifica que `sub` coincida con el
  dueño de la sesión y consulta la base en cada solicitud.
- La sesión es válida solo si no está revocada, no venció (`expires_at > now()`
  evaluado en PostgreSQL) y el usuario sigue activo.
- Un token sin `jti` (anterior al cambio) se rechaza con
  `401 INVALID_SESSION`.
- La caducidad del JWT (`exp`) se sigue verificando; la autoridad final es la
  fila de `sessions`.

### R3.5 — Logout con revocación y rotación

- `POST /auth/logout` es público e idempotente: siempre responde `204` y limpia
  la cookie, incluso sin cookie o con token inválido.
- Si la cookie identifica una sesión, se marca `revoked_at`; el token deja de
  servir aunque no haya expirado.
- Si un login llega con una cookie válida del mismo usuario, la sesión anterior
  se revoca antes de crear la nueva (rotación del identificador).

### R3.6 — Cambio de contraseña

- `POST /auth/change-password` requiere sesión y limitador de autenticación.
- Exige `currentPassword` correcta; si no, `400 INVALID_CURRENT_PASSWORD`.
- Exige que la nueva sea distinta; si no, `400 SAME_PASSWORD`.
- En una transacción: actualiza el hash, revoca **todas** las sesiones y crea una
  nueva para el dispositivo que hizo el cambio. La cookie anterior deja de ser
  válida.
- Registra el evento `password_changed`.

## 5. R4 — Eventos de autenticación

Tabla `auth_events` (`003_auth_security.sql`):

| Columna | Contenido |
| --- | --- |
| `id` | Identidad BIGINT |
| `user_id` | UUID o `NULL` si el correo no existe; `ON DELETE SET NULL` |
| `event_type` | Uno de los valores permitidos por un `CHECK` |
| `ip` | IP de la solicitud, máximo 64 caracteres |
| `created_at` | `now()` |

Eventos registrados: `register`, `login_success`, `login_failed`,
`account_locked`, `logout`, `password_changed`,
`password_reset_requested`, `password_reset_completed`,
`password_reset_failed`.

Nunca se guardan correos, contraseñas, tokens, enlaces ni cuerpos de solicitud.
El registro es “best effort”: un fallo al auditar no interrumpe el login.

## 6. R5 — Pruebas automatizadas

Los flujos nuevos quedaron cubiertos por `tests/auth-lifecycle.test.js` y
`tests/rate-limit-ip.test.js`:

| Prueba | Criterio |
| --- | --- |
| Credenciales inválidas | Mismo `401 INVALID_CREDENTIALS` para correo inexistente, clave mala y usuario inactivo |
| Fuerza bruta simulada | 5 fallos bloquean; durante el bloqueo no se incrementa; un login correcto reinicia |
| Reutilización de token | El segundo uso del token de reset devuelve `400 INVALID_RESET_TOKEN` |
| Sesión expirada | Actualizar `sessions.expires_at` al pasado y comprobar `401 INVALID_SESSION` |
| Contraseña >72 bytes | Registro, cambio y reset devuelven `400` |
| `TRUST_PROXY` numérico | Cubierto por `tests/config.test.js` |

La evidencia manual reproducible está en [`evidencia-auth.md`](evidencia-auth.md),
con comandos `curl` y consultas SQL.

## 7. Configuración y despliegue

| Elemento | Estado |
| --- | --- |
| Migraciones nuevas | `002_roles.sql`, `003_auth_security.sql`; no se editó `001_initial.sql` |
| Variables nuevas | Documentadas en `backend/.env.example`, `compose.yaml` y `render.yaml` |
| Proxy local | Nginx sobrescribe `X-Forwarded-For` con `$remote_addr`; Compose usa `TRUST_PROXY=1` |
| Proxy de producción | `TRUST_PROXY` queda como estaba (`true` equivale a 1) hasta medir los saltos reales con `LOG_FORWARDED_FOR` |
| Correo local | Mailpit en `http://127.0.0.1:8025` |
| Correo producción | Pendiente de configurar SMTP real; Render Free bloquea puertos SMTP |
| Frontend | Implementado: `/olvide-contrasena`, `/restablecer` (token leído del fragmento y borrado de la URL) y `/cambiar-contrasena` |

## 8. Riesgos residuales

- **Enumeración en registro**: `POST /auth/register` mantiene `409 EMAIL_IN_USE`
  por compatibilidad. Está documentado como compromiso aceptado.
- **Rate limit y bloqueo en memoria + base**: el limitador por IP vive en memoria
  del proceso; con varias instancias hace falta Redis. El bloqueo por cuenta sí
  persiste en PostgreSQL.
- **IP detrás de proxies**: el bloqueo por IP es “best effort”. La protección
  principal es el bloqueo por cuenta. En producción hay que medir la cadena real
  (Cloudflare/Render) antes de ajustar `TRUST_PROXY`.
- **Sin verificación de correo**: un usuario puede registrarse con un correo
  ajeno; el restablecimiento enviaría el enlace a ese correo.
- **SMTP**: sin configuración, el restablecimiento no envía correo en producción.
