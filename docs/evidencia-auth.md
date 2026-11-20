# Evidencia manual de autenticación

Registro de las comprobaciones hechas contra el entorno Docker local el
13–14 de noviembre de 2026. Los tokens y contraseñas de prueba se muestran
parcialmente o se describen; no se copian secretos completos.

Entorno:

```text
Frontend/Nginx: http://127.0.0.1:5174
API directa:    http://127.0.0.1:3001
PostgreSQL:     127.0.0.1:5433
Mailpit:        http://127.0.0.1:8025
```

Las pruebas automatizadas nuevas de R5 quedaron delegadas a otro integrante
(ver [`matriz-cumplimiento-1-2.md`](matriz-cumplimiento-1-2.md)). Esta evidencia
es el sustituto temporal y es reproducible con los comandos indicados.

## 1. Roles normalizados

```bash
docker compose exec -T db sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, name FROM roles ORDER BY id"'
```

```text
 id |     name
----+---------------
  1 | estudiante
  2 | docente
  3 | administrador
```

`users` ya no tiene la columna de texto `role`; conserva `role_id`,
`failed_attempts` y `locked_until`:

```text
id, name, email, password_hash, is_active, created_at, updated_at,
role_id, failed_attempts, locked_until
```

## 2. Cookie de sesión

```bash
curl -s -i -c cookies.txt -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"estudiante@demo.com","password":"Demo12345!"}' | grep -i '^set-cookie'
```

```text
Set-Cookie: sr_token=<jwt>; Max-Age=7200; Path=/; Expires=...;
            HttpOnly; SameSite=Strict
```

En producción (`COOKIE_SECURE=true`) se agrega `Secure` y el navegador solo la
envía por HTTPS.

## 3. Logout revoca la sesión

```bash
COOKIE=$(awk '$6=="sr_token" {print $6"=" $7}' cookies.txt)
curl -s -o /dev/null -w '%{http_code}\n' -H "Cookie: $COOKIE" "$BASE/auth/me"
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "Cookie: $COOKIE" "$BASE/auth/logout"
curl -s -w '\n%{http_code}\n' -H "Cookie: $COOKIE" "$BASE/auth/me"
```

```text
200
204
{"error":{"code":"INVALID_SESSION","message":"Sesión inválida o expirada"}}
401
```

El mismo token deja de servir inmediatamente aunque su `exp` siga vigente.

## 4. Bloqueo progresivo

Se registró `lock@example.com` y se enviaron cinco contraseñas incorrectas:

```text
registro: 201
fallo 1: 401
fallo 2: 401
fallo 3: 401
fallo 4: 401
fallo 5: 401
```

Estado en PostgreSQL:

```sql
SELECT failed_attempts, round(extract(epoch FROM locked_until - now()))::int
FROM users WHERE email = 'lock@example.com';
```

```text
5 | 60
```

Con la cuenta bloqueada, una contraseña **correcta** sigue devolviendo el mismo
error:

```text
{"error":{"code":"INVALID_CREDENTIALS","message":"Correo o contraseña incorrectos. Si has tenido varios intentos fallidos, espera unos minutos antes de volver a intentarlo."}}
401
```

Para no esperar minutos entre intentos, se movió `locked_until` al pasado con
SQL y se repitió un fallo por cada nivel. El contador no se incrementa mientras
la cuenta sigue bloqueada; al vencer, el siguiente fallo aplica la duración
mayor:

| Fallo acumulado | Duración observada |
| --- | --- |
| 5 | 60 s |
| 6 | 120 s |
| 7 | 240 s |
| 8 | 480 s |
| 9 | 900 s |
| 10 | 900 s (tope) |

En una ejecución limpia, los intentos 6..9 dieron `401` y las duraciones
`120, 240, 480, 900`.

## 5. Tiempos de login comparables

Tres intentos con una cuenta existente y contraseña incorrecta, y tres con un
correo inexistente:

```text
existe (clave mala):     0.364599  0.373473  0.366182
no existe:               0.359422  0.359008  0.396011
```

La diferencia observada es de milisegundos y no permite distinguir de forma
fiable si la cuenta existe. Es una muestra local; no sustituye una prueba
estadística.

## 6. Cambio de contraseña

Usuario local de prueba `reset@example.com` con contraseña `ResetClave123!`:

| Caso | Respuesta |
| --- | --- |
| `currentPassword` incorrecta | `400 INVALID_CURRENT_PASSWORD` |
| Nueva igual a la actual | `400 SAME_PASSWORD` |
| Nueva de 80 bytes ASCII | `400 VALIDATION_ERROR` (límite UTF-8) |
| Cambio válido | `200` + nueva cookie |
| Cookie anterior a `/auth/me` | `401 INVALID_SESSION` |
| Login con la contraseña anterior | `401 INVALID_CREDENTIALS` |
| Login con la contraseña nueva | `200` |

