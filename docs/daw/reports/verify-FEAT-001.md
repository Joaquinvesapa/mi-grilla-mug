# Verification FEAT-001

Verificación del módulo completo (Blocks 1–6) de FEAT-001 "Plataforma base de Mi Grilla" contra
`docs/daw/prd/prd-FEAT-001.md` y `docs/daw/specs/spec-FEAT-001.md`, sobre HEAD `ca3b77f` de
`feat/FEAT-001-plataforma-base`. Verificación cruzada de `daw-module-verifier` (agente que no
escribió el código) y evidencia manual del usuario en un iPhone real, 2026-11-17. Ronda 1.

| Field | Value |
|---|---|
| Module | Mi Grilla: `src/app/`, `src/components/`, `src/lib/`, `src/server/`, `.github/workflows/ci.yml` |
| Line coverage | 99.02% |
| Branch coverage | 94.87% |
| Function coverage | 97.14% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm typecheck` — 0 errores; `pnpm format:check` — 61 archivos OK |

Corridas del verificador sobre `ca3b77f`: `pnpm test` 98/98; `pnpm test:integration` 9/9 contra
`postgres:17.12`; `CI=1 pnpm test:e2e:docker` 87/87 en `iphone-webkit`, `mobile-chromium`,
`mobile-360` y `desktop`; la regla de capas y los pisos de cobertura reconfirmados con casos
temporales que fallan; `pnpm db:migrate` sobre una base vacía termina en 0.

## Evidencia manual (iPhone real)

Dispositivo: iPhone 15 Pro Max (Dynamic Island). Servido por HTTPS con ngrok sobre
`pnpm build && pnpm start` (service worker activo). Confirmado por el usuario el 2026-11-17, sin
capturas adjuntas:

- Se instala desde Safari ("Agregar a pantalla de inicio"); el ícono es el monograma MG y el nombre
  es "Mi Grilla"; abierta desde el ícono, no muestra la barra de Safari (modo standalone; cierra el
  pendiente (a) del Block 4).
- Instalada, abierta una vez con señal y después en modo avión: aparece "Sin conexión"; al volver la
  señal se recarga sola.
- Ningún contenido queda tapado por la Dynamic Island, la barra de estado ni el indicador de inicio.
- En Safari, al contraerse y expandirse la barra de direcciones, la pantalla no salta ni corta
  contenido.
- Al tocar un botón el presionado se ve al instante, sin recuadro gris; mantenerlo apretado no
  selecciona texto ni abre menú. Los ≤ 100 ms de AC-20 se confirman de forma subjetiva (no se midió
  con cámara lenta); el E2E los mide con puntero mouse.

## Acceptance criteria
- ✅ AC-01 — `home.spec.ts:36` (3 proyectos) y `manifest.test.ts:55`; `src/app/page.tsx:HomePage`, `src/app/layout.tsx:metadata`
- ✅ AC-02 — `manifest.test.ts` (5 tests), `pwa.spec.ts:241` y `pwa.spec.ts:255`; `src/app/manifest.ts`, `apple-icon.tsx`, `icons/[size]/route.tsx`; más la evidencia manual en iPhone (instala, ícono MG, nombre, standalone)
- ✅ AC-03 — `pwa.spec.ts:72` (incluye WebKit), `pwa.spec.ts:110`, `pwa.spec.ts:125`; `src/app/sw.ts`, `src/app/~offline/page.tsx`; más la evidencia manual en iPhone instalada y en modo avión
- ✅ AC-04 — `health.test.ts:33`, `health-route.test.ts:15`, integración `health.test.ts:53` (≤ 1000 ms); `src/server/health.ts:createHealthChecker`, `src/app/api/health/route.ts:GET`
- ✅ AC-05 — unit `health.test.ts:40`, `:51`, `:63`, `:77`; `health-route.test.ts:24`; integración `health.test.ts:67` (respuesta sin host, puerto ni usuario)
- ✅ AC-06 — `demo.spec.ts:13` (1280×800, sin scroll de página) e `iphone-frame.test.tsx`; `src/app/demo/page.tsx`, `src/components/iphone-frame.tsx:IphoneFrame`
- ✅ AC-07 — `demo.spec.ts:54` (click y rueda dentro del iframe)
- ✅ AC-08 — `workflow.test.ts:139` y `:248–344` (triggers de PR y los tres jobs); la corrida real en el PR se registra en CLOSEOUT (diferida con aprobación del usuario)
- ✅ AC-09 — `workflow.test.ts:139` y `:162` (push a `main`, sin cancelar corridas de `main`); la corrida real después del merge se registra en CLOSEOUT (diferida con aprobación)
- ✅ AC-10 — `workflow.test.ts:139`; evidencia en GitHub: `gh run list --branch feat/FEAT-001-plataforma-base` devolvió `[]` a las 13:46:39Z, 13:47:35Z y 14:03Z del 2026-11-17 tras un push sin PR
- ✅ AC-11 — `workflow.test.ts:203` y `:216` (ningún job ni step se puede saltear ni marcar como tolerado) y los umbrales de Vitest reconfirmados con un piso forzado; los PRs descartables en rojo se registran en CLOSEOUT (diferida con aprobación)
- ✅ AC-12 — `workflow.test.ts` (jobs, timeouts de 10 min, cache); la corrida en verde en ≤ 10 min se registra en CLOSEOUT (diferida con aprobación)
- ✅ AC-13 — `home.spec.ts:36` en `iphone-webkit` (iPhone 15)
- ✅ AC-14 — `tests/integration/health.test.ts` contra PostgreSQL real
- ✅ AC-15 — `home.spec.ts:98` a 360 y 430 px, sin scroll horizontal
- ✅ AC-16 — `home.spec.ts:115` (regla CSS con `env(safe-area-inset-*)` y `viewportFit: cover`) más la evidencia manual en iPhone 15 Pro Max
- ✅ AC-17 — `home.spec.ts:135` (`100dvh`) más la evidencia manual en Safari de iPhone
- ✅ AC-18 — `home.spec.ts:165` (`-webkit-tap-highlight-color: transparent`) más la evidencia manual
- ✅ AC-19 — `home.spec.ts:196` (sin selección ni callout) más la evidencia manual
- ✅ AC-20 — `pressable.test.ts` (6 tests), `install-guide.test.tsx:46`, `home.spec.ts:225` (≤ 100 ms con puntero mouse) más la evidencia manual subjetiva en iPhone 15 Pro Max

## Spec blocks
- ✅ Block 1 — scaffold y calidad local: 5/5 tests requeridos; regla de capas y pisos reconfirmados por el verificador
- ✅ Block 2 — inicio y shell nativo: 10/10 tests requeridos
- ✅ Block 3 — base de datos y `GET /api/health`: 8/8 tests requeridos
- ✅ Block 4 — PWA instalable y pantalla sin conexión: 6/6 tests requeridos (corren en 3 proyectos)
- ✅ Block 5 — `/demo` con marco de iPhone: 5/5 tests requeridos (el unitario es `iphone-frame.test.tsx`, desvío aprobado)
- ✅ Block 6 — CI y documentación: 4/4 tests de `workflow.test.ts` y la evidencia de AC-10; la evidencia en el PR, los PRs descartables y la protección de `main` son pasos de GitHub que se hacen en CLOSEOUT (ver "Para CLOSEOUT")

Los desvíos de la spec están aprobados y registrados en `docs/daw/specs/decisions-FEAT-001.md`
(entre otros: `postgres:17.12`, Serwist 9.5.15 por SAST, `ResizeObserver` sobre el área del marco).

## Tests
- ✅ Every test the spec listed exists: los "Required tests" automatizables de los 6 bloques existen y pasan; los de evidencia en el PR del Block 6 están diferidos a CLOSEOUT con aprobación del usuario
- ✅ Sad-path tests: `/api/health` con la base caída (503 genérico, integración `:67`), timeout de 800 ms (unit `:63`), métodos no GET con 405 y `Allow: GET` (integración `:91`, `:102`); `/icons/[size]` con `100`, `1920` y `abc` da 404 (`pwa.spec.ts:247`); `/serwist/no-existe.js` da 404 (`pwa.spec.ts:234`); `DATABASE_URL` remota sin TLS, `sslmode` débil, `?host=`, `mysql://` y no-URL (`database-url.test.ts`); `computeFrameScale` con 0, negativo, NaN y −∞ (`iphone-frame.test.tsx:31`, `:39`)

