# Test run FEAT-003b

Corrida del cierre de CODE (Blocks 1–4, con las rondas de corrección de los bloques 2, 3 y 4 y el
Spec loop 1): suite completa — unit con cobertura, integración contra PostgreSQL real
(`postgres:17.12` de `docker-compose.yml`, migrada y sembrada con `pnpm db:seed`) y E2E de los 4
proyectos de Playwright dentro de la imagen oficial `mcr.microsoft.com/playwright:v1.65.1-noble` con
la red del host (WebKit no está instalado en este host). Corrida el 2026-11-17 sobre `62867a4`, con
Node 24.22.2 (el `node` del PATH del host es v20 y Vitest no arranca con él).

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:integration && CI=1 bash /tmp/e2e-docker-rootless.sh` (equivalente a `CI=1 pnpm test:e2e:docker` con `--user 0:0`, porque el Docker de este host es rootless) |
| Total | 632 |
| Passed | 631 |
| Failed | 0 |
| Skipped | 1 |
| Line coverage | 99.43% |
| Branch coverage | 98.19% |
| Function coverage | 99.03% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — 150 archivos OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle: 354 tests unitarios en 42 archivos + 48 de integración en 6 archivos + 230 ejecuciones E2E
en los 4 proyectos (`iphone-webkit`, `mobile-chromium`, `mobile-360` y `desktop`), de las cuales
229 pasan y 1 se saltea. La cobertura es la de la suite unitaria (statements 99,19 %). Los 9 casos
nuevos de `tests/e2e/offline.spec.ts` corren en los tres proyectos mobile; NFR-01 medido en el E2E
de sincronización con `request.timing()` quedó entre 21 y 74 ms.

## Failures
(none)

## Skips
- `test-e2e-grid-leave-beforeunload` [iphone-webkit] — iOS Safari y la PWA instalada no respetan `beforeunload`; la decisión de la spec de FEAT-003a (FR-12) lo limita a Chromium. Skip preexistente, sin cambios en este ticket; el motivo está en la línea del `test.skip`.
