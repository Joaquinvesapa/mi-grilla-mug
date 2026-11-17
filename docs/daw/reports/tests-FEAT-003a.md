# Test run FEAT-003a

Corrida del cierre de CODE (Blocks 1–4 más las correcciones del Block 3): suite completa — unit con
cobertura, integración contra PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, base
migrada con `20261117185304_schedule` y sembrada con `pnpm db:seed`) y E2E de los 4 proyectos de
Playwright dentro de la imagen oficial con la red del host (WebKit no arranca en este host).
Corrida el 2026-11-17 sobre `e1b1a63`.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:integration && CI=1 pnpm test:e2e:docker` |
| Total | 522 |
| Passed | 521 |
| Failed | 0 |
| Skipped | 1 |
| Line coverage | 99.8% |
| Branch coverage | 98.43% |
| Function coverage | 99.34% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — 135 archivos OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle: 273 tests unitarios en 36 archivos + 46 de integración en 6 archivos (health, cuentas,
bloqueo por email, guard de la base, seed y selección) + 203 ejecuciones E2E en los 4 proyectos
(`iphone-webkit` 65, `mobile-chromium` 69, `mobile-360` 65, `desktop` 4), de las cuales 202 pasan y
1 se saltea. La cobertura es la de la suite unitaria (statements 99,62 %).

## Failures
(none)

## Skips
- `test-e2e-grid-leave-beforeunload` [iphone-webkit] — iOS Safari y la PWA instalada no respetan `beforeunload`; la decisión de la spec (FR-12) lo limita a Chromium y AC-16 se cubre en WebKit con el diálogo de "Cerrar sesión" (`test-e2e-grid-leave-confirm`). El motivo está en la línea del `test.skip`.
