# Despliegue gratuito: Neon + Render + Vercel

Esta guía describe una demo académica **sin coste y sin tarjeta**: PostgreSQL en
Neon, backend en Render y frontend en Vercel. No sustituye a un despliegue de
producción real, pero permite enseñar la aplicación desde cualquier navegador.

## 1. Arquitectura

```text
Navegador
  │  https://sportreserve.vercel.app
  ▼
Vercel (React + rewrite /api/*)
  │  https://sportreserve-api.onrender.com
  ▼
Render (Express + JWT)
  │  postgresql://...neon.tech
  ▼
Neon (PostgreSQL)
```

La clave es que el navegador **solo habla con el dominio de Vercel**. Vercel
reenvía `/api/*` al backend de Render. Así la cookie de sesión sigue siendo del
mismo origen y `SameSite=Strict` funciona sin cambios.

> No configures `VITE_API_BASE_URL` con la URL de Render. Si el frontend llama
> directamente a otro dominio, la cookie pasa a ser de terceros y el navegador
> puede bloquearla.

## 2. Por qué esta combinación

| Servicio | Uso | Plan gratuito |
| --- | --- | --- |
| **Neon** | PostgreSQL | 1 GB, 100 CU-horas y 5 GB de tráfico por proyecto; sin tarjeta |
| **Render** | Backend Express | Web service de 750 h/mes; duerme tras 15 min |
| **Vercel** | Frontend React + proxy `/api` | Hobby, gratis para uso personal/académico |

No se usa el PostgreSQL gratuito de Render porque **caduca a los 30 días**. Neon
mantiene la base indefinidamente dentro de sus límites gratuitos.

## 3. Requisitos previos

