# Plan de trabajo para 3 integrantes

## 1. Punto de partida

El repositorio contiene una versión funcional del proyecto. Este plan distribuye
la **revisión, apropiación, mejora y presentación** del trabajo entre tres
personas, con tareas concretas y criterios de aceptación. Los nombres son
marcadores: reemplácelos por los integrantes reales.

| Rol | Integrante | Frente principal | Horas estimadas |
| --- | --- | --- | --- |
| A | Oscar | Backend, base de datos y seguridad | ~23 h |
| B | Denis | Frontend, UX y demo | ~19 h |
| C | Luis | QA, DevOps, CI y documentación | ~22 h |

Las horas son estimaciones para planificación; se ajustan en la primera reunión.

## 2. Reparto de tareas

### Hito 0 — Preparación (semana 1)

| ID | Tarea | Responsable | Apoyo | Horas | Depende de | Entregable |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | Crear repositorio, invitar colaboradores, ramas `main`/`develop`, tablero y etiquetas | C | — | 2 | — | Repo configurado y tablero visible |
| T02 | Verificar entorno local, crear `.env`, migrar y sembrar la base | A | C | 2 | T01 | App corriendo en local |
| T03 | Verificar Docker Compose, puertos y healthchecks | C | A | 3 | T01 | `docker compose up` documentado |
| T04 | Revisar esquema, migraciones, checksums y seed | A | C | 3 | T02 | Esquema validado |

**Criterio de salida del hito:** los tres integrantes clonan el repo, ejecutan
la app y pueden iniciar sesión con los usuarios demo.

### Hito 1 — Backend y seguridad (semana 2)

| ID | Tarea | Responsable | Apoyo | Horas | Depende de | Entregable |
| --- | --- | --- | --- | --- | --- | --- |
| T05 | Revisar registro, login, logout, JWT y cookie | A | C | 4 | T04 | Checklist de auth firmado |
| T06 | Revisar RBAC, CRUD de tareas, filtros y paginación | A | C | 5 | T05 | Reglas de acceso verificadas |
| T10 | Ejecutar y ampliar pruebas de API | A | C | 4 | T06 | Suite backend verde |
| T11 | Ejecutar y ampliar pruebas de seguridad (IDOR, SQLi, XSS, RBAC) | C | A | 4 | T06 | Suite de seguridad verde |

**Criterio de salida:** `npm test` y `npm run lint` pasan en backend; cada regla
de rol tiene al menos una prueba.

### Hito 2 — Frontend y administración (semana 3)

| ID | Tarea | Responsable | Apoyo | Horas | Depende de | Entregable |
| --- | --- | --- | --- | --- | --- | --- |
| T07 | Revisar cliente API, contexto de sesión y rutas protegidas | B | A | 3 | T05 | Navegación por rol validada |
| T08 | Revisar dashboard de tareas, filtros, paginación y formularios | B | A | 4 | T06 | CRUD usable en navegador |
| T09 | Revisar administración de usuarios, responsive y accesibilidad | B | C | 3 | T06 | Pantalla admin validada |
| T12 | Ejecutar y ampliar pruebas de frontend + XSS | B | C | 3 | T08 | Suite frontend verde |

**Criterio de salida:** `npm run lint`, `npm test` y `npm run build` pasan en
frontend; los tres roles se probaron manualmente en escritorio y móvil.

### Hito 3 — Calidad, CI y documentación (semana 4)

| ID | Tarea | Responsable | Apoyo | Horas | Depende de | Entregable |
| --- | --- | --- | --- | --- | --- | --- |
| T13 | Revisar CI de GitHub Actions y builds Docker | C | B | 3 | T10-T12 | CI verde en `develop` |
| T14a | Revisar README y guía de contribución | B | C | 2 | T13 | README reproducible |
| T14b | Revisar referencia API y secciones backend/seguridad de la memoria | A | C | 4 | T13 | Docs técnicas completas |
| T14c | Revisar pruebas, despliegue y matriz de requisitos | C | A | 4 | T13 | Docs de calidad completas |

