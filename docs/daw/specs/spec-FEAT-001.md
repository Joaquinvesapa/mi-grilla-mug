# Spec FEAT-001: Plataforma base de Mi Grilla

| Field | Value |
|-------|-------|
| Ticket | FEAT-001 |
| PRD | docs/daw/prd/prd-FEAT-001.md |
| Tier | FEATURE |
| Date | 2026-11-16 |
| Spec loops | 3 |
| Loops since last human decision | 0 |

## Summary
Scaffold de Mi Grilla sobre Next.js 16 (App Router), TypeScript 7, Tailwind 4 + shadcn/ui, Prisma 7 +
PostgreSQL, con la toolchain de oxc (oxlint + oxfmt, ADR-001) y PWA con Serwist (ADR-002). Se
construye en 6 bloques: scaffold y calidad local; inicio con shell nativo e identidad Rosé Pine;
base de datos y `GET /api/health`; PWA instalable con pantalla sin conexión; `/demo` con marco de
iPhone; y CI en GitHub Actions con unit, integración y E2E. Incorpora las mitigaciones R-01 a R-12
del modelo de amenazas (`docs/daw/security/threat-FEAT-001.md`) y los 22 hallazgos de la auditoría
de arquitectura de PLAN.

### Decisiones del usuario aplicadas (2026-11-16)
- Carpetas por tipo; identificadores en inglés y UI en español; PWA con Serwist; cobertura 80 %
  líneas / 70 % ramas / 80 % funciones; TypeScript 7 con oxlint y oxfmt (ADR-001).
- Identidad: paleta Rosé Pine (variante principal) con acento foam `#9ccfd8`; tipografía Public Sans.
- Inicio con secciones que hacen scroll y un botón "Cómo instalarla" que despliega la guía de
  "Agregar a pantalla de inicio" en iPhone.
- Prueba en iPhone real servida por HTTPS con un túnel de ngrok (paso manual de VERIFY).
- `main` protegida en GitHub: solo por PR y con la CI en verde.

### Versiones fijadas (exactas, sin `^`)
`next` 16.4.6 · `react`/`react-dom` 19.3.1 · `typescript` 7.0.2 · `tailwindcss` +
`@tailwindcss/postcss` 4.3.5 · `shadcn` 4.23.0 (CLI) + `clsx`, `tailwind-merge`,
`class-variance-authority`, `@radix-ui/react-slot`, `@radix-ui/react-collapsible`, `lucide-react` ·
`prisma` + `@prisma/client` + `@prisma/adapter-pg` 7.10.1 (no la 8.0.0-rc) + `pg`, `@types/pg`,
`dotenv` · `serwist` + `@serwist/turbopack` 9.5.15 (9.5.14 en el plan original; se subió en el
cierre de CODE por remediación de SAST) + `esbuild` · `vitest` + `@vitest/coverage-v8`
5.1.0 + `jsdom` + `@testing-library/react` + `@testing-library/jest-dom` · `@playwright/test`
1.65.1 · `oxlint` 1.94.0 + `oxlint-tsgolint` 7.0.2007 · `oxfmt` 0.79.0 · `yaml` (test del workflow)
· `server-only`. Node 24 LTS (`.nvmrc`), pnpm 12 (`packageManager`). Las versiones de las
dependencias sin número acá se fijan a la última estable el día del bloque 1 y quedan exactas en
`package.json`.

### Paleta (fuente: `rose-pine/palette`, dist/css/rose-pine.css)
base `#191724` · surface `#1f1d2e` · overlay `#26233a` · muted `#6e6a86` · subtle `#908caa` · text
`#e0def4` · love `#eb6f92` · gold `#f6c177` · rose `#ebbcba` · pine `#31748f` · foam `#9ccfd8` ·
iris `#c4a7e7` · highlight low `#21202e` / med `#403d52` / high `#524f67`. Roles: primario = foam
(texto encima en base), destructivo = love, aviso = gold. Iris no se usa en roles principales.

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 2 |
| FR-02 | Block 4 |
| FR-03 | Block 4 |
| FR-04 | Block 3 |
| FR-05 | Block 5 |
| FR-06 | Block 6 |
| FR-07 | Block 6 |
| FR-08 | Block 2 (test E2E de la pantalla de inicio), Block 6 (corre en CI) |
| FR-09 | Block 3 (test de integración), Block 6 (corre en CI con Postgres) |
| FR-10 | Block 2 |
| FR-11 | Block 2 |
| FR-12 | Block 2 |
| FR-13 | Block 2 |
| NFR-01 | Block 2, Block 4: E2E en 360 y 430 px sin scroll horizontal y `boundingBox` ≥ 44×44 de cada elemento tocable |
| NFR-02 | Block 5: E2E en 1280×800 con `scrollHeight ≤ innerHeight` |
| NFR-03 | Block 2: E2E Chromium con throttling 4G por CDP contra `next start`, `load` ≤ 3 s |
| NFR-04 | Block 6: `timeout-minutes` por job, jobs en paralelo, cache de pnpm y browsers; duración medida en el PR |
| NFR-05 | Block 1 (umbrales en Vitest), Block 6 (la CI falla bajo el piso) |
| NFR-06 | Block 3: test de integración que mide la latencia de `GET /api/health` ≤ 1000 ms |
| NFR-07 | Block 2: estado de presionado por `pointerdown` + `touch-action: manipulation`; E2E mide ≤ 100 ms; verificación manual en iPhone |

