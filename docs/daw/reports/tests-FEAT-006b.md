# Test run FEAT-006b

Corrida del cierre de CODE: suite completa. Incluye unit con cobertura, integración contra
PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, base de tests `mi_grilla_test` de
`TEST_DATABASE_URL`, migrada y sembrada, nunca la de desarrollo) y E2E de los 4 proyectos de
Playwright, dentro de la imagen oficial `mcr.microsoft.com/playwright:v1.65.1-noble` con la red del
host (`pnpm test:e2e:docker`), porque a WebKit le faltan bibliotecas del sistema en este host.
Corrida el 2026-11-18 sobre `dca7e0c`, en el worktree `mi-grilla-mug--wt-feat-006b`, con Node
24.22.2.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && DATABASE_URL="$TEST_DATABASE_URL" pnpm test:integration && DATABASE_URL="$TEST_DATABASE_URL" pnpm test:e2e:docker --reporter=line` |
| Total | 1002 |
| Passed | 997 |
| Failed | 0 |
| Skipped | 5 |
| Line coverage | 99.59% |
| Branch coverage | 97.25% |
| Function coverage | 99.5% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 588 tests en 69 archivos.
- **Integración:** 103 tests en 9 archivos (incluye `groups.test.ts`, con los tests de concurrencia
  de las salidas simultáneas, y `group-actions.test.ts` con las cuatro acciones nuevas).
- **E2E:** 311 ejecuciones en los 4 proyectos (`iphone-webkit`, `mobile-chromium`, `mobile-360` y
  `desktop`). Pasan 306 y se saltean 5, en 3,8 min. Incluye `groups-admin.spec.ts` (8 tests por
  proyecto mobile).
- **Cobertura:** es la de la suite unitaria (statements 99,47 %).

## Failures
(none)

## Skips
- `live.spec.ts` AC-22 en `mobile-chromium` — motivo: AC-22 es gate solo en iphone-webkit (`OPENING_SKIP`, desde FEAT-005a)
- `live.spec.ts` AC-22 en `mobile-360` — motivo: AC-22 es gate solo en iphone-webkit (`OPENING_SKIP`, desde FEAT-005a)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `grid.spec.ts` beforeunload en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
