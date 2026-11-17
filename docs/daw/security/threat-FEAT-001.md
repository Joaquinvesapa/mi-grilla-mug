# Threat model FEAT-001: Plataforma base de Mi Grilla

| Field | Value |
|-------|-------|
| Ticket | FEAT-001 |
| Spec | docs/daw/specs/spec-FEAT-001.md |
| Tier | FEATURE |
| Date | 2026-11-16 |

## Components
| Component | Source in the spec |
|---|---|
| `src/app/layout.tsx` + `src/app/page.tsx` | Block 2 |
| `src/app/api/health/route.ts` + `src/server/health.ts` | Block 3 |
| `src/server/db.ts` | Block 3 |
| `src/app/sw.ts` + `src/app/serwist/[path]/route.ts` | Block 4 |
| `src/app/demo/page.tsx` + headers de `next.config.ts` | Block 5 |
| `.github/workflows/ci.yml` | Block 6 |

## Trust boundaries
- Navegador → servidor Next.js: páginas (`/`, `/~offline`, `/demo`) y `GET /api/health`, que se
  pueden pedir sin autenticación desde internet.
- Servidor Next.js → PostgreSQL: `src/server/db.ts` abre la conexión con `DATABASE_URL`. Es la única
  puerta a la base.
- Página → service worker: el SW intercepta navegaciones y sirve contenido desde la Cache Storage
  del dispositivo.
- Página padre `/demo` → iframe con `/`: mismo origen. Cualquier otro origen que intente embeber la
  app queda del lado no confiable.
- GitHub (pull request, posiblemente desde un fork) → runner de GitHub Actions: código no confiable
  que corre en la CI.
- Máquina del desarrollador → repositorio: `.env` con credenciales que no tiene que cruzar a git.

## STRIDE analysis
### `src/app/layout.tsx` + `src/app/page.tsx`
- **Spoofing:** no hay identidad en FEAT-001. Ninguna pantalla depende de quién es el usuario.
- **Tampering:** contenido estático renderizado en el servidor. No hay parámetros de entrada que se
  reflejen en la página.
- **Repudiation:** no hay acciones del usuario que registrar en FEAT-001.
- **Information Disclosure:** la página no muestra datos internos. La marca es propia, sin assets
  de terceros.
- **Denial of Service:** las páginas son estáticas y cacheables. No consultan la base.
- **Elevation of Privilege:** no hay roles ni áreas privadas en FEAT-001.

### `src/app/api/health/route.ts` + `src/server/health.ts`
- **Spoofing:** el endpoint es público por diseño (FR-04) y no confía en ningún encabezado del
  cliente.
- **Tampering:** solo atiende `GET` y no recibe parámetros. Cualquier otro método devuelve 405.
- **Repudiation:** cada fallo de la base se registra en el log del servidor con hora y un código de
  error genérico (`DB_UNREACHABLE` / `DB_TIMEOUT`), sin la cadena de conexión (R-07).
- **Information Disclosure:** la respuesta es solo `{status, database}` con valores fijos. Ni el
  mensaje de error, ni el host, ni el usuario, ni la versión de Postgres salen al cliente (R-01, AC-05).
- **Denial of Service:** cada pedido ejecuta `SELECT 1`. Un flood podría agotar el pool. Se mitiga
  con un timeout de 800 ms, un pool chico y el resultado memorizado 2 s por instancia (R-02).
- **Elevation of Privilege:** la consulta es fija (`SELECT 1`), sin entrada del usuario: no hay
  inyección SQL posible.

### `src/server/db.ts`
- **Spoofing:** un `DATABASE_URL` que apunte a un host ajeno haría que la app hable con una base
  falsa. La variable solo se lee del entorno del servidor, nunca del cliente.
- **Tampering:** un `DATABASE_URL` no local sin TLS permitiría alterar el tráfico. `db.ts` rechaza
  al arrancar cualquier host que no sea loopback ni el servicio de la CI si no trae
  `sslmode=require` (R-04).
- **Repudiation:** los errores de conexión se registran con código genérico (R-07).
- **Information Disclosure:** `DATABASE_URL` nunca se importa desde código cliente. Las capas lo
  impiden: `app/` y `components/` no importan `src/server/` desde componentes cliente, y el módulo
  lleva `import "server-only"` (R-03).
- **Denial of Service:** un solo `PrismaClient` por proceso (singleton) evita abrir conexiones de
  más en desarrollo con recarga en caliente.