## Dependencies between blocks
Block 1 primero (todo depende del scaffold). Block 2 depende de 1. Block 3 depende de 1. Block 4
depende de 2 (precachea los assets y la pantalla con estilos). Block 5 depende de 2 (embebe el
inicio). Block 6 depende de 1–5 (corre todas sus suites). Orden: 1 → 2 → 3 → 4 → 5 → 6.

## Block 1 — Scaffold y calidad local

**Files**
- `package.json` (new) — dependencias exactas, `packageManager` pnpm 12, `engines.node` 24, scripts:
  `dev`, `build`, `start`, `lint` (`oxlint --type-aware`), `format` / `format:check` (oxfmt),
  `typecheck` (`tsc --noEmit`), `test` (Vitest proyecto unit con coverage), `test:integration`,
  `test:e2e`, `db:generate`, `db:migrate`, `postinstall` (`prisma generate`, Block 3).
- `pnpm-lock.yaml` (new) — lockfile commiteado.
- `.nvmrc` (new) — `24`.
- `tsconfig.json` (new) — `strict`, alias `@/*` → `src/*`, `noUncheckedIndexedAccess`.
- `next.config.ts` (new) — `typescript.ignoreBuildErrors: true` (ADR-001); headers de Block 5;
  Serwist de Block 4.
- `postcss.config.mjs` (new) — `@tailwindcss/postcss`.
- `components.json` (new) — config de shadcn (estilo new-york, alias `@/components`, `@/lib`).
- `src/lib/utils.ts` (new) — `cn()` de shadcn.
- `src/app/globals.css` (new) — `@import "tailwindcss"`, tokens Rosé Pine en `@theme`, mapeo a las
  variables de shadcn (background=base, card=surface, popover=overlay, foreground=text,
  muted-foreground=subtle, primary=foam, primary-foreground=base, destructive=love,
  border/input=highlight-med, ring=foam). Tema oscuro único.
- `src/app/layout.tsx` (new) — layout raíz mínimo (lo completa Block 2).
- `src/app/page.tsx` (new) — placeholder (lo reemplaza Block 2).
- `.oxlintrc.json` (new) — plugins `typescript`, `react`, `nextjs`, `import`; type-aware; regla
  `no-restricted-imports` que prohíbe `@prisma/*` y `@/server/generated/*` fuera de `src/server/`;
  `ignorePatterns`: `.agents/`, `.daw/`, `.claude/`, `docs/`, `src/server/generated/`,
  `skills-lock.json`, `.next/`, `coverage/`.
- `.oxfmtrc.json` (new) — mismo `ignorePatterns`.
- `vitest.config.ts` (new) — proyectos `unit` (jsdom, `tests/unit/**`) e `integration` (node,
  `tests/integration/**`); coverage v8 solo en `unit`: `include` = `src/lib/**`, `src/server/**`,
  `src/components/**`, `src/app/manifest.ts`; `exclude` = `src/server/generated/**`,
  `src/server/db.ts` (lo cubre integración), `src/components/ui/**` (código de shadcn), `src/app/sw.ts`;
  umbrales `lines: 80`, `branches: 70`, `functions: 80`.
- `tests/unit/setup.ts` (new) — `@testing-library/jest-dom`.
- `tests/unit/lib/utils.test.ts` (new) — test de `cn()`.
- `.gitignore` (modified) — fuera del bloque DAW: `node_modules/`, `.next/`, `next-env.d.ts`,
  `*.tsbuildinfo`, `coverage/`, `playwright-report/`, `test-results/`, `blob-report/`, `.env`,
  `.env*.local`, `!.env.example`, `src/server/generated/`.
- `AGENTS.md` (modified) — fuera del bloque `BEGIN/END DAW`: Language (identificadores en inglés, UI
  en español), Stack (TypeScript 7.0, oxlint + oxfmt, versiones de este bloque), Testing (pisos 80/70/80,
  "un test salteado lleva el motivo en la misma línea", "el mínimo de la CI son los tres pisos"), y
  el texto final de Architecture conventions y Code conventions (abajo).
