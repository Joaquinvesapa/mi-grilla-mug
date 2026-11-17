# Verification FEAT-003a

Verificación del módulo completo (Blocks 1–4 y las correcciones del Block 3 que encontraron los
E2E) de FEAT-003a "Grilla y mi selección con conexión" contra `docs/daw/prd/prd-FEAT-003a.md` y
`docs/daw/specs/spec-FEAT-003a.md`, sobre HEAD `bcf2091` de `feat/FEAT-003a-grilla-seleccion`.
Verificación cruzada de `daw-module-verifier` (agente que no escribió el código), 2026-11-17.
Ronda 1.

| Field | Value |
|---|---|
| Module | Grilla y selección: `data/`, `prisma/seed.ts`, `prisma/` (migración `20261117185304_schedule`), `src/lib/{festival-time,schedule-types,schedule-layout,clashes,selection-messages,database-url}.ts`, `src/server/{schedule,selection}.ts`, `src/app/{selection-actions.ts,page.tsx}`, `src/components/{schedule-screen,schedule-grid,day-picker,pending-bar,app-menu}.tsx` |
| Line coverage | 99.8% |
| Branch coverage | 98.43% |
| Function coverage | 99.34% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm typecheck` — 0 errores; `pnpm format:check` — 135 archivos OK |

Corridas del verificador sobre `bcf2091`: `pnpm test` 273/273; `pnpm test:integration` 46/46
contra `postgres:17.12`. Los E2E (202 pasados y 1 salteado con motivo en `iphone-webkit`,
`mobile-chromium`, `mobile-360` y `desktop`, con `CI=1 pnpm test:e2e:docker`) salen del cierre de
CODE sobre `e1b1a63`; entre ese commit y `bcf2091` solo cambiaron documentos en `docs/`.
Cobertura por archivo nuevo: todos los de `src/lib`, `src/server` y `src/components` al 100 % de
líneas y funciones (`schedule-screen.tsx` con 95 % de ramas); `page.tsx` y `selection-actions.ts`
al 100 % medidos aparte; `prisma/seed.ts` 89,28 % líneas / 81,81 % ramas / 87,5 % funciones con la
integración (fuera del `include`).

La evidencia TDD por bloque (tests rojos por aserción antes de implementar, y verdes después) quedó
registrada por las revisiones de CODE en `.daw-work/review-block-{1..4}.md`.

## Evidencia manual (iPhone real)

Probado por el usuario en su iPhone el 2026-11-17, con cuentas nuevas (la base local no tenía
usuarios: los borra el setup de integración) sobre `pnpm build && pnpm start` por HTTPS. Confirmado
por el usuario, sin capturas adjuntas: "funciona todo bien". Cubre la verificación final de la spec:
la grilla abre en el viernes, se marcan y guardan shows, y la marca de choque se ve.

## Acceptance criteria
- ✅ AC-01 — `data/schedule.json`, `seedSchedule`, `getSchedule`, `ScheduleGrid`; `test-schedule-data-matches-source`, `test-seed-idempotent`, `test-e2e-grid-all-shows`
- ✅ AC-02 — `ScheduleGrid` (orden por `position`), `hourMarks`; `test-grid-render`, `test-layout-axis-after-midnight`, `test-e2e-grid-columns`
- ✅ AC-03 — `ShowBlock`, `formatClock`; `test-format-clock`, `test-grid-block-content`, `test-e2e-grid-block-content`
- ✅ AC-04 — `blockGeometry`, `dayAxis`; `test-layout-geometry`, `test-e2e-grid-geometry`
- ✅ AC-05 — `posterTimeToInstant`, `dayAxis`; `test-poster-time-after-midnight`, `test-schedule-data-after-midnight`, `test-layout-axis-after-midnight`, `test-e2e-grid-after-midnight`
- ✅ AC-06 — `DayPicker`, `ScheduleScreen`; `test-day-picker-switch`, `test-e2e-grid-day-switch`
- ✅ AC-07 — columnas `(100% − 3rem)/3` y `.schedule-scroll`; `test-e2e-grid-three-columns` (360 y 430 px)
- ✅ AC-08 — encabezado y columna de horas `sticky`; `test-e2e-grid-sticky`
- ✅ AC-09 — `festivalDayFor`, `page.tsx`; `test-festival-day-during` y el test de página con reloj simulado (sábado 21:30)
- ✅ AC-10 — `festivalDayFor`; `test-festival-day-outside`, `test-e2e-grid-initial-day`
- ✅ AC-11 — `toggle`, `aria-pressed`; `test-screen-toggle`, `test-e2e-grid-toggle`
- ✅ AC-12 — `saveSelection`, `saveSelectionAction`, `save`; `test-selection-save-replace`, `test-screen-save-ok`, `test-e2e-grid-save-persists`
- ✅ AC-13 — borrador por encima del día; `test-screen-pending-across-days`, `test-e2e-grid-pending-across-days`
- ✅ AC-14 — `PendingBar`; `test-screen-pending-bar`, `test-e2e-grid-pending-bar`
- ✅ AC-15 — `discard`; `test-screen-discard`, `test-e2e-grid-discard`
- ✅ AC-16 — AlertDialog de `AppMenu` y `beforeunload`; `test-screen-leave-confirm`, `test-screen-beforeunload`, `test-e2e-grid-leave-confirm` (más `test-e2e-grid-leave-beforeunload`, solo Chromium)
- ✅ AC-17 — `findClashes` y la marca en `ShowBlock`; `test-clashes-overlap`, `test-grid-clash-mark`, `test-e2e-grid-clash`
- ✅ AC-18 — `findClashes` (borde que se toca no choca); `test-clashes-edge-rejected`, `test-e2e-grid-edge-no-clash`
- ✅ AC-19 — `page.tsx` (verificación de sesión) y `src/proxy.ts`; `test-e2e-grid-requires-session`, test de página "sin sesión redirige"
- ✅ AC-28 — `MIN_BLOCK_HEIGHT` 44; `test-layout-min-height`, `test-e2e-grid-min-height`

NFR: NFR-01 `test-e2e-grid-load-4g`; NFR-02 `test-selection-latency`; NFR-03
`test-e2e-grid-three-columns` y `test-e2e-grid-min-height`; NFR-04 `test-e2e-grid-names-two-lines`
(sin elegir y elegidos con choque) y `test-grid-name-fit`; NFR-05 `test-schedule-data-matches-source`.
Amenazas: R-01 test de la acción con el usuario de la sesión, R-04 `test-selection-isolated-users`,
R-10 `test-selection-concurrent`, R-11 `test-e2e-grid-no-store`, R-07 sin `dangerouslySetInnerHTML`.

## Spec blocks
- ✅ Block 1 — datos versionados, esquema y migración, `festival-time.ts`, `schedule-types.ts`, `database-url.ts` en `src/lib`, seed, `tsconfig`, `prisma.config.ts`, `db:seed`, CI, script de Docker, AGENTS.md y README; todas las tareas hechas
- ✅ Block 2 — `schedule-layout.ts`, `clashes.ts`, `selection-messages.ts`, `src/server/schedule.ts`, `src/server/selection.ts`, `selection-actions.ts`; todas las tareas hechas
- ✅ Block 3 — dependencias exactas, `tabs`/`alert-dialog`/`drawer` de shadcn, `day-picker`, `schedule-grid`, `pending-bar`, `app-menu`, `schedule-screen`, `page.tsx` sin la presentación, `globals.css`; todas las tareas hechas (más las correcciones de NFR-04 y del toggle, registradas en decisions)
- ✅ Block 4 — `grid.spec.ts`, `grid.ts`, `performance.spec.ts`, y `home`, `auth` y `demo` adaptados; todas las tareas hechas

Desvíos de la spec registrados en `docs/daw/specs/decisions-FEAT-003a.md`.

## Required tests de la spec
- ✅ Block 1: `test-poster-time-after-midnight`, `test-format-clock`, `test-festival-day-during`, `test-festival-day-outside`, `test-schedule-data-matches-source`, `test-schedule-data-after-midnight`, `test-database-url-lib-invalid`, `test-seed-idempotent`, `test-seed-invalid-schedule-rejected`, `test-seed-orphaned-rejected`, `test-seed-unsafe-url-rejected`, `test-seed-db-error`, `test-workflow-seed-step`
- ✅ Block 2: `test-layout-geometry`, `test-layout-axis-after-midnight`, `test-layout-min-height`, `test-clashes-overlap`, `test-clashes-edge-rejected`, `test-selection-messages`, `test-schedule-memo-error`, `test-selection-invalid-rejected`, `test-selection-action-unauthorized`, `test-selection-db-error`, `test-selection-save-replace`, `test-selection-isolated-users`, `test-selection-concurrent`, `test-selection-latency`
- ✅ Block 3: `test-grid-render`, `test-grid-block-content`, `test-grid-clash-mark`, `test-day-picker-switch`, `test-screen-toggle`, `test-screen-pending-across-days`, `test-screen-pending-bar`, `test-screen-discard`, `test-screen-save-ok`, `test-screen-save-error`, `test-screen-save-network-error`, `test-screen-leave-confirm`, `test-screen-beforeunload`, `test-app-menu`, `test-page-load-error`
- ✅ Block 4: `test-e2e-grid-all-shows`, `test-e2e-grid-columns`, `test-e2e-grid-block-content`, `test-e2e-grid-geometry`, `test-e2e-grid-after-midnight`, `test-e2e-grid-day-switch`, `test-e2e-grid-three-columns`, `test-e2e-grid-sticky`, `test-e2e-grid-initial-day`, `test-e2e-grid-toggle`, `test-e2e-grid-save-persists`, `test-e2e-grid-pending-across-days`, `test-e2e-grid-pending-bar`, `test-e2e-grid-discard`, `test-e2e-grid-leave-confirm`, `test-e2e-grid-clash`, `test-e2e-grid-edge-no-clash`, `test-e2e-grid-requires-session`, `test-e2e-grid-min-height`, `test-e2e-grid-names-two-lines`, `test-e2e-grid-no-store`, `test-e2e-grid-load-4g`
- ✅ test-e2e-existing-suites — compromiso agregado, no un test con ese nombre: `home.spec.ts`, `auth.spec.ts` y `demo.spec.ts` adaptados pasan en los proyectos donde corren (los 3 mobile; `desktop` solo corre `/demo`), en la corrida del cierre de CODE

## Tests
- ✅ Sad-path tests: cada función que recibe input tiene al menos uno — `saveSelection` (`test-selection-invalid-rejected`, `test-selection-db-error`, id desconocido con la base intacta), `saveSelectionAction` (`test-selection-action-unauthorized`), el seed (`test-seed-invalid-schedule-rejected`, `test-seed-orphaned-rejected`, `test-seed-unsafe-url-rejected`, `test-seed-db-error`, archivo faltante y JSON roto), la pantalla (`test-screen-save-error`, `test-screen-save-network-error`, `test-page-load-error`)

## Warnings (no bloquean)
- W-VER-02: `prisma/seed.ts` al 89 % de líneas y 82 % de ramas, fuera del `include` de cobertura; varios casos de `SCHEDULE_INVALID` documentados (ids o posiciones repetidos, fin ≤ inicio, fecha inexistente, formas inválidas), el fallo de conexión y el punto de entrada no tienen test propio.
- W-VER-01: `parseSchedule` se exporta desde `prisma/seed.ts` y solo se usa adentro; la rama `day ? … : null` de `schedule-screen.tsx:134` es defensiva e inalcanzable (`page.tsx` descarta una grilla sin días).
- W-VER-03: `test-e2e-grid-initial-day` usa el reloj real, con una precondición explícita ("hoy no es día del festival"); `test-selection-latency` y `test-e2e-grid-load-4g` dependen del tiempo (lo piden NFR-02 y NFR-01) y pueden ser intermitentes en una CI cargada; `test-grid-name-fit` fija clases de Tailwind (lo que verifica NFR-04 de verdad es el E2E); los tests de integración comparten la base sembrada.
- AC-04 frente al alto mínimo: los dos shows de 20 minutos miden 44 px y no 40; ninguno se monta sobre el siguiente de su columna (decisión registrada).
- AC-28: la fuente no tiene shows de exactamente 30 minutos; el E2E prueba los de 20 (más exigente) y el unit prueba 15 y 30.
- SAST: High de `picomatch` en devDependencies aceptado por el usuario como excepción dev-only (`docs/daw/security/sast-FEAT-003a.md`).
- Los E2E no se re-ejecutaron en VERIFY; el 202/203 es del cierre de CODE sobre `e1b1a63` (solo documentación agregada encima).

## Para CLOSEOUT
- Que la CI quede en verde en el PR con los tres jobs (`quality`, `integration`, `e2e`), incluido el paso `pnpm db:seed`.

Result: PASSED