- **Elevation of Privilege:** el usuario de la base en local y en la CI es de pruebas. En FEAT-001
  no hay deploy, así que no hay usuario de producción.

### `src/app/sw.ts` + `src/app/serwist/[path]/route.ts`
- **Spoofing:** el SW se sirve desde el mismo origen (`/serwist/sw.js`) con alcance `/`. Un script
  de otro origen no puede registrarse en su lugar.
- **Tampering:** un SW viejo o envenenado podría seguir sirviendo contenido. El precache está
  versionado por el manifiesto que genera Serwist en cada build, y `skipWaiting` + `clientsClaim`
  reemplazan la versión anterior (R-05).
- **Repudiation:** no aplica. El SW no hace acciones del usuario.
- **Information Disclosure:** el SW no cachea respuestas de `/api/*` ni nada de fuera del origen.
  En FEAT-001 solo precachea `/~offline` y los assets estáticos del build (R-06). La única ruta de
  `runtimeCaching` es `NetworkOnly` para navegaciones del mismo origen fuera de `/api/`. Existe
  solo para que `fallbacks` sirva `/~offline` y no guarda ninguna respuesta en Cache Storage, así
  que no hay HTML de un usuario cacheado que otro pueda leer.
- **Denial of Service:** un SW roto podría dejar la app sin cargar. Ante un fallo de red, la
  navegación cae en `/~offline`. Un build nuevo reemplaza al SW.
- **Elevation of Privilege:** el SW no tiene más permisos que la página. No pide permisos de
  notificaciones ni de sincronización en FEAT-001.

### `src/app/demo/page.tsx` + headers de `next.config.ts`
- **Spoofing:** un sitio ajeno podría embeber la app y hacerse pasar por ella (clickjacking). Todas
  las rutas responden con `X-Frame-Options: SAMEORIGIN` y `Content-Security-Policy: frame-ancestors
  'self'` (R-08).
- **Tampering:** `/demo` no usa `postMessage` en FEAT-001. Padre e iframe no intercambian datos.
- **Repudiation:** no aplica. `/demo` no hace acciones.
- **Information Disclosure:** el iframe carga `/` del mismo origen. No embebe contenido de terceros.
- **Denial of Service:** la página es estática.
- **Elevation of Privilege:** el iframe no recibe `allow` de permisos extra (cámara, ubicación).

### `.github/workflows/ci.yml`
- **Spoofing:** un PR desde un fork corre código no confiable. Se usa el evento `pull_request`, no
  `pull_request_target`, así que corre sin acceso a secretos del repo (R-09).
- **Tampering:** una action de terceros comprometida podría alterar el build. Las actions se fijan
  por SHA de commit (R-10).
- **Repudiation:** cada corrida queda registrada en GitHub Actions, con el commit y el autor.
- **Information Disclosure:** el workflow no usa secretos. La contraseña de Postgres de la CI es de
  un contenedor efímero que solo vive en el runner.
- **Denial of Service:** `timeout-minutes` por job y `concurrency` con `cancel-in-progress`
  cortan corridas colgadas o repetidas (NFR-04).