**Criterio de salida:** un tercero puede clonar el repo y ejecutar la app
siguiendo solo el README, tanto con Docker como sin Docker.

### Hito 4 — Cierre y entrega (semana 5)

| ID | Tarea | Responsable | Apoyo | Horas | Depende de | Entregable |
| --- | --- | --- | --- | --- | --- | --- |
| T15 | Preparar guion de demo y datos de prueba | B | todos | 2 | T09 | Guion de 10–15 min |
| T16 | Revisión cruzada, corrección final, tag `v1.0.0` | A | todos | 2 | T14 | Release y entrega |

**Criterio de salida:** demo ensayada, CI verde en `main`, tag `v1.0.0` y
repositorio público o compartido con el docente.

## 3. Extensiones opcionales

Si sobra tiempo o se solicita un valor adicional:

| ID | Extensión | Responsable sugerido | Horas |
| --- | --- | --- | --- |
| E01 | Recuperación de contraseña con token de un solo uso | A | 8 |
| E02 | Perfil y cambio de contraseña | A + B | 6 |
| E03 | Filtro por dueño para docentes y exportación CSV | A + B | 6 |
| E04 | Auditoría de cambios de tareas | C + A | 8 |
| E05 | Despliegue en Neon + Render/Railway | C | 5 |

Cada extensión debe entrar por una rama `feature/*`, con pruebas y PR.

## 4. Flujo Git

### Ramas

```text
main        ← entregable estable (protegida)
develop     ← integración (protegida)
feature/*   ← funcionalidad
fix/*       ← correcciones
docs/*      ← documentación
```

### Ciclo de trabajo

```bash
git switch develop
git pull origin develop
git switch -c feature/mi-tarea

# Trabajar, probar y commitear
git add .
git commit -m "feat(tasks): agregar filtro por estado"

git push -u origin feature/mi-tarea
```

Luego abrir un Pull Request hacia `develop`, solicitar revisión a otro
integrante y fusionar cuando la CI esté verde. Al cerrar un hito, se abre un PR
de `develop` hacia `main`.

### Convención de commits

| Prefijo | Uso |
| --- | --- |
| `feat` | Nueva funcionalidad |
| `fix` | Corrección |
| `test` | Pruebas |
| `docs` | Documentación |
| `refactor` | Reestructuración sin cambio funcional |
| `chore` | Configuración, dependencias, CI |
| `style` | Formato sin cambio lógico |

Ejemplos:

```text
feat(tasks): permitir filtrar por estado
fix(auth): invalidar sesión de usuario inactivo
test(security): cubrir intento de IDOR
docs(deploy): documentar variables de producción
```

### Reglas de Pull Request

- Título claro y referencia al issue (`Closes #12`).
- Descripción con qué cambia y cómo probarlo.
- Al menos una aprobación de otro integrante.
- CI verde.
- Sin `.env`, secretos ni `node_modules`.
- Rama actualizada con `develop` antes de fusionar.

## 5. Configuración del repositorio en GitHub

Como el entorno actual no tiene `gh` instalado, se puede hacer desde la web.

### 5.1 Crear el repositorio

1. Entrar a GitHub → **New repository**.
2. Nombre sugerido: `sportreserve-tasks`.
3. Visibilidad: privado (o público si el docente lo permite).
4. **No** marcar “Add a README”, “Add .gitignore” ni “Choose a license”
   (el proyecto ya los tiene).
5. Crear el repositorio.

### 5.2 Subir el proyecto

```bash
cd /ruta/al/proyecto
git init
git add .
git commit -m "chore: versión inicial del proyecto de tareas"
git branch -M main
git remote add origin https://github.com/<usuario>/sportreserve-tasks.git
git push -u origin main

git switch -c develop
git push -u origin develop
```

