# Test run FEAT-006a

Corrida del cierre de CODE: suite completa. Incluye unit con cobertura, integración contra
PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, migrada con la migración de grupos y
sembrada) y E2E de los 4 proyectos de Playwright, dentro de la imagen oficial
`mcr.microsoft.com/playwright:v1.65.1-noble` con la red del host (`pnpm test:e2e:docker`), porque a
WebKit le faltan bibliotecas del sistema en este host. Corrida el 2026-11-18 sobre `bd98d78`, en el
worktree `mi-grilla-mug--wt-feat-006a`, con Node 24.22.2.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:integration && pnpm test:e2e:docker --reporter=line --output=/home/e2e/pw-out` (el `--output` va a un volumen del contenedor porque `test-results/` del repo quedó con dueño root de corridas viejas) |
| Total | 857 |
| Passed | 854 |
| Failed | 0 |
| Skipped | 3 |
| Line coverage | 99.6% |
| Branch coverage | 97.16% |
| Function coverage | 99.39% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 508 tests en 61 archivos.
- **Integración:** 80 tests en 9 archivos (incluye `groups.test.ts`, `group-actions.test.ts` y
  `auth-actions.test.ts`, con los tests de concurrencia que fuerzan los locks).
- **E2E:** 269 ejecuciones en los 4 proyectos (`iphone-webkit`, `mobile-chromium`, `mobile-360` y
  `desktop`). Pasan 266 y se saltean 3, en 2,5 min. Incluye `groups.spec.ts` (5 tests por proyecto
  mobile) y `pwa.spec.ts` con `/grupos` e `/invitacion/<token>` en las páginas que no se cachean.
- **Cobertura:** es la de la suite unitaria (statements 99,47 %).

## Failures
(none)

## Skips
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `grid.spec.ts` beforeunload en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