## Warnings (no bloquean)
- ⚠️ W-VER-03 — `tests/e2e/pwa.spec.ts:184` usa `waitForTimeout(1500)` para probar que no hay recarga; una recarga posterior a 1,5 s daría un falso verde. No estaba registrado.
- ⚠️ W-VER-03 — `tests/e2e/home.spec.ts:225` mide un umbral absoluto de 100 ms con puntero mouse; en una CI compartida puede dar falsos rojos. Ya registrados: el test de otro origen (Block 5 (c)) y la comparación textual de concurrency (Block 6 (h)).
- ⚠️ W-VER-01 — sin uso: `--warning` / `--color-warning` en `src/app/globals.css`; variantes `destructive`, `outline`, `secondary`, `ghost`, `link` y el export `buttonVariants` de `src/components/ui/button.tsx` (código de shadcn); exports que solo se usan en su módulo (`HealthErrorCode`, `HealthCheckerOptions`, `PressedProps`, `UnsafeDatabaseUrlCode`, `MissingDatabaseUrlError`). Sin imports sin usar.
- ⚠️ Sad path sin test: `DATABASE_URL` ausente (`src/server/db.ts:45-47`, `MissingDatabaseUrlError`) y el 500 sin cuerpo de la route; el unit `health.test.ts:153` lo simula con un error genérico.
- ⚠️ `tests/unit/app/manifest.test.ts:55` etiqueta el chequeo de Lollapalooza como "(AC-13)"; corresponde a AC-01.
- ⚠️ Documentación abierta y registrada: la spec nombra `iphone-frame.test.ts`, dice "sobre la ventana" y asigna NFR-01 al Block 5; ADR-002 habla de `next.config.ts`; el comentario de `manifest.ts:3`.
- ⚠️ W-VER-02 — `src/server/**` y `src/lib/**` al 100 %; `iphone-frame.tsx` (ramas 77,8 %) y `offline-retry.tsx` (líneas 88,9 %) quedan bajo el 90 %, son UI.

