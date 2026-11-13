# SportReserve Tasks — Frontend

Interfaz React + Vite para la API de gestión de tareas.

## Desarrollo

```bash
npm ci
cp .env.example .env
npm run dev
```

El frontend queda en `http://localhost:5173` y hace proxy de `/api` hacia
`http://localhost:3000` (backend local).

## Pruebas y calidad

```bash
npm test
npm run lint
npm run build
```

Las pruebas incluyen la renderización segura de contenido ingresado por
usuarios (XSS): React debe mostrar el texto y nunca interpretarlo como HTML.

## Docker

El `Dockerfile` tiene tres etapas:

- `development`: Vite con hot reload.
- `build`: compila la aplicación.
- `production`: Nginx sirve el build y hace proxy de `/api` al backend.

La guía completa está en el `README.md` de la raíz.
