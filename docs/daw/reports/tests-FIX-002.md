# Test run FIX-002

Corrida del cierre de CODE de FIX-002: suite completa. Incluye unit con cobertura, integración contra
PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, migrada y sembrada) y E2E de los 4
proyectos de Playwright, como pide `AGENTS.md` para el cierre de CODE.

Los 4 proyectos E2E corren dentro de `mcr.microsoft.com/playwright:v1.65.1-noble`, la misma imagen
que desde este ticket usa el job `e2e` de la CI. Se usó la red del host y no `--user`, con volúmenes
propios: el Docker de este host es rootless (Cortex #8514). Corrida el 2026-11-18 sobre `387ae32`, con
los cambios de FIX-002 todavía sin commitear.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm test && pnpm test:integration` en el host (Node 24.22.2) + `pnpm test:e2e --reporter=line` dentro de `mcr.microsoft.com/playwright:v1.65.1-noble` (el `docker run` de `scripts/test-e2e-docker.sh` sin `--user`) |
| Total | 724 |
| Passed | 721 |
| Failed | 0 |
| Skipped | 3 |
| Line coverage | 99.5% |
| Branch coverage | 97.64% |
| Function coverage | 99.23% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 422 tests en 47 archivos, uno más que en FIX-001. Se reemplazó el test del job `e2e`
  por `test-workflow-e2e-container` y se sumó `test-e2e-docker-image`.
- **Integración:** 48 tests en 6 archivos.
- **E2E:** 254 ejecuciones en los 4 proyectos: 251 pasan y 3 se saltean (2.4 min).
- **Cobertura:** es la de la suite unitaria (statements 99,33 %).
- **Evidencia TDD** (`.daw-work/tdd-FIX-002.md`): con el test escrito y `ci.yml` sin cambios,
  `tests/unit/ci/workflow.test.ts` dio 1 failed | 20 passed (21). `test-workflow-e2e-container`
  falló en `workflow.test.ts:407` con `imagen del container inválida: undefined, se esperaba
  mcr.microsoft.com/playwright:v1.65.1-noble`. Después del cambio, 21/21.
- **Lint en la primera pasada:** dos `no-base-to-string` en el helper nuevo, que se corrigieron
  (`JSON.stringify` para `with.path` y chequeo de tipo para `DATABASE_URL`).

## Failures
(none)

## Skips
- `grid.spec.ts` beforeunload en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
