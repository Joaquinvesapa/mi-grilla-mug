# Test run FEAT-001

Corrida del cierre de CODE (Blocks 1–6): suite completa — unit con cobertura, integración contra
PostgreSQL real (`postgres:17.12` de `docker-compose.yml`) y E2E de los 4 proyectos de Playwright
dentro de la imagen oficial (WebKit no arranca en este host). Corrida el 2026-11-17 sobre
`36f09fd` más la remediación de SAST sin commitear (`serwist` y `@serwist/turbopack` 9.5.15).

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:integration && CI=1 pnpm test:e2e:docker` |
| Total | 194 |
| Passed | 194 |
| Failed | 0 |
| Skipped | 0 |
| Line coverage | 99.02% |
| Branch coverage | 94.87% |
| Function coverage | 97.14% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — 61 archivos OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle: 98 tests unitarios en 13 archivos + 9 de integración (`GET /api/health` y su latencia,
contra la base real) + 87 ejecuciones E2E en los 4 proyectos (`iphone-webkit`, `mobile-chromium`,
`mobile-360` y `desktop`). La cobertura es la de la suite unitaria (statements 98,14 %).

## Failures
(none)

## Skips
(none)
