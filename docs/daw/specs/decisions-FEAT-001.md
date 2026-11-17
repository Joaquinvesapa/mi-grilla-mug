# Decisiones de implementación — FEAT-001

Supuestos y decisiones tomadas durante CODE que la spec no fijaba. Formato: decisión — quién la
aprobó — fecha — bloque.

## Block 1 — Scaffold y calidad local

- `pnpm-workspace.yaml` con `minimumReleaseAgeExclude` para oxlint 1.94.0, oxfmt 0.79.0 y sus
  bindings nativos (publicados el 2026-11-16): sin la excepción, pnpm 12 rechaza el lockfile con
  `--frozen-lockfile`. Excepción puntual por versión exacta; se retira cuando esas versiones superen
  la ventana de antigüedad. — usuario — 2026-11-16 — Block 1
- `agentRules: false` en `next.config.ts`: `next dev` escribía un bloque de instrucciones para
  agentes dentro de `AGENTS.md` en cada arranque. — usuario — 2026-11-16 — Block 1
- `no-restricted-imports` con patrones más amplios que los literales de la spec (`@prisma/**`,
  `@/server/generated(/**)`, `**/server/generated(/**)`, `**/generated/prisma(/**)`), para cubrir
  subrutas e imports relativos; `typescript/no-explicit-any` en error. — usuario — 2026-11-16 —
  Block 1
- `typecheck` = `next typegen && tsc --noEmit`, para que funcione en un clon limpio y en la CI sin
  `.next/`. — usuario — 2026-11-16 — Block 1
- `.gitignore` con `.env*` + `!.env.example` (en lugar de `.env` + `.env*.local`). — usuario —
  2026-11-16 — Block 1
- oxfmt ignora además `AGENTS.md` y `CLAUDE.md` (formateaba dentro de los bloques DAW) y ordena las
  clases de Tailwind (`sortTailwindcss`, como prevé ADR-001). — usuario — 2026-11-16 — Block 1
- Variables de shadcn que la spec no mapeaba: card/popover-foreground = text, secondary = overlay,
  muted = overlay, accent = highlight-low, `--warning` = gold, `--radius` 0.625rem. El color de
  `--accent` se revisa en el Block 2 (hoy casi no se distingue del fondo). — usuario — 2026-11-16 —
  Block 1
- `components.json` escrito a mano (sin `shadcn init`) para que la CLI no pise `globals.css` con su
  paleta ni agregue `tw-animate-css`. — usuario — 2026-11-16 — Block 1
- Los scripts `test:integration`, `test:e2e` y `db:*`, y las dependencias de los Blocks 2 a 6
  (Radix, Prisma, Serwist, Playwright, yaml…), llegan con su bloque y con la versión fijada en la
  spec. — usuario — 2026-11-16 — Block 1

## Block 2 — Inicio y shell nativo

- E2E de WebKit (perfil iPhone) con `pnpm test:e2e:docker` en la imagen oficial
  `mcr.microsoft.com/playwright:v1.65.1-noble` (`scripts/test-e2e-docker.sh`, carpeta nueva
  `scripts/`): el host Arch no tiene las bibliotecas de WebKit. Volúmenes con nombre para
  `node_modules`/`.next`, corre con el uid del host, `--ipc=host` (recomendado por Playwright para
  Chromium). La imagen está fijada por tag, no por digest. — usuario — 2026-11-17 — Block 2