- `.agents/` y `skills-lock.json` (existentes, sin trackear) — entran al commit de este bloque.

**Logic**
Crea el proyecto con la toolchain de ADR-001. Si `next build` o `next dev` fallan porque Next 16
necesita la API JS de TypeScript para configurar `tsconfig.json`, se detiene el bloque y se reporta
para escribir un ADR que reemplace al 001 (no se rodea con un parche).

Texto de convenciones que se escribe en `AGENTS.md`:
- **Folder structure:** `src/app/` (rutas, layouts y route handlers delgados), `src/components/`
  (UI; `ui/` = shadcn), `src/lib/` (utilidades puras, sin I/O), `src/server/` (acceso a la base y
  lógica de servidor; cada módulo con `import "server-only"`), `src/server/generated/prisma/`
  (cliente generado, fuera de git). Tests en `tests/{unit,integration,e2e}/`.
- **Layer separation:** `src/app/` y `src/components/` nunca importan `@prisma/*` ni
  `@/server/generated/*`; usan funciones de `src/server/`. Lo hace cumplir `no-restricted-imports`
  en oxlint.
- **Error handling:** en `src/server/` los errores esperados se devuelven como resultado tipado con
  un código (`{ ok: false, code: "DB_UNREACHABLE" }`). Ningún `catch` silencioso: o registra un código
  genérico o re-lanza. Al cliente nunca llega `error.message` de infraestructura.
- **Naming:** archivos y carpetas en kebab-case; componentes en PascalCase; funciones y variables en
  camelCase; identificadores en inglés; textos de UI en español.
- **Dependencies:** versiones exactas (sin `^` ni `~`); una dependencia nueva se justifica en la
  spec de su ticket; ESLint y Prettier no se instalan (ADR-001).
- **Code conventions (agregado):** sin `any` (si es inevitable, con un comentario del motivo);
  componentes de servidor por defecto y `"use client"` solo donde hay interacción.

**Input validation**
- `cn(...inputs)`: acepta `ClassValue` (string, arreglo, objeto de booleanos); los valores falsy
  (`undefined`, `null`, `false`, `""`) se descartan.
- Código fuente que entra al lint: imports de `@prisma/*` o `@/server/generated/*` solo se aceptan
  dentro de `src/server/`.

**Error handling**
- Import de `@prisma/*` o `@/server/generated/*` fuera de `src/server/` — oxlint lo rechaza con
  error y `pnpm lint` termina en código distinto de 0.
- Valores inválidos o falsy en `cn()` — se ignoran sin lanzar error.
- Cobertura bajo cualquiera de los pisos (80/70/80) — `pnpm test` termina con error.

**Required tests**
- [ ] `test-utils-cn-merge` — `tests/unit/lib/utils.test.ts`: `cn()` combina y resuelve clases en
      conflicto de Tailwind.
- [ ] `test-utils-cn-invalid` — `tests/unit/lib/utils.test.ts`: `cn()` con valores inválidos
      (`undefined`, `false`) los ignora sin error.
- [ ] `test-quality-commands` — `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` y
      `pnpm build` terminan con código 0.
- [ ] `test-layer-rule` — `pnpm lint` rechaza un import de `@prisma/client` desde `src/components/`
      con error (archivo de prueba temporal, no se commitea) — verifica la regla de capas.
- [ ] `test-coverage-floor` — con un piso forzado por encima de la cobertura real, `pnpm test`
      termina con error (prueba temporal, no se commitea) — verifica que los umbrales están
      conectados (NFR-05).

**Completion criterion**
Los cinco comandos terminan en 0, el import prohibido es rechazado por oxlint, y `AGENTS.md` tiene
las cinco convenciones y el Stack actualizados, fuera del bloque DAW.

## Block 2 — Inicio y shell nativo

**Files**
- `src/app/layout.tsx` (modified) — `export const viewport` con `width=device-width`,
  `initialScale: 1`, `viewportFit: "cover"`, `themeColor: "#191724"` (sin `maximum-scale` ni
  `user-scalable=no`); metadata con `title: "Mi Grilla"`; Public Sans vía `next/font/google`
  (variable, `display: "swap"`); `lang="es-AR"`; contenedor raíz `app-shell`.
- `src/app/globals.css` (modified) — base de shell nativo: `.app-shell` con `min-height: 100dvh`
  (nunca `100vh`), padding con `env(safe-area-inset-top|right|bottom|left)`; `html` con
  `-webkit-tap-highlight-color: transparent`, `overscroll-behavior-y: none`,
  `-webkit-text-size-adjust: 100%`; `button, a, [role="button"]` con `touch-action: manipulation`,
  `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`; hovers solo
  dentro de `@media (hover: hover)`; `font-variant-numeric: tabular-nums` en `.tabular`.