## Para CLOSEOUT
- Protección de `main`: la API de GitHub responde 403 ("Upgrade to GitHub Pro or make this
  repository public"). Decisión del usuario (2026-11-17): hacer público el repo y activar la
  protección en CLOSEOUT, con su OK en cada paso.
- Evidencia en GitHub de AC-08, AC-09, AC-11, AC-12 y la duración de NFR-04: en el PR (diferida con
  aprobación).
- HEAD `ca3b77f` todavía no está en el remoto (`origin` en `36f09fd`): el PR va a correr sobre él.

Resultado de la ronda 1 según el validador: F-VER-06 sin cumplir, porque los "Required tests" de la
spec no tenían nombres legibles. Vuelta correctiva VERIFY → CODE → PLAN (2026-11-17, decidida por
el usuario): la spec nombra ahora cada test con un identificador `test-…` y se alineó con los desvíos
aprobados (`98d9bcb`); re-cierre de CODE con el mismo código de `ca3b77f`, suite 194/194 y SAST
re-validados.

Result: PASSED

# Verification FEAT-001 — ronda 2

Verificación de la trazabilidad de los 41 tests que la spec corregida nombra, por
`daw-module-verifier`. El código no cambió desde `ca3b77f` (`git diff --stat ca3b77f HEAD -- src
tests package.json` vacío); `pnpm test` 98/98 reconfirmado; los E2E se apoyan en la corrida de la
ronda 1 (87/87) y en el re-cierre de CODE (87/87). La evidencia manual en iPhone de la ronda 1 sigue
valiendo.

## Required tests de la spec
- ✅ test-utils-cn-merge — `tests/unit/lib/utils.test.ts:6`
- ✅ test-utils-cn-invalid — `tests/unit/lib/utils.test.ts:14`
- ✅ test-quality-commands — lint, format:check, typecheck, test y build con exit 0 (ronda 1 y re-cierre)
- ✅ test-layer-rule — oxlint rechaza `@prisma/client` desde `src/components/` (archivo temporal, ronda 1)
- ✅ test-coverage-floor — un piso forzado por encima de la cobertura real hace terminar `pnpm test` con código 1 (temporal, ronda 1)
- ✅ test-install-guide-toggle — `tests/unit/components/install-guide.test.tsx:22` y `:36`
- ✅ test-pressable-state — `tests/unit/components/pressable.test.ts:20` y `:39`
- ✅ test-home-identity — `tests/e2e/home.spec.ts:36`
- ✅ test-home-widths — `tests/e2e/home.spec.ts:98` (360 y 430 px)
- ✅ test-home-safe-area — `tests/e2e/home.spec.ts:115`
- ✅ test-home-dvh — `tests/e2e/home.spec.ts:135`
- ✅ test-home-tap-highlight — `tests/e2e/home.spec.ts:165`
- ✅ test-home-no-select — `tests/e2e/home.spec.ts:196`
- ✅ test-home-press-latency — `tests/e2e/home.spec.ts:225`
- ✅ test-home-load-4g — `tests/e2e/performance.spec.ts:42` y `:54`
- ✅ test-health-up — `tests/unit/server/health.test.ts:33`
- ✅ test-health-down — `tests/unit/server/health.test.ts:40`
- ✅ test-health-timeout — `tests/unit/server/health.test.ts:63`
- ✅ test-health-memo — `tests/unit/server/health.test.ts:94`
- ✅ test-database-url — `tests/unit/server/database-url.test.ts:37`, `:53`, `:106` (y `:29`, `:44`, `:59`, `:67`, `:113`, `:120`)
- ✅ test-health-integration-up — `tests/integration/health.test.ts:53`
- ✅ test-health-integration-down — `tests/integration/health.test.ts:67`
- ✅ test-health-integration-405 — `tests/integration/health.test.ts:91`
- ✅ test-manifest — `tests/unit/app/manifest.test.ts:8`, `:25`, `:55`
- ✅ test-sw-scope — `tests/e2e/pwa.spec.ts:65`
- ✅ test-sw-offline — `tests/e2e/pwa.spec.ts:72`
- ✅ test-icons-404 — `tests/e2e/pwa.spec.ts:247`
- ✅ test-serwist-404 — `tests/e2e/pwa.spec.ts:234`
- ✅ test-sw-no-api-cache — `tests/e2e/pwa.spec.ts:195`
- ✅ test-frame-scale — `tests/unit/components/iphone-frame.test.tsx:14` y `:23`
- ✅ test-frame-scale-invalid — `tests/unit/components/iphone-frame.test.tsx:31` y `:120`
- ✅ test-demo-fits — `tests/e2e/demo.spec.ts:13`
- ✅ test-demo-interactive — `tests/e2e/demo.spec.ts:54`
- ✅ test-frame-headers — `tests/e2e/demo.spec.ts:90` y `:131`
- ✅ test-ci-triggers — `tests/unit/ci/workflow.test.ts:139` y `:150`
- ✅ test-ci-jobs — `tests/unit/ci/workflow.test.ts:248`, `:257`, `:296`, `:311`
- ✅ test-ci-timeouts — `tests/unit/ci/workflow.test.ts:371`
- ✅ test-ci-pinned-actions — `tests/unit/ci/workflow.test.ts:391`
- ⏸ test-ci-pr-green — diferido a CLOSEOUT por decisión del usuario (corrida del PR del ticket)
- ⏸ test-ci-pr-red — diferido a CLOSEOUT por decisión del usuario (PRs descartables, con su OK)
- ✅ test-ci-no-pr-no-run — `gh run list --branch feat/FEAT-001-plataforma-base` vacío, repetido en la ronda 2

Total: 39 ✅ y 2 ⏸ diferidos con aprobación (test-ci-pr-green, test-ci-pr-red); ninguno falta.

La spec corregida coincide con el código: `iphone-frame.test.tsx`, `ResizeObserver` sobre el área
(`src/components/iphone-frame.tsx:36-45`), la fila de NFR-01 (`home.spec.ts:98`, `pwa.spec.ts:284`),
`postgres:17.12` (`docker-compose.yml:7`, `ci.yml:59` y `:95`) y Serwist 9.5.15 (`package.json`).

## Warnings de la ronda 2 (no bloquean)
- ⚠️ La spec (línea 339) todavía justifica la ruta `NetworkOnly` con "en serwist 9.5.14"; la versión
  fijada es 9.5.15 y `test-sw-offline` pasó con ella. Texto a corregir en la próxima revisión de la
  spec.

Result: PASSED