- `--accent` = highlight-med (#403d52): highlight-low casi no se distinguía del fondo. — usuario —
  2026-11-17 — Block 2
- `Button`: solo tamaños ≥ 44 px (`default`, `lg`, `icon`, `icon-lg`); `destructive` con token
  nuevo `--destructive-foreground` = base. Escala de radios extendida con `--radius-2xl`
  (`--radius` + 8px), solo para la silueta del teléfono. Hovers bajo `(hover: hover) and
  (pointer: fine)`. — usuario — 2026-11-17 — Block 2
- `shadcn add` (CLI 4.23.0) había instalado los paquetes npm `cn` y `radix-ui` con caret: se
  quitaron y los imports apuntan a `@/lib/utils` y a `@radix-ui/react-*`. Cada `shadcn add` futuro
  se revisa. — usuario — 2026-11-17 — Block 2
- Naming: constantes de módulo inmutables en SCREAMING_SNAKE_CASE. Paleta Rosé Pine (neutros con
  tinte violeta) prevalece sobre el "sin violeta" de design-taste para fondos y neutros. — usuario —
  2026-11-17 — Block 2
- Pendientes registrados (no se resuelven en este bloque): (a) la regla `user-select`/
  `-webkit-touch-callout: none` alcanza también a `a` porque la spec lo pide; revisar cuando
  aparezca el primer link dentro de texto; (b) inputs a 16 px e `interactive-widget` llegan con el
  PRD 02, el primero con formularios; (c) el test de AC-18 pasa también por el preflight de
  Tailwind; (d) el test de NFR-07 mide con puntero `mouse`: el camino táctil se verifica en el
  iPhone real en VERIFY. — usuario — 2026-11-17 — Block 2

## Block 3 — Base de datos y chequeo de salud

- `GET /api/health`: todo método que no sea GET, HEAD y OPTIONS incluidos, responde `405` con
  `Content-Type: application/json`, body `{"error":"METHOD_NOT_ALLOWED"}`, `Allow: GET` y
  `Cache-Control: no-store` (cumple el "siempre `application/json`" del contrato; permitir HEAD
  habría cambiado la spec). En HEAD llegan el status y los headers, pero no el body: Node lo
  descarta en toda respuesta a HEAD. — usuario — 2026-11-17 — Block 3
- `assertSafeDatabaseUrl` acepta `postgresql://` y también `postgres://`, con las mismas reglas de
  TLS. Remoto exige `sslmode` `require`, `verify-ca` o `verify-full`. — usuario — 2026-11-17 —
  Block 3
- Una `DATABASE_URL` ausente (`MissingDatabaseUrlError`, `DATABASE_URL_MISSING`) o insegura
  (`UnsafeDatabaseUrlError`) se detecta al crear el cliente en el primer pedido (`getDb()`), no al
  arrancar el proceso: la app levanta y `/api/health` responde 500 con cuerpo vacío, sin filtrar
  la URL. Así `next start` y los E2E funcionan sin base. — usuario — 2026-11-17 — Block 3
- Cierre del bypass de R-04: `?host=`, `?hostaddr=` y un `sslmode` repetido se rechazan con
  `INVALID_URL` con cualquier host, porque `pg-connection-string` 2.14.1 prioriza `?host=` sobre la
  autoridad y usa el último `sslmode`. — revisión del Block 3 (module-verifier) — 2026-11-17 —
  Block 3
- `allowBuilds` en `pnpm-workspace.yaml` solo para `prisma` y `@prisma/engines`: pnpm 12 bloquea
  sus scripts de instalación (`ERR_PNPM_IGNORED_BUILDS`), y el de engines descarga el schema-engine
  que usa `migrate`. — usuario — 2026-11-17 — Block 3
- Agregados fuera de la spec: `disconnectDb()` en `src/server/db.ts` (cierra el pool y resetea el
  singleton; hoy solo lo usan los tests de integración), el log `DB_POOL_ERROR` del `onPoolError`
  del adapter (sin él se descartaban en silencio los errores de conexiones ociosas), el singleton
  en `globalThis` con `Symbol.for("mi-grilla.db")` por la recarga en caliente y `force-dynamic` en
  la route. — usuario — 2026-11-17 — Block 3
- La caché de 2 s guarda tanto `up` como `down`, cuenta desde el inicio del check, y los checks
  simultáneos comparten el probe en curso. Formato de log: `[health] DB_TIMEOUT at=<ISO>`. —
  usuario — 2026-11-17 — Block 3
- Tests: alias `server-only` → `server-only/empty.js` en `vitest.config.ts`, solo para los tests.
  `src/server/db.ts` queda fuera de la cobertura unitaria y lo cubre la integración. La
  integración llama a `GET()`/`POST()` del módulo de la route, sin servidor HTTP, con un puerto
  efímero cerrado para el caso 503. El camino HTTP real (routing, `force-dynamic`, HEAD) se cubre
  con un E2E en el Block 6. — usuario — 2026-11-17 — Block 3
- Dependencias: `prisma`, `dotenv` y `@types/pg` en dev; `@prisma/client`, `@prisma/adapter-pg` y
  `pg` en runtime. Scripts `db:up` (`docker compose up -d --wait`), `db:down`, `db:generate` y
  `db:migrate` (`prisma migrate deploy`). — usuario — 2026-11-17 — Block 3
- Pendientes registrados (no se resuelven en este bloque): (a) el pool de `pg` no tiene
  `connectionTimeoutMillis`; definirlo antes de las consultas reales del PRD 02; (b) la imagen
  `postgres:17` es un tag de major flotante (así lo dice la spec); fijar el minor junto con el
  servicio de la CI en el Block 6; (c) `PRISMA_HIDE_UPDATE_MESSAGE=1` en la CI (Block 6); (d) la
  tabla Testing de `AGENTS.md` y el README (usuario `mi_grilla` del compose frente al placeholder
  `USER` de `.env.example`) se actualizan en el Block 6; (e) los errores de configuración se
  lanzan en lugar de devolverse como resultado tipado: excepción a la convención de `src/server/`
  para errores de arranque; (f) el mensaje de `INVALID_URL` todavía dice "postgresql://" aunque se
  acepta `postgres://`; (g) con `?uselibpqcompat=true`, `sslmode=require` cifra sin verificar el
  certificado (semántica libpq, coherente con la spec): evaluar rechazar el parámetro antes del
  deploy. — usuario — 2026-11-17 — Block 3

## Block 4 — PWA instalable y pantalla sin conexión

- Corrección de la spec, que obligó a volver a PLAN: en serwist 9.5.14 `fallbacks` solo se engancha
  a `runtimeCaching`, así que `sw.ts` lleva una única ruta `NetworkOnly` para navegaciones del mismo
  origen fuera de `/api/`, sin caché (commit `8b06ef7`, Spec loops 2). — usuario — 2026-11-17 —
  Block 4
- `createSerwistRoute` con `useNativeEsbuild: true`: sin esa opción, en Linux usa `esbuild-wasm`,
  que no está instalado. La spec fija `esbuild`. No se usa `withSerwist` en `next.config.ts`
  (`@serwist/turbopack` importa `esbuild` con `webpackIgnore`). — usuario — 2026-11-17 — Block 4
- `allowBuilds` en `pnpm-workspace.yaml` con `@swc/core: false` y `esbuild: false` (denegados):
  pnpm 12 corta la instalación con `ERR_PNPM_IGNORED_BUILDS`. `esbuild` funciona sin su postinstall
  (toma el binario de `@esbuild/<plataforma>`, que va en `optionalDependencies`) y el `dist/` de
  `@serwist/turbopack` no importa `@swc/core`. Riesgo residual: con `--no-optional`, esbuild queda
  sin binario. — usuario — 2026-11-17 — Block 4
- `globPatterns` = los de Serwist más `woff2`, para precachear Public Sans. Lo verifica un E2E sobre
  Cache Storage (`/~offline`, `.css` y `.woff2`). `/~offline` lleva una revisión `randomUUID()` por
  build. — usuario — 2026-11-17 — Block 4
- `SerwistProvider` con `cacheOnNavigation={false}` (R-06), `disable` fuera de producción
  (ADR-002) y `reloadOnOnline={false}`: la recarga por defecto recargaba cualquier pantalla al
  volver la señal, y en el PRD 02 tiraría los cambios pendientes. Solo `/~offline` se recarga sola
  (`OfflineRetry`, el único `"use client"` de esa pantalla). "Reintentar" recarga la URL que falló,
  no `/`. — usuario — 2026-11-17 — Block 4
- `/// <reference lib="webworker" />` en `sw.ts` (lo recomienda Serwist): suma los tipos de
  webworker a todo el programa de `tsc`, y `skipLibCheck: true` tapa los choques entre `dom` y
  `webworker`. Si molesta, la alternativa es un tsconfig propio para el worker. — usuario —
  2026-11-17 — Block 4
- Sistema visual compartido: `.app-screen` (`100dvh` menos las safe areas) y `.app-card` en
  `@layer components` de `globals.css`, usadas por el inicio y por `/~offline`. Los hex que no
  pueden leer variables CSS (manifest, `themeColor`, Satori) salen de `src/lib/palette.ts` (`BASE`,
  `FOAM`), con un test que los compara con `globals.css`. — usuario — 2026-11-17 — Block 4
- Íconos: el monograma "MG" vive en `src/components/app-icon.tsx`, compartido por `icon.tsx` (favicon
  32×32), `apple-icon.tsx` (180) e `icons/[size]` (192/512, `dynamicParams = false`). El mismo PNG
  sirve para 512 "any" y para "maskable" (el monograma entra en la zona segura). El manifest suma
  `description` y `lang: "es-AR"`. — usuario — 2026-11-17 — Block 4
- Tests: los E2E de PWA corren en iphone-webkit, mobile-chromium y mobile-360 (la spec pedía
  mobile-chromium; WebKit en Docker también los pasa). El E2E de "Reintentar" neutraliza `online`
  con `addInitScript` y espera la hidratación por las claves `__react*` del botón. No hay unit test
  del `location.reload()` por defecto, porque jsdom no lo puede observar; lo cubren los E2E. —
  usuario — 2026-11-17 — Block 4
- Pendientes registrados: (a) Next 16 emite `mobile-web-app-capable` y no
  `apple-mobile-web-app-capable`: confirmar el modo standalone en el iPhone real en VERIFY; (b) los
  íconos usan la fuente por defecto de `next/og`, porque Public Sans necesitaría un `.ttf`
  versionado; (c) `/serwist/sw.js.map` es público (código propio, sin secretos); (d) ADR-002 todavía
  habla de configurar Serwist en `next.config.ts`; (e) `@serwist/turbopack` 9.5.15 ya salió y la
  spec fija la 9.5.14; (f) el E2E de "Reintentar" (`pwa.spec.ts:139-148`) espera la hidratación
  por las claves internas `__react*` y usa un `waitForTimeout(500)` fijo. No puede dar un falso
  verde, pero es frágil: cambiarlo a un `data-*` que ponga `OfflineRetry` al montarse antes de que
  la CI lo corra (Block 6); (g) el comentario de `manifest.ts:3` quedó sobre el import y no junto a
  los colores. — usuario — 2026-11-17 — Block 4

## Block 5 — `/demo` con marco de iPhone

- `ResizeObserver` sobre el área del marco y no sobre la ventana: un `ResizeObserver` no puede
  observar `window`. El área (`flex-1 min-h-0 overflow-hidden`, debajo del título) es la "altura
  disponible" que pide la spec, ya descontado el título. La spec dice "sobre la ventana": alinear
  su texto en la próxima revisión. — usuario — 2026-11-17 — Block 5
- Una caja exterior toma el tamaño ya escalado (`FRAME_* × scale`) para que el `transform` no deje
  la caja de 876 px en el layout; el área tiene `overflow-hidden` para que el SSR, que arranca en
  escala 1, no genere scroll antes del primer resize. — usuario — 2026-11-17 — Block 5
- Dynamic Island de 112×30 a 10 px del borde (la real mide 126×37 a 11 px), para no tapar el h1 del
  inicio; con `pointer-events-none`, los toques la atraviesan. Los radios del bisel se derivan de
  constantes (`OUTER_RADIUS`, `OUTER_RADIUS - BEZEL`). — usuario — 2026-11-17 — Block 5
- `computeFrameScale` trata NaN, ±Infinity y una altura de marco inválida igual que 0: devuelve 1.
  — usuario — 2026-11-17 — Block 5
- Tests más allá de los requeridos: render del iframe (src, título, tamaño, sin `allow`), escala por
  `ResizeObserver`, altura 0, `disconnect` al desmontar, headers también en `/demo`, y un iframe de
  control en el test de otro origen para que la aserción negativa no pase en vacío. —
  usuario — 2026-11-17 — Block 5
- Pendientes registrados: (a) la tabla de cobertura de la spec asigna NFR-01 (360/430 px) al Block 5
  sin un test requerido que lo respalde; `/demo` es solo desktop y `/` ya lo cubren los Blocks 2 y
  4: corregir la tabla en la próxima revisión de la spec; (b) el rechazo desde otro origen (R-08)
  solo se prueba en Chromium (`demo.spec.ts` corre en `desktop`); los headers se validan a nivel
  HTTP, independiente del navegador; (c) el test de otro origen (`demo.spec.ts`, `toHaveCount(0)`
  sobre el frame rechazado) es el de más riesgo de flakiness: vigilarlo cuando la CI lo corra
  (Block 6). — usuario — 2026-11-17 — Block 5
- Ronda 2 de correcciones (aprobada por el usuario): radios del bisel derivados de `OUTER_RADIUS` /
  `SCREEN_RADIUS`, con un test unitario de la invariante "radio de la pantalla = radio exterior −
  bisel"; el test unitario pasó a `tests/unit/components/iphone-frame.test.tsx` con JSX, como el
  resto de los tests de componentes. — usuario — 2026-11-17 — Block 5
- Pendientes de la ronda 2: (d) la spec (§ Block 5) todavía nombra `iphone-frame.test.ts`: alinear
  a `.tsx` en la próxima revisión de la spec; (e) `demo.spec.ts:65,143` tiene un `!` innecesario
  después de `elementHandle()` y el título del test de headers (`:90`) nombra solo `/` aunque
  revisa también `/demo` (cosméticos, para el Block 6); (f) `tests/unit/components/pressable.test.ts`
  (Block 2) sigue usando `createElement` en un `.ts`. — usuario — 2026-11-17 — Block 5

## Block 6 — CI, protección de `main` y documentación

- Se resolvieron en este bloque los pendientes registrados "para antes de que la CI los corra":
  Block 4 (f) y Block 5 (e). Por eso el bloque toca `src/components/offline-retry.tsx`,
  `tests/unit/components/offline-retry.test.tsx`, `tests/e2e/pwa.spec.ts` y
  `tests/e2e/demo.spec.ts`, que no están en los "Files" del Block 6 de la spec. — usuario —
  2026-11-17 — Block 6
- `OfflineRetry` pone `data-ready="true"` con `setAttribute` sobre un ref, dentro del mismo effect
  que engancha el listener de `online`. No usa estado porque oxlint falla con
  `react(set-state-in-effect)`, y el ref garantiza que la marca aparece con el listener ya activo.
  Es una marca para el E2E que también viaja en el HTML de producción: no lleva datos y React no la
  reconcilia. — usuario — 2026-11-17 — Block 6
- El E2E de "Reintentar" ya no tiene `waitForTimeout(500)`: espera con un poll a que se dispare el
  evento `online` que el test intercepta, y así prueba que no hay recarga sin una pausa fija. —
  usuario — 2026-11-17 — Block 6
- CI: el job `e2e` recibe `DATABASE_URL` pero no corre `db:migrate`, porque la spec no lo pide y
  FEAT-001 no tiene migraciones; `PRISMA_HIDE_UPDATE_MESSAGE: "1"` va a nivel de workflow (resuelve
  Block 3 (c)); `persist-credentials: false` en cada checkout; el artefacto `playwright-report` se
  conserva 7 días; `cancel-in-progress` solo en PRs, para que dos merges seguidos no cancelen la
  corrida de `main` que verifica AC-09; la cache de navegadores usa como clave la versión de
  `@playwright/test`, no el lockfile entero. — usuario — 2026-11-17 — Block 6
- Actions fijadas por SHA del commit (no del objeto tag): checkout v7.0.1, pnpm/action-setup v6.1.1
  (tag anotado, desreferenciado), setup-node v7.1.0, cache v6.1.0, upload-artifact v7.0.2. `yaml`
  2.9.1 en dev, versión exacta. — usuario — 2026-11-17 — Block 6
- Tests más allá de los requeridos en `workflow.test.ts`: `concurrency`, ningún job con más
  permisos ni `needs`, `setup-node` con `.nvmrc` y cache de pnpm, que cada `pnpm <script>` exista en
  `package.json`, que cada `uses:` tenga la versión comentada, `persist-credentials: false` y que
  ningún `run:` interpole `${{ github.event.* }}` (R-09); y que ningún job ni step tenga
  `continue-on-error` ni `if` (salvo `if: failure()` en el upload), porque un job o step salteado
  cuenta como aprobado para un check requerido (AC-11). — usuario — 2026-11-17 — Block 6
- Postgres fijado en `postgres:17.12` (último minor de la 17 en Docker Hub el 2026-11-17) en los
  dos services de la CI, en `docker-compose.yml` y en `AGENTS.md`, con un test que exige que la CI
  y compose usen la misma imagen (resuelve Block 3 (b)). La spec dice `postgres:17` y el minor
  fijado sigue siendo Postgres 17; el volumen local se reutilizó (ya corría la 17.12). La key de
  la cache de navegadores sale de `devDependencies['@playwright/test']` en `package.json`. —
  usuario — 2026-11-17 — Block 6
- README: los comandos van en lista y no en tabla, porque oxfmt rellena las tablas a ancho fijo. —
  usuario — 2026-11-17 — Block 6
- Pendientes registrados: (a) el E2E del camino HTTP real de `/api/health` (routing,
  `force-dynamic`, HEAD) que el Block 3 prometió para el Block 6 no está ni en la spec ni en este
  bloque: queda pendiente, por decisión del usuario; (b) el job `e2e` no corre `pnpm db:migrate`:
  agregarlo con el PRD 02, cuando existan migraciones (decisión del usuario); (c) ADR-002 todavía habla de configurar Serwist en
  `next.config.ts` (Block 4 (d) abierto); (d) `actionlint` no se corrió (no está instalado y el
  permiso para correrlo con Docker se denegó): la sintaxis del workflow la cubren el test de YAML
  y la revisión manual, y la confirma la primera corrida en el PR; (e) la duración ≤ 10 min
  (NFR-04) y el arranque de WebKit en ubuntu-latest solo se confirman en el PR real. — usuario —
  2026-11-17 — Block 6
- Pendientes de la ronda 2 (el usuario eligió anotarlos y commitear): (f) el grupo de
  `concurrency` es por ref: con tres merges seguidos a `main`, GitHub cancela la corrida que espera
  en el slot "pending" (la del medio) aunque `cancel-in-progress` sea false; se arregla agrupando
  los push por `github.sha`, y el título del test "en main nunca se cancela" promete más de lo que
  da; (g) si `@playwright/test` sale de `devDependencies`, el step `playwright-version` escribe
  `undefined` sin fallar y la key de cache queda fija (el test no lo detecta); (h) el test de
  concurrency compara el texto exacto de la expresión y un reformateo inocuo lo rompe; (i)
  `AGENTS.md` nombra `postgres:17.12` sin un test que lo ate a la CI (lo cubre "gana la CI"). —
  usuario — 2026-11-17 — Block 6

## Cierre de CODE

- Remediación de SAST: `serwist` y `@serwist/turbopack` pasan de 9.5.14 (la versión que fija la
  spec) a 9.5.15, que trae `glob` 14.0.6 y `minimatch` 11.0.8 y cierra GHSA-3g3m-2fjr-6pw4 y la ruta
  de GHSA-g3hv-75wg-m249 por `@serwist/build`. Como 9.5.15 se publicó el 2026-11-17, quedan 5
  excepciones puntuales por versión exacta en `minimumReleaseAgeExclude` de `pnpm-workspace.yaml`
  (`serwist` y `@serwist/{build,turbopack,utils,window}`), que se retiran cuando la versión supere la
  ventana de antigüedad. `AGENTS.md` dice 9.5.15. Resuelve el pendiente (e) del Block 4. —
  usuario — 2026-11-17 — cierre de CODE
- `minimatch` 10.2.6 vía `shadcn>ts-morph>@ts-morph/common` (GHSA-g3hv-75wg-m249) queda suprimido
  como ACCEPTED_RISK en `docs/daw/security/sast-FEAT-001.md`, con revisión antes del 2027-03-17:
  shadcn 4.23.0 es la última versión y la CLI no corre en la CI, el build ni producción. —
  usuario — 2026-11-17 — cierre de CODE
- Pendiente registrado: `pnpm audit` no corre en la CI; sumar `pnpm audit --audit-level=high` al
  job `quality` en un ticket aparte. — usuario — 2026-11-17 — cierre de CODE