- `src/app/page.tsx` (modified) — inicio: wordmark "Mi Grilla", bajada, tres secciones ("Armá tu
  grilla", "Llevala en la pantalla de bloqueo", "Coincidí con tu grupo", marcadas "Muy pronto") que
  superan el alto de la pantalla (hay scroll vertical), y la sección de instalación.
- `src/components/install-guide.tsx` (new, `"use client"`) — botón "Cómo instalarla" (shadcn
  `Button` + `Collapsible`) que despliega los 3 pasos de iPhone: abrir en Safari, tocar Compartir,
  "Agregar a pantalla de inicio".
- `src/components/pressable.ts` (new, `"use client"`) — hook `usePressed()`: pone
  `data-pressed="true"` en `pointerdown` y lo quita en `pointerup`/`pointercancel`/`pointerleave`
  (mecanismo de respuesta al toque que no depende de `:active` en iOS).
- `src/components/ui/button.tsx`, `src/components/ui/collapsible.tsx` (new) — `shadcn add`; el
  `Button` usa `usePressed()` y estila `[data-pressed=true]`.
- `tests/unit/components/install-guide.test.tsx` (new)
- `tests/unit/components/pressable.test.ts` (new)
- `tests/e2e/home.spec.ts` (new)
- `tests/e2e/performance.spec.ts` (new)
- `playwright.config.ts` (new) — `webServer`: `pnpm build && pnpm start` (también en local,
  ADR-002); proyectos `iphone-webkit` (`devices["iPhone 15"]`), `mobile-chromium`
  (`devices["Pixel 7"]`), `mobile-360` (Chromium 360×780), `desktop` (Chromium 1280×800).

**Logic**
Implementa FR-01 y FR-10 a FR-13. Las guías `.agents/skills/mobile-native` (fixes 2, 3, 5, 7, 8 y
"Baseline") se aplican tal cual están listadas arriba; `design-taste-frontend` aporta solo
principios visuales (un sistema, copy propio, sin estética de plantilla). El texto de la página no
nombra a Lollapalooza en ningún lado (DOM, `<title>`, metadata).

**Error handling**
- Sin condiciones de error propias: la página es estática y no recibe entrada; el único estado es
  abierto/cerrado de la guía.

**Required tests**
- [ ] `test-install-guide-toggle` — `install-guide.test.tsx`: al tocar "Cómo instalarla" se muestran
      los 3 pasos; al tocar de nuevo se ocultan.
- [ ] `test-pressable-state` — `pressable.test.ts`: `pointerdown` pone `data-pressed="true"`;
      `pointercancel` (toque inválido/cancelado) lo quita sin error.
- [ ] `test-home-identity` — `home.spec.ts` (iphone-webkit, mobile-360): se ve "Mi Grilla"; ni el
      DOM ni `document.title` contienen "Lollapalooza" — validates AC-01, AC-13.
- [ ] `test-home-widths` — `home.spec.ts` (mobile-360 y viewport 430): `scrollWidth ≤ innerWidth`;
      cada botón/link con `boundingBox` ≥ 44×44 — validates AC-15, NFR-01.
- [ ] `test-home-safe-area` — `home.spec.ts`: la meta viewport contiene `viewport-fit=cover` y el
      CSSOM tiene en `.app-shell` padding con `env(safe-area-inset-*)` — validates AC-16 (el valor
      real del notch se verifica en iPhone).
- [ ] `test-home-dvh` — `home.spec.ts`: el CSSOM de `.app-shell` usa `100dvh` y ninguna regla usa
      `100vh` — validates AC-17 (la barra de Safari se verifica en iPhone).
- [ ] `test-home-tap-highlight` — `home.spec.ts`: `-webkit-tap-highlight-color` calculado es
      transparente (si WebKit no lo expone en `getComputedStyle`, se verifica la regla en el CSSOM) —
      validates AC-18.
- [ ] `test-home-no-select` — `home.spec.ts`: en el botón, `user-select: none` y
      `-webkit-touch-callout: none` — validates AC-19.
- [ ] `test-home-press-latency` — `home.spec.ts`: `touch-action: manipulation` en el botón, y el
      tiempo entre `pointerdown` y `data-pressed="true"` ≤ 100 ms — validates AC-20, NFR-07.
- [ ] `test-home-load-4g` — `performance.spec.ts` (Chromium, CDP 4G: 4 Mbps bajada, 3 Mbps subida,
      20 ms): evento `load` de `/` ≤ 3000 ms contra `next start`; con un error de red el test falla
      con el tiempo medido — validates NFR-03.

**Completion criterion**
Los tests unitarios y E2E de este bloque pasan en local con `pnpm test` y `pnpm test:e2e`, y la
cobertura sigue sobre los pisos.

## Block 3 — Base de datos y chequeo de salud

**Files**
- `prisma/schema.prisma` (new) — `generator client { provider = "prisma-client", output =
  "../src/server/generated/prisma" }`, `datasource db { provider = "postgresql" }`, sin modelos.
- `prisma.config.ts` o `prisma7.config.ts` (new) — el nombre que cargue la CLI de Prisma 7.10.1
  (se verifica con `prisma generate`; sin `--config` por script). Hace `import "dotenv/config"` y lee
  `DATABASE_URL` como opcional, para que `pnpm install` (con `postinstall: prisma generate`)
  funcione sin la variable.
- `docker-compose.yml` (new) — `postgres:17.12` (minor fijado en el Block 6), puerto `127.0.0.1:5432:5432`, `POSTGRES_PASSWORD` leído
  de `.env` (`${POSTGRES_PASSWORD:?}`), sin contraseñas literales.
- `.env.example` (new) — `DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/mi_grilla` y
  `POSTGRES_PASSWORD=` (solo placeholders).
- `src/server/database-url.ts` (new) — `assertSafeDatabaseUrl(url)`: exige `sslmode=require` si el
  host no es `localhost`, `127.0.0.1`, `::1` ni `postgres` (servicio de la CI) (R-04).
- `src/server/db.ts` (new) — `import "server-only"`; `createDb(url)` (PrismaClient con
  `@prisma/adapter-pg`, pool `max: 5`) y `getDb()` singleton encima, que valida la URL al crearse.
- `src/server/health.ts` (new) — `import "server-only"`; `createHealthChecker({ probe, timeoutMs:
  800, cacheMs: 2000, now })` → `check(): Promise<{ status: "ok" | "error"; database: "up" |
  "down" }>`; el probe por defecto ejecuta `SELECT 1`; ante error o timeout registra
  `DB_UNREACHABLE` / `DB_TIMEOUT` (nunca `error.message`) y devuelve `down` (R-01, R-02, R-07).
- `src/app/api/health/route.ts` (new) — `GET` que usa el checker de `getDb()`.
- `tests/unit/server/database-url.test.ts`, `tests/unit/server/health.test.ts` (new)
- `tests/integration/health.test.ts` (new)

**Logic**
Implementa FR-04 y FR-09. El route handler es delgado: delega en `src/server/health.ts`.

**API contract**
- Method + path: `GET /api/health`
- Request: sin cuerpo ni parámetros.
- Response: `200` `{ "status": "ok", "database": "up" }`; `503` `{ "status": "error", "database":
  "down" }`. Siempre `Content-Type: application/json` y `Cache-Control: no-store`.
- Error codes: 503 (base caída o timeout de 800 ms), 405 (cualquier método que no sea GET).
- Auth: público, sin autenticación (FR-04); no expone datos internos.

**Data model**
- Sin entidades: `schema.prisma` declara solo el datasource PostgreSQL y el generador; ningún
  modelo, tabla, constraint ni índice en FEAT-001. La primera migración llega con el PRD 02.
- Rollback: no hay migraciones en FEAT-001, así que no hay migración inversa; revertir el bloque es
  revertir el commit y `docker compose down -v` borra la base local.

**Input validation**
- `DATABASE_URL` (entorno del servidor): URL `postgresql://` válida; host no local exige
  `sslmode=require`; se valida al crear el cliente. El endpoint no acepta entrada del cliente.

**Error handling**
- Base caída (conexión rechazada) — 503 genérico; log `DB_UNREACHABLE` sin la URL.
- Base que no responde en 800 ms — 503 genérico por timeout; log `DB_TIMEOUT`.
- `DATABASE_URL` remota sin `sslmode=require` — `createDb` lanza `UnsafeDatabaseUrlError` al
  arrancar; la app no se conecta.

**Required tests**
- [ ] `test-health-up` — `health.test.ts` (unit): probe ok → `{status:"ok",database:"up"}` —
      validates AC-04.
- [ ] `test-health-down` — `health.test.ts` (unit): probe que rechaza con error →
      `{status:"error",database:"down"}` y el log tiene `DB_UNREACHABLE` sin el mensaje del error —
      validates AC-05.
- [ ] `test-health-timeout` — `health.test.ts` (unit): probe que excede el timeout de 800 ms →
      `down` y log `DB_TIMEOUT`.
- [ ] `test-health-memo` — `health.test.ts` (unit): dos `check()` dentro de 2 s llaman al probe una
      sola vez (R-02).
- [ ] `test-database-url` — `database-url.test.ts`: URL remota sin `sslmode=require` es rechazada;
      URL inválida (no postgresql) es rechazada; localhost y `postgres` sin TLS se aceptan (R-04).
- [ ] `test-health-integration-up` — `tests/integration/health.test.ts`: `GET` contra Postgres real
      → 200, body exacto y respuesta en ≤ 1000 ms — validates AC-04, AC-14, NFR-06.
- [ ] `test-health-integration-down` — `tests/integration/health.test.ts`: `GET` con la URL
      apuntando a un puerto cerrado → 503 con body exacto `{status:"error",database:"down"}`, sin
      host, puerto ni usuario de la URL en el body — validates AC-05.
- [ ] `test-health-integration-405` — `tests/integration/health.test.ts`: `POST` → 405 (método
      inválido rechazado).

**Completion criterion**
`docker compose up -d`, `pnpm test` y `pnpm test:integration` pasan; `pnpm install` en un clon sin
`.env` termina en 0.

## Block 4 — PWA instalable y pantalla sin conexión

**Files**
- `src/app/manifest.ts` (new) — `name`/`short_name` "Mi Grilla", `display: "standalone"`,
  `start_url: "/"`, `scope: "/"`, `background_color`/`theme_color` `#191724`, íconos 192, 512 y
  512 maskable; sin mención a Lollapalooza.
- `src/app/icon.tsx`, `src/app/apple-icon.tsx` (new) — íconos con `next/og` (`ImageResponse`):
  monograma "MG" en foam sobre base; apple-icon 180×180.
- `src/app/icons/[size]/route.tsx` (new) — PNG de 192 o 512 px con `next/og` para el manifest.
- `src/app/layout.tsx` (modified) — `metadata.appleWebApp` (`capable: true`, `title: "Mi Grilla"`,
  `statusBarStyle: "black-translucent"`) y `metadata.manifest`; monta `SerwistProvider`.
- `src/components/serwist-provider.tsx` (new, `"use client"`) — wrapper de `SerwistProvider` de
  `@serwist/turbopack/react` que registra `/serwist/sw.js` con `scope: "/"`.
- `src/app/serwist/[path]/route.ts` (new) — `createSerwistRoute({ swSrc: "src/app/sw.ts", ... })`
  con `additionalPrecacheEntries` de `/~offline`; responde con `Service-Worker-Allowed: /`.
- `src/app/sw.ts` (new) — `Serwist` con `precacheEntries` del build (incluye `/_next/static/**`, CSS,
  JS y la fuente autohospedada), `skipWaiting`, `clientsClaim`, `navigationPreload`,
  `runtimeCaching` con una única ruta `NetworkOnly` para navegaciones (`request.mode ===
  "navigate"`) del mismo origen fuera de `/api/` (sin `defaultCache` y sin guardar nada en caché),
  `fallbacks` de documentos a `/~offline`; las peticiones a `/api/` y a otros orígenes no se
  interceptan (R-05, R-06). La ruta existe porque en serwist 9.5.14 `fallbacks` solo se engancha a
  las estrategias de `runtimeCaching`: con la lista vacía, `/~offline` nunca se serviría.
- `src/app/~offline/page.tsx` (new) — pantalla "Sin conexión" con la identidad de la app (estilos y
  fuente precacheados).
- `tests/unit/app/manifest.test.ts` (new)
- `tests/e2e/pwa.spec.ts` (new)

**Logic**
Implementa FR-02 y FR-03 con Serwist (ADR-002). El SW solo corre con `next build` + `next start`.

**API contract**
- Method + path: `GET /serwist/[path]` (sirve `sw.js` y su source map) y `GET /icons/[size]` (PNG del
  ícono).
- Request: `path` (segmento de ruta) / `size` (segmento de ruta).
- Response: `sw.js` como `application/javascript` con `Service-Worker-Allowed: /`; PNG como
  `image/png`.
- Error codes: 404 para un `path` o un `size` inválido.
- Auth: públicos, sin autenticación; no exponen datos.

**Input validation**
- `size`: solo `192` o `512`; cualquier otro valor → 404.
- `path`: solo los archivos que genera `createSerwistRoute`; cualquier otro → 404.

**Error handling**
- Navegación sin red — el SW responde `/~offline` desde el precache.
- `size` inválido en `/icons/[size]` — 404, sin generar imagen.
- `path` inexistente en `/serwist/[path]` — 404.

**Required tests**
- [ ] `test-manifest` — `manifest.test.ts`: `display: "standalone"`, nombre "Mi Grilla", íconos
      192/512/maskable, sin "Lollapalooza" — validates AC-02 (parte automatizable).
- [ ] `test-sw-scope` — `pwa.spec.ts` (mobile-chromium): `registration.scope` es el origen + `/` y la
      página queda controlada por el SW.
- [ ] `test-sw-offline` — `pwa.spec.ts` (mobile-chromium): con el SW listo,
      `context.setOffline(true)` y navegación a `/`, se ve "Sin conexión" con fondo calculado
      `rgb(25, 23, 36)` (pantalla con estilos), en lugar del error del navegador (fallo de red) —
      validates AC-03.
- [ ] `test-icons-404` — `pwa.spec.ts`: `GET /icons/100` devuelve 404 (tamaño inválido rechazado).
- [ ] `test-serwist-404` — `pwa.spec.ts`: `GET /serwist/no-existe.js` devuelve 404 (path inválido
      rechazado).
- [ ] `test-sw-no-api-cache` — `pwa.spec.ts`: con el SW activo y offline, `GET /api/health` falla
      por red (error) en lugar de devolver una respuesta cacheada (R-06).

**Completion criterion**
Los tests pasan contra `next start`. La verificación en iPhone real (AC-02, AC-03 instalada) es
manual en VERIFY (ver "Final verification").

## Block 5 — `/demo` con marco de iPhone

**Files**
- `src/app/demo/page.tsx` (new) — página de desktop: título breve y el marco centrado.
- `src/components/iphone-frame.tsx` (new, `"use client"`) — bisel y Dynamic Island en CSS alrededor
  de un `<iframe src="/" title="Mi Grilla">` de 393×852 px (pantalla de iPhone 15); el marco completo
  escala con `transform: scale()` calculado con la altura disponible (`ResizeObserver` sobre el área
  del marco, debajo del título: un `ResizeObserver` no puede observar `window`), nunca mayor que 1;
  el iframe no recibe `allow` extra.
- `next.config.ts` (modified) — `headers()` para todas las rutas: `X-Frame-Options: SAMEORIGIN` y
  `Content-Security-Policy: frame-ancestors 'self'` (R-08).
- `tests/unit/components/iphone-frame.test.tsx` (new) — función pura `computeFrameScale()`.
- `tests/e2e/demo.spec.ts` (new)

**Logic**
Implementa FR-05. `computeFrameScale(availableHeight, frameHeight)` vive en
`src/components/iphone-frame.tsx` como export puro y testeable.

**Error handling**
- Altura disponible inválida (0 o negativa, por ejemplo antes del primer layout) — la escala queda en
  1 y se recalcula en el próximo resize, sin error.

**Required tests**
- [ ] `test-frame-scale` — `iphone-frame.test.tsx`: con 800 px disponibles el marco escala a menos
      de 1 y entra; con 1200 px la escala es 1.
- [ ] `test-frame-scale-invalid` — `iphone-frame.test.tsx`: altura inválida (0 o negativa) devuelve
      escala 1 sin error.
- [ ] `test-demo-fits` — `demo.spec.ts` (desktop 1280×800): se ve el marco con el iframe;
      `scrollHeight ≤ innerHeight` y `scrollWidth ≤ innerWidth`; el marco entra entero en el
      viewport — validates AC-06, NFR-02.
- [ ] `test-demo-interactive` — `demo.spec.ts`: dentro del iframe, click en "Cómo instalarla"
      muestra los pasos, y un scroll con la rueda dentro del iframe cambia su `scrollY` — validates
      AC-07.
- [ ] `test-frame-headers` — `demo.spec.ts`: `/` responde con `X-Frame-Options: SAMEORIGIN` y
      `frame-ancestors 'self'`; embeber desde otro origen es rechazado (página de prueba en otro
      puerto) (R-08).

**Completion criterion**
Los tests pasan contra `next start` y `/demo` se ve completa en 1280×800.

## Block 6 — CI, protección de `main` y documentación

**Files**
- `.github/workflows/ci.yml` (new) — `on: pull_request` (types `opened`, `synchronize`, `reopened`)
  y `push` a `main` únicamente; nunca `pull_request_target`; `permissions: contents: read`;
  `concurrency` por ref con `cancel-in-progress`; actions fijadas por SHA (con la versión en un
  comentario) (R-09, R-10). Jobs en paralelo, cada uno con `timeout-minutes: 10`:
  1. `quality`: `pnpm install --frozen-lockfile` (sin `DATABASE_URL`), `pnpm lint`,
     `pnpm format:check`, `pnpm typecheck`, `pnpm test` (con coverage y umbrales).
  2. `integration`: service `postgres:17.12` con credencial de prueba descartable documentada en un
     comentario (no es un secreto), `pnpm db:migrate`, `pnpm test:integration`.
  3. `e2e`: service `postgres:17.12`, cache de browsers de Playwright, `pnpm exec playwright install
     --with-deps webkit chromium`, `pnpm test:e2e` (build + start), sube `playwright-report` como
     artefacto si falla.
- `tests/unit/ci/workflow.test.ts` (new) — parsea `ci.yml` con `yaml`.
- `README.md` (modified) — cómo levantar el proyecto: Node 24 + pnpm, `cp .env.example .env`,
  `docker compose up -d`, `pnpm install`, `pnpm db:migrate`, `pnpm dev`, y la lista de comandos.
- `AGENTS.md` (modified) — v2: tabla de Testing con los comandos reales y la línea "si un número no
  coincide con la CI, gana la CI".

**Logic**
Implementa FR-06 y FR-07. Una vez que el workflow existe en el PR, se configura la protección de
`main` con `gh api` (solo PRs, check `quality`, `integration` y `e2e` requeridos). Es un cambio en
GitHub: se pide la confirmación del usuario en ese momento. Con `main` protegida, un push directo a
`main` no es posible, y AC-10 queda cubierto también para `main`.

**Data model**
- Reuses el schema de Prisma de Block 3 — no schema change; constraints as declared there: solo
  datasource PostgreSQL y generador, sin entidades ni tablas, y sin ningún constraint ni índice. El job
  `integration` aplica `pnpm db:migrate` sobre una base efímera, que no tiene migraciones en
  FEAT-001.

**Error handling**
- Un test falla o un job da error — el job termina en rojo y el check del PR o del commit queda
  fallido (AC-11).
- La cobertura queda bajo cualquiera de los tres pisos — `pnpm test` termina con error y `quality`
  queda en rojo (AC-11, NFR-05).
- Un job colgado — `timeout-minutes: 10` lo corta como fallido (timeout, NFR-04).

**Required tests**
- [ ] `test-ci-triggers` — `workflow.test.ts`: `on` tiene solo `pull_request` (opened, synchronize,
      reopened) y `push` a `main`; no existe `pull_request_target`; `permissions.contents` es `read`
      — validates AC-08, AC-09, AC-10.
- [ ] `test-ci-jobs` — `workflow.test.ts`: los tres jobs existen, corren lint, typecheck, unit con
      coverage, integración y E2E — validates AC-08.
- [ ] `test-ci-timeouts` — `workflow.test.ts`: cada job tiene `timeout-minutes` ≤ 10 (un job sin
      timeout es rechazado) — validates NFR-04.
- [ ] `test-ci-pinned-actions` — `workflow.test.ts`: toda `uses:` de terceros está fijada por SHA de
      40 caracteres (una referencia por tag es rechazada) (R-10).
- [ ] `test-ci-pr-green` — evidencia en el PR del ticket: la CI corre al abrirlo y al subirle
      cambios, y queda en verde con duración ≤ 10 min — validates AC-08, AC-12, NFR-04.
- [ ] `test-ci-pr-red` — evidencia de error (manual, con OK del usuario): un PR descartable con un
      test roto queda en rojo; otro con la cobertura bajo el piso queda en rojo; se cierran sin
      mergear — validates AC-11.
- [ ] `test-ci-no-pr-no-run` — evidencia (manual): push de una rama sin PR,
      `gh run list --branch <rama>` no muestra corridas — validates AC-10.

**Completion criterion**
`workflow.test.ts` pasa, el PR de FEAT-001 corre los tres jobs en verde, la protección de `main` está
activa (con OK del usuario), y README y AGENTS.md v2 describen los comandos reales. AC-09 se verifica
después del merge (la corrida sobre `main`) y queda registrado en el cierre.

## Final verification
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration` y
  `pnpm test:e2e` en verde en local y en la CI, con cobertura ≥ 80 % líneas, 70 % ramas y 80 %
  funciones.
- Cada AC del PRD tiene su test o su evidencia según la tabla de cobertura.
- **Verificación manual en iPhone real (VERIFY):** se sirve `next start` por HTTPS con un túnel de
  ngrok (instalado con mise o el binario oficial; URL temporal, no es un deploy) y se verifica:
  instalación con "Agregar a pantalla de inicio" en pantalla completa con ícono y nombre (AC-02);
  la app instalada sin conexión muestra "Sin conexión" con estilos (AC-03); contenido fuera del notch
  y de la barra de inicio (AC-16); alto correcto al contraer/expandir la barra de Safari (AC-17); sin
  destello ni selección al tocar/mantener (AC-18, AC-19); respuesta inmediata al toque (AC-20). La
  evidencia (checklist y capturas) queda en el reporte de VERIFY.
- `validate_threat.py` pasa contra esta spec, y R-01 a R-12 tienen su mitigación implementada.