- **Elevation of Privilege:** el `GITHUB_TOKEN` corre con `permissions: contents: read` (R-09).

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| `DATABASE_URL` (usuario y contraseña de Postgres) | credentials | Solo en `.env` local, que está en `.gitignore`. En el repo va `.env.example` sin valores reales. En la CI es una credencial de prueba de un contenedor efímero. No se cifra en el disco del desarrollador, que queda protegido por sus permisos de usuario | Sin TLS solo sobre loopback (127.0.0.1, puerto de docker compose atado a 127.0.0.1) y sobre la red interna del runner. Cualquier host no local exige TLS (`sslmode=require`), y `db.ts` lo verifica al arrancar (R-04) |
| Respuesta de `/api/health` (`status`, `database`) | public | No se guarda | HTTPS cuando haya deploy (fuera de alcance). En local, HTTP |
| Assets precacheados por el SW (`/~offline`, JS/CSS del build) | public | Cache Storage del dispositivo | Mismo origen |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | `/api/health` filtra el error de Postgres, el host o la cadena de conexión | I | M | H | Respuesta con valores fijos `{status, database}`, sin mensaje de error. El test unitario y el de integración verifican que el body caído no contiene el host, el usuario ni el texto del error (AC-05) |
| R-02 | Un flood a `/api/health` agota el pool de conexiones | D | M | M | Timeout de 800 ms, pool de Prisma chico (`max` 5) y resultado memorizado 2 s por instancia |
| R-03 | `DATABASE_URL` o el cliente Prisma terminan en el bundle del navegador | I | L | H | `import "server-only"` en `src/server/db.ts` y `src/server/health.ts`, y regla de capas en AGENTS.md: solo `src/server/` importa Prisma |
| R-04 | Conexión a una base remota sin TLS | T | L | H | `db.ts` rechaza al arrancar un host no loopback ni `postgres` (servicio de la CI) sin `sslmode=require`. Lo cubre un test unitario |
| R-05 | Un service worker viejo sigue sirviendo contenido de un build anterior | T | M | M | Precache versionado por Serwist, `skipWaiting` + `clientsClaim`, y limpieza de cachés viejas |
| R-06 | El SW cachea respuestas que no debería, como datos de la API | I | L | M | Sin runtime caching de `/api/*` ni de otros orígenes en FEAT-001. Solo precache de `/~offline` y estáticos. La única ruta de runtime es `NetworkOnly` para navegaciones del mismo origen fuera de `/api/`, sin caché. Un E2E verifica que offline `/api/health` falla por red y que Cache Storage no guarda URLs de `/api/` ni de otros orígenes |
| R-07 | Logs del servidor con la cadena de conexión | I | L | H | Se loguea solo el código genérico (`DB_UNREACHABLE` / `DB_TIMEOUT`), nunca `error.message` de Prisma |
| R-08 | Clickjacking: otro sitio embebe la app | S | M | M | `X-Frame-Options: SAMEORIGIN` y `Content-Security-Policy: frame-ancestors 'self'` en todas las rutas. Un test E2E verifica los headers |
| R-09 | Un PR desde un fork ejecuta código con acceso a secretos o con un token con escritura | E | L | H | Evento `pull_request` (nunca `pull_request_target`), sin secretos en el workflow, `permissions: contents: read` |
| R-10 | Una GitHub Action de terceros comprometida altera la CI | T | L | H | Actions fijadas por SHA de commit, con la versión en un comentario |
| R-11 | Una dependencia npm comprometida o una versión inesperada | T | M | H | `pnpm install --frozen-lockfile` en la CI, versiones exactas en `package.json` y el lockfile commiteado |
| R-12 | Las skills de terceros en `.agents/skills/` traen scripts y un hook `Stop` que corre `node` | E | L | M | No están en `.claude/skills/`, así que el harness no las carga ni ejecuta sus hooks. Se usan solo como guías de lectura. Están fijadas por hash en `skills-lock.json`, y el build, el lint y el formato las excluyen |

## Supply chain
FEAT-001 agrega todas las dependencias del scaffold, con versiones exactas y el lockfile commiteado:

- **Framework y UI:** next 16.4.6, react 19.3, tailwindcss 4.3, shadcn 4.23 (que suma `clsx` y
  `tailwind-merge`).
- **Base de datos:** prisma, @prisma/client y @prisma/adapter-pg 7.10.1, más `pg` y `dotenv`. Se
  usa Prisma 7.10.1 y no la 8.0.0-rc, que npm marca como "latest" aunque es una release candidate.
- **PWA:** serwist y @serwist/turbopack 9.5.15, con `esbuild`. Se subió desde la 9.5.14 en el
  cierre de CODE para cerrar GHSA-3g3m-2fjr-6pw4 (`glob`) y GHSA-g3hv-75wg-m249 (`minimatch`), con
  excepciones puntuales por versión exacta a la ventana de antigüedad de pnpm.
- **Tests:** vitest 5.1 y playwright 1.65.
- **Calidad de código:** typescript 7.0.2, oxlint 1.94, oxlint-tsgolint 7.0 y oxfmt 0.79.

Riesgos y controles:
- **R-11** cubre la instalación desde el lockfile.
- **R-10** cubre las actions de la CI.
- **R-12** cubre las skills de terceros, que no forman parte de la app.
- El escaneo SAST del CODE revisa el código propio.

## Availability
- **`/api/health`:** el vector de DoS que toca este ticket es el health check, y R-02 lo cubre.
- **Páginas:** son estáticas y no consultan la base.
- **Volumen:** FEAT-001 no tiene deploy público, así que los ataques volumétricos quedan fuera de
  alcance. Se revisa en el ticket que despliegue la app.
- **CI:** los timeouts por job evitan que una corrida colgada bloquee los PRs.