Si se usa SSH:

```bash
git remote add origin git@github.com:<usuario>/sportreserve-tasks.git
```

### 5.3 Invitar a los integrantes

**Settings → Collaborators → Add people**. Cada integrante acepta la invitación
por correo o desde GitHub.

### 5.4 Proteger ramas

**Settings → Branches → Add branch protection rule**:

- Rama `main`: exigir Pull Request, al menos 1 aprobación y CI verde.
- Rama `develop`: exigir Pull Request y CI verde.

### 5.5 Etiquetas sugeridas

Crear en **Issues → Labels**:

`backend`, `frontend`, `seguridad`, `qa`, `devops`, `docs`, `tarea`, `bug`,
`prioridad-alta`.

### 5.6 Crear las tareas

Para cada fila de la tabla:

1. **Issues → New issue → Tarea de equipo**.
2. Título: `T05 Revisar autenticación JWT`.
3. Pegar objetivo, criterios de aceptación y dependencias.
4. Asignar al responsable.
5. Agregar etiqueta y añadirlo al tablero.

También se puede usar GitHub Projects con columnas:

```text
Backlog → Por hacer → En curso → En revisión → Hecho
```

### 5.7 Comandos opcionales con GitHub CLI

Si más adelante se instala `gh` y se autentica:

```bash
gh auth login
gh repo create sportreserve-tasks --private --source=. --remote=origin --push
gh api -X PUT repos/:owner/:repo/collaborators/<usuario> -f permission=push
```

## 6. Reuniones y comunicación

| Reunión | Duración | Objetivo |
| --- | --- | --- |
| Kickoff | 45 min | Repartir tareas, acordar horarios y Definition of Done |
| Semanal | 20 min | Revisar tablero, bloqueos y CI |
| Revisión de PR | 15 min | Revisar código y pruebas |
| Ensayo de demo | 30 min | Probar guion y tiempos |

Canales sugeridos: un grupo de mensajería para el día a día y GitHub Issues
para decisiones que deban quedar registradas.

## 7. Definition of Done

Una tarea está terminada cuando:

- [ ] Cumple todos sus criterios de aceptación.
- [ ] Tiene pruebas nuevas o actualizadas cuando cambia el comportamiento.
- [ ] `npm run lint` y `npm test` pasan en el área afectada.
- [ ] El build del frontend pasa si se tocó la interfaz.
- [ ] La documentación relevante está actualizada.
- [ ] El PR fue revisado y aprobado por otro integrante.
- [ ] La CI está verde.
- [ ] No se agregaron secretos ni archivos generados.

## 8. Guion de demo (10–15 minutos)

| Minuto | Quién | Contenido |
| --- | --- | --- |
| 0–2 | A | Problema, alcance y arquitectura |
| 2–5 | A | Registro, login, cookie y control de acceso |
| 5–8 | B | Demo de tareas: crear, filtrar, editar y eliminar |
| 8–10 | B | Demo de administración de roles y diferencias entre roles |
| 10–12 | C | Pruebas, seguridad y CI |
| 12–14 | C | Docker, despliegue y documentación |
| 14–15 | Todos | Conclusiones y preguntas |

Datos recomendados para la demo:

- Estudiante: `estudiante@demo.com` / `Demo12345!`
- Docente: `docente@demo.com` / `Demo12345!`
- Administrador: `admin@demo.com` / `Demo12345!`

## 9. Riesgos de coordinación

| Riesgo | Acción preventiva |
| --- | --- |
| Dos personas editan el mismo archivo | Ramas cortas y PR pequeños |
| Dependencias entre tareas | Respetar el orden de los hitos |
| CI roja por prisa | Ejecutar lint y pruebas antes del push |
| Docker no funciona en el aula | Ensayar la demo también en local |
| Falta de tiempo para docs | Documentar en cada PR, no al final |
| Pérdida de trabajo | Push diario y ramas respaldadas en GitHub |