- Repositorio en GitHub con las ramas `main` y `develop`.
- Cuenta en [Neon](https://neon.com), [Render](https://render.com) y
  [Vercel](https://vercel.com). Las tres permiten entrar con GitHub.
- Node.js 22 y `npm` en tu equipo (solo si vas a ejecutar el seed localmente).
- `openssl` para generar secretos.

## 4. Paso 1: crear la base de datos en Neon

1. Entra en [console.neon.tech](https://console.neon.tech) y crea un proyecto.
2. Nombre sugerido: `sportreserve`. Región: la más cercana a tus usuarios
   (por ejemplo, `eu-central-1` si estáis en España).
3. En **Connection Details**, copia la **Pooled connection string**. Tiene una
   forma parecida a:

   ```text
   postgresql://neondb_owner:PASSWORD@ep-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

4. Comprueba que la URL incluya `sslmode=require`. Si no aparece, añádelo.
5. Guarda la contraseña en un lugar seguro. No la subas al repositorio.

Notas:

- Usa la cadena **pooled** (el host contiene `-pooler`). Evita agotar las
  conexiones del plan gratuito.
- Si tu cadena incluye `channel_binding=require`, puedes dejarla; `pg` 8.23 la
  soporta. Si apareciera un error de autenticación, elimina ese parámetro.
- Neon suspende el cómputo cuando está inactivo. La primera consulta tras un
  rato puede tardar un poco más.

## 5. Paso 2: desplegar el backend en Render

El repositorio incluye [`render.yaml`](../render.yaml), un blueprint que crea el
servicio con el plan gratuito.

1. En Render, pulsa **New > Blueprint**.
2. Conecta el repositorio de GitHub.
3. Render detectará `render.yaml` y pedirá dos valores:
   - **DATABASE_URL**: la cadena pooled de Neon.
   - **CORS_ORIGINS**: de momento un valor provisional, por ejemplo
     `https://sportreserve.vercel.app`. Lo actualizarás en el paso 4.
4. Confirma la creación. Render generará `JWT_SECRET` automáticamente y
   configurará `NODE_ENV=production`, `COOKIE_SECURE=true` y
   `TRUST_PROXY=true`.
5. Espera a que termine el build. El comando de arranque ejecuta las
   migraciones y después inicia la API:

   ```text
   cd backend && npm run db:migrate && npm start
   ```

6. Copia la URL pública del servicio, por ejemplo
   `https://sportreserve-api.onrender.com`.
7. Verifica:

   ```bash
   curl -i https://sportreserve-api.onrender.com/health
   ```

   Debe responder `200` con `{"status":"OK","database":"up"}`. La primera
   petición puede tardar cerca de un minuto si el servicio estaba dormido.

### Sembrar los usuarios demo

Los usuarios demo se crean con el seed. El plan gratuito de Render **no ofrece
Shell**, así que ejecútalo desde tu equipo contra Neon:

```bash
cd backend
npm ci

DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
NODE_ENV=production \
ALLOW_SEED=true \
JWT_SECRET="$(openssl rand -hex 32)" \
npm run db:seed
```

Si tienes un plan de pago con Shell, también puedes ejecutarlo desde Render:

```bash
cd backend
ALLOW_SEED=true npm run db:seed
```

`ALLOW_SEED=true` es obligatorio porque el seed se bloquea en producción. El
seed es idempotente: no duplica usuarios ni tareas existentes. Ten en cuenta que
imprime las contraseñas demo en la consola. Las credenciales por defecto son:

| Correo | Contraseña | Rol |
| --- | --- | --- |
| estudiante@demo.com | Demo12345! | estudiante |
| docente@demo.com | Demo12345! | docente |
| admin@demo.com | Demo12345! | administrador |

Si la demo será pública, cambia `SEED_*_PASSWORD` antes de sembrar: pásalas en
la misma línea de comandos del seed local o defínelas en **Environment** si usas
el Shell de Render. El seed no actualiza contraseñas de usuarios que ya existen.

## 6. Paso 3: desplegar el frontend en Vercel

Antes de importar el proyecto, edita
[`frontend/vercel.json`](../frontend/vercel.json) y sustituye el destino de
ejemplo por la URL real de Render:

```json
{
  "source": "/api/:path*",
  "destination": "https://sportreserve-api.onrender.com/api/:path*"
}
```

Haz commit y push de ese cambio. Después:

1. En Vercel, pulsa **Add New > Project** e importa el repositorio.
2. En **Root Directory**, selecciona `frontend`.
3. Framework Preset: **Vite**. Build Command: `npm run build`. Output Directory:
   `dist`.
4. No definas variables de entorno. El cliente usa `/api/v1` por defecto, que es
   justo lo que necesita el rewrite.
5. Pulsa **Deploy** y copia el dominio de producción, por ejemplo
   `https://sportreserve.vercel.app`.

`frontend/vercel.json` hace lo siguiente:

- Reenvía `/api/:path*` al backend de Render sin cambiar la URL del navegador.
- Redirige las rutas de React Router (`/tasks`, `/admin/users`, etc.) a
  `index.html`, para que un refresco no devuelva 404.

También desactiva el cacheo de las respuestas de API en el CDN de Vercel. El
backend refuerza esto con `Cache-Control: no-store` en todas las rutas `/api`.

## 7. Paso 4: conectar CORS y cookies

Vuelve a Render > tu servicio > **Environment** y ajusta:

| Variable | Valor |
| --- | --- |
| `CORS_ORIGINS` | `https://sportreserve.vercel.app` (tu dominio real de Vercel) |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `true` |
| `DATABASE_URL` | Cadena pooled de Neon |
| `JWT_SECRET` | Generado por Render; no lo cambies sin motivo |

Guarda los cambios y espera el redeploy.

Reglas para `CORS_ORIGINS`:

- Debe ser el origen exacto, con `https://` y **sin barra final**.
- Si usas un dominio propio, añádelo separado por comas:
  `https://tareas.example.com,https://sportreserve.vercel.app`.
- No uses `*`: las cookies con credenciales no funcionan con comodín y el
  backend valida el origen también en `POST`, `PATCH` y `DELETE`.

Si más adelante cambias la URL de Render, actualiza el destino en
`frontend/vercel.json` y vuelve a desplegar en Vercel. El `vercel.json` no admite
variables de entorno en `destination`.

## 8. Paso 5: verificar la demo

1. Abre el dominio de Vercel.
2. Inicia sesión con `estudiante@demo.com` / `Demo12345!`.
3. Crea, edita y elimina una tarea.
4. Cierra sesión y comprueba que `/tasks` redirige a `/login`.
5. Entra con `admin@demo.com` y abre **Usuarios**.
6. Registra una cuenta nueva y verifica que aparece con rol `estudiante`.

Comprobaciones con `curl`:

```bash
# Salud del backend
curl -i https://sportreserve-api.onrender.com/health

# La API a través de Vercel: sin sesión debe dar 401 y no debe cachearse
curl -i https://sportreserve.vercel.app/api/v1/auth/me
```

En la segunda respuesta busca:

```text
HTTP/2 401
cache-control: no-store
```

Para inspeccionar la cookie de login:

```bash
curl -i -X POST https://sportreserve.vercel.app/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"estudiante@demo.com","password":"Demo12345!"}'
```

Debe aparecer una cabecera similar a:

```text
set-cookie: sr_token=...; Max-Age=7200; Path=/; HttpOnly; Secure; SameSite=Strict
```

En el navegador, abre **DevTools > Application > Cookies** y comprueba que
`sr_token` pertenece al dominio de Vercel, no al de Render.

## 9. Límites gratuitos y comportamiento esperado

| Servicio | Límite aproximado | Efecto en la demo |
| --- | --- | --- |
| Neon Free | 1 GB, 100 CU-horas/proyecto, scale-to-zero | La primera consulta tras inactividad tarda algo más |
| Render Free | 750 h/mes, 512 MB, 0.1 CPU, duerme a los 15 min | Primer acceso tras inactividad: ~1 minuto |
| Vercel Hobby | Uso personal/académico | Suficiente para la entrega |

Los límites pueden cambiar. Consúltalos antes de la presentación. Render también
puede suspender temporalmente un servicio gratuito que genere un volumen alto de
tráfico saliente (por ejemplo, consultas masivas a Neon); una demo pequeña no
debería acercarse a ese límite.

Para evitar el arranque en frío puedes usar un ping periódico, pero un servicio
despierto 24/7 consume casi todas las 750 horas mensuales de Render. Para una
entrega puntual, es mejor abrir la web unos minutos antes.

## 10. Actualizar la aplicación

- **Backend**: haz push a `main`. Render reconstruye y vuelve a ejecutar las
  migraciones. Si añades una migración nueva, se aplica sola al arrancar.
- **Frontend**: haz push a `main`. Vercel reconstruye y publica.
- **Variables**: cámbialas en el panel del servicio y fuerza un redeploy.
- **Seed**: no se ejecuta automáticamente; es intencional.

No cambies `JWT_SECRET` si no quieres invalidar todas las sesiones. Tampoco
edites una migración ya aplicada: crea una nueva.

## 11. Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `502` o `504` en la primera petición | Render estaba dormido o arrancando | Espera un minuto y reintenta; revisa logs |
| `403 CORS_NOT_ALLOWED` | Falta el dominio de Vercel en `CORS_ORIGINS` | Añade el origen exacto y redeploy |
| `403` solo en una URL de preview | El dominio de preview no está permitido | Usa el dominio de producción o añade el de preview |
| Login correcto pero la sesión no persiste | Cookie bloqueada o petición directa a Render | Usa el rewrite `/api`, `COOKIE_SECURE=true` y HTTPS |
| `password authentication failed` | `DATABASE_URL` incorrecta o contraseña rotada | Copia de nuevo la cadena de Neon |
| `relation "users" does not exist` | Las migraciones no se ejecutaron | Revisa el start command y los logs de Render |
| `too many connections` | Cadena sin pooling | Usa el host con `-pooler` de Neon |
| `404` al refrescar `/tasks` | Falta el fallback SPA | Revisa la segunda regla de `frontend/vercel.json` |
| `404` en `/api/...` | Destino de ejemplo sin sustituir | Pon la URL real de Render y redeploy |
| El deploy de Render falla en el health check | La API no conecta con Neon | Revisa `DATABASE_URL`, SSL y logs |

## 12. Alternativas gratuitas

- **Koyeb Free**: un web service de 512 MB con scale-to-zero tras una hora de
  inactividad. Se puede desplegar el `backend/Dockerfile` y usar Neon como base.
- **Oracle Cloud Always Free**: máquina ARM con 1.500 OCPU-horas y 9.000
  GB-horas al mes. Permite Docker Compose completo, pero el registro y la
  capacidad disponible requieren más paciencia.

Para este proyecto, Neon + Render + Vercel es la ruta con menos pasos y la que
mejor conserva el comportamiento de las cookies.

## 13. Checklist final

- [ ] Proyecto de Neon creado y cadena pooled copiada.
- [ ] Blueprint de Render desplegado con `DATABASE_URL`.
- [ ] `/health` devuelve `200` y `database: up`.
- [ ] Seed ejecutado y usuarios demo creados.
- [ ] `frontend/vercel.json` apunta a la URL real de Render.
- [ ] Frontend desplegado en Vercel con Root Directory `frontend`.
- [ ] `CORS_ORIGINS` contiene el dominio exacto de Vercel.
- [ ] Login, CRUD, administración y logout probados desde el dominio de Vercel.
- [ ] Cookie `sr_token` visible en el dominio de Vercel con `HttpOnly`, `Secure`
      y `SameSite=Strict`.
- [ ] `/api/v1/auth/me` responde `401` sin sesión y `Cache-Control: no-store`.