Mensaje del límite de bytes:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos",
    "details": [
      {
        "path": "newPassword",
        "message": "La contraseña no puede superar los 72 bytes en UTF-8"
      }
    ]
  }
}
```

## 7. Restablecimiento por correo

Solicitud para `reset@example.com`:

```text
202 {"data":{"message":"Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña"}}
```

La misma respuesta se obtuvo para un correo inexistente. El mensaje llegó a
Mailpit y el enlace usó el fragmento:

```text
.../restablecer#token=<token>
```

El token se leyó desde la API de Mailpit; aquí se muestra solo un fragmento:

```text
token (parcial): BhAjhK...Oy1o
```

Resultados:

| Caso | Respuesta |
| --- | --- |
| Primer uso del token | `200` “Contraseña restablecida correctamente” |
| Segundo uso del mismo token | `400 INVALID_RESET_TOKEN` |
| Token desconocido | `400 INVALID_RESET_TOKEN` |
| Token vencido (`expires_at` al pasado) | `400 INVALID_RESET_TOKEN` |
| Token anulado por una solicitud nueva | `400 INVALID_RESET_TOKEN` |
| Sesión creada antes del reset | `401 INVALID_SESSION` |
| Login con la contraseña anterior | `401 INVALID_CREDENTIALS` |
| Login con la contraseña nueva | `200` |
| Cuenta bloqueada antes del reset | Queda con `failed_attempts=0` y `locked_until=NULL` |

Solo se almacena el hash SHA-256 de 64 caracteres hexadecimales; el token
original no aparece en la base ni en `auth_events`.

## 8. Sesión expirada

Se inició sesión con `estudiante@demo.com` y se movió `expires_at` al pasado:

```sql
UPDATE sessions SET expires_at = now() - interval '1 minute'
WHERE user_id = (SELECT id FROM users WHERE email = 'estudiante@demo.com')
  AND revoked_at IS NULL;
```

```text
antes:  200
después: 401 INVALID_SESSION
```

La caducidad se evalúa en PostgreSQL, no con el reloj de Node.

## 9. Límite de intentos por IP

El limitador de login es de 20 fallos por IP cada 15 minutos. En esta sesión ya
había 18 fallos acumulados; por eso la tanda siguiente cortó antes:

```text
intentos desde la misma IP:
1: 401
2: 401
3: 429
...
```

En una ventana limpia, el intento 21 es el que recibe
`429 RATE_LIMITED`. Los inicios de sesión correctos no consumen el cupo
(`skipSuccessfulRequests`).

## 10. IP real detrás de Nginx

Se envió un `X-Forwarded-For` falso a través del frontend:

```bash
curl -s -o /dev/null -X POST "$BASE/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -H 'X-Forwarded-For: 203.0.113.7' \
  -d '{"email":"reset@example.com"}'
```

La IP registrada en `auth_events` fue `172.18.0.1` (la dirección real de la
conexión vista por Nginx dentro de Docker), **no** `203.0.113.7`. Nginx
sobrescribe la cabecera con `$remote_addr` y el backend confía en un solo salto
(`TRUST_PROXY=1`).

En producción la cadena es distinta (Vercel → Cloudflare → Render → Node). No se
asumió un número de saltos: hay que medirlo con `LOG_FORWARDED_FOR=true` y la
IP conocida, como se explica en [`despliegue-gratuito.md`](despliegue-gratuito.md).

## 11. Auditoría

```sql
SELECT event_type, count(*) FROM auth_events GROUP BY event_type ORDER BY event_type;
```

```text
 account_locked           |     5
 login_failed             |    20
 login_success            |     4
 logout                   |     1
 password_reset_completed |     1
 password_reset_failed    |     1
 password_reset_requested |     2
 register                 |     3
```

La tabla solo tiene `user_id`, `event_type`, `ip` y `created_at`. No hay
columnas para correo, contraseña, token ni cuerpo de la solicitud.

## 12. Pendiente de verificar fuera del entorno local

- Número real de saltos de proxy en Render/Cloudflare (medir con
  `LOG_FORWARDED_FOR`).
- Envío real de correo en producción: Render Free bloquea los puertos SMTP; hará
  falta un proveedor con API HTTPS o un plan que permita SMTP.
- Pruebas automatizadas de R5, asignadas a otro integrante.
