# Test run FEAT-002

Corrida del cierre de CODE (Blocks 1–4): suite completa — unit con cobertura, integración contra
PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, base migrada con
`20261117151501_accounts`) y E2E de los 4 proyectos de Playwright dentro de la imagen oficial con
la red del host (WebKit no arranca en este host). Corrida el 2026-11-17 sobre `65e5ca7`.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:integration && CI=1 pnpm test:e2e:docker` |
| Total | 357 |
| Passed | 357 |
| Failed | 0 |
| Skipped | 0 |
| Line coverage | 99.67% |
| Branch coverage | 98.08% |
| Function coverage | 98.73% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — 95 archivos OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle: 196 tests unitarios en 22 archivos + 31 de integración en 4 archivos (health, cuentas,
bloqueo por email y el guard de la base) + 130 ejecuciones E2E en los 4 proyectos
(`iphone-webkit` 41, `mobile-chromium` 44, `mobile-360` 41, `desktop` 4). La cobertura es la de la
suite unitaria (statements 99,36 %).

## Failures
(none)

## Skips
(none)
