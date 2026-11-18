# Test run FIX-004

Corrida del cierre de CODE de FIX-004: suite completa, como pide `AGENTS.md` para el cierre de CODE.
Incluye unit con cobertura, integración contra PostgreSQL real (`mi_grilla_test`, la base nueva de
tests del `postgres:17.12` de `docker-compose.yml`, preparada con `pnpm db:test:prepare`) y E2E de
los 4 proyectos de Playwright dentro de `mcr.microsoft.com/playwright:v1.65.1-noble`
(`pnpm test:e2e:docker`). Corrida el 2026-11-18 sobre `8de19e6`, con los cambios de FIX-004 todavía
sin commitear.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm test && pnpm test:integration` en el host (Node 24.22.2) + `pnpm test:e2e:docker --reporter=line` |
| Total | 925 |
| Passed | 920 |
| Failed | 0 |
| Skipped | 5 |
| Line coverage | 99.55% |
| Branch coverage | 97.25% |
| Function coverage | 99.45% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 557 tests en 67 archivos. Nuevos: `tests/unit/test-database.test.ts` (6 tests) y, en
  `tests/unit/ci/workflow.test.ts`, `test-workflow-test-database` y
  `test-e2e-docker-forwards-test-database`.
- **Integración:** 81 tests en 10 archivos, contra `mi_grilla_test`. Nuevo:
  `test-integration-runs-on-test-database` (regresión).
- **E2E:** 287 ejecuciones en los 4 proyectos: 282 pasan y 5 se saltean (3.2 min), con
  `next start` levantado contra `mi_grilla_test`.
- **Cobertura:** es la de la suite unitaria (statements 99,43 %). `tests/` no entra en el coverage
  (`vitest.config.ts`).
- **Evidencia TDD:** con `tests/integration/setup.ts` sin cambios y `DATABASE_URL` apuntando a una
  base descartable (nunca a la de desarrollo), `test-integration-runs-on-test-database` falló en
  `tests/integration/test-database.test.ts:16` con `AssertionError: DATABASE_URL no es la base de
  TEST_DATABASE_URL: expected false to be true`; los 6 tests de `tests/unit/test-database.test.ts`
  fallaron con `Cannot find module '../test-database.ts'`; `test-workflow-test-database` falló con
  `expected [ 'integration', 'e2e' ] to deeply equal []` y `test-e2e-docker-forwards-test-database`
  con `expected [ 'CI', 'DATABASE_URL', …(1) ] to include 'TEST_DATABASE_URL'`. Después del fix,
  todos pasan.
- **Base de desarrollo intacta (AC-03, AC-04):** `users` de `mi_grilla`: 452 antes y después de la
  integración y de los E2E (450 de ellos `@example.com`, que ya estaban). `users` de `mi_grilla_test`
  después de los E2E: 233, todos `@example.com`.
- **Corrida previa descartada:** el primer intento de los E2E se cortó antes de correr un test con
  `EACCES` sobre `test-results/.last-run.json`: el directorio era de root, de una corrida de la
  madrugada anterior a este ticket. Se borró (es salida generada, ignorada por git) y se corrió de
  nuevo; esta es esa corrida.

## Failures
(none)

## Skips
- `[iphone-webkit] tests/e2e/grid.spec.ts:436` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`).
- `[mobile-chromium] tests/e2e/live.spec.ts:445` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`).
- `[mobile-360] tests/e2e/live.spec.ts:445` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`).
- `[mobile-chromium] tests/e2e/wallpaper.spec.ts:591` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`).
- `[mobile-360] tests/e2e/wallpaper.spec.ts:591` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`).
