# Guía de contribución

## Requisitos previos

- Node.js 22+
- PostgreSQL 15+ (o Docker)
- Git

## Puesta en marcha

Sigue el [README](README.md). Para el backend necesitas `backend/.env`; para el
frontend, `frontend/.env`. Ninguno de los dos se sube al repositorio.

## Ramas

| Rama | Uso |
| --- | --- |
| `main` | Versión estable / entregable |
| `develop` | Integración del equipo |
| `feature/<tema>` | Nueva funcionalidad |
| `fix/<tema>` | Corrección de errores |
| `docs/<tema>` | Documentación |

Ejemplo:

```bash
git switch develop
git pull
git switch -c feature/filtro-tareas
```

## Commits

Usamos Conventional Commits en español o inglés, de forma consistente:

```text
feat(tasks): agregar filtro por estado
fix(auth): invalidar sesión de usuario inactivo
test(security): cubrir intento de IDOR
docs(readme): documentar despliegue con Docker
chore(ci): ejecutar pruebas del frontend
```

## Antes de abrir un Pull Request

```bash
cd backend && npm run lint && npm test
cd ../frontend && npm run lint && npm test && npm run build
```

- Actualiza tu rama con `develop`.
- Verifica que no se incluya `.env` ni secretos.
- Agrega pruebas cuando cambie el comportamiento.
- Completa la plantilla del PR y solicita revisión a otro integrante.

## Estilo de código

- Backend CommonJS, módulos por dominio y SQL parametrizado.
- Frontend con componentes funcionales y hooks.
- Mensajes de interfaz y documentación en español.
- Nombres de variables, funciones y tablas en inglés; textos visibles en español.

## Reporte de errores

Usa la plantilla de issue **Reporte de error** e incluye pasos de reproducción,
entorno y evidencia sin datos sensibles.
