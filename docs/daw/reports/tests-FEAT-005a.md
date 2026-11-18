# Test run FEAT-005a

Corrida del cierre de CODE: suite completa. Incluye unit con cobertura, integración contra
PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, migrada y sembrada) y E2E de los 4
proyectos de Playwright. Los E2E corren dentro de la imagen oficial
`mcr.microsoft.com/playwright:v1.65.1-noble` con la red del host (`pnpm test:e2e:docker`), porque
a WebKit le faltan bibliotecas del sistema en este host (libicu74, libxml2). Corrida el 2026-11-18
sobre `b9af62b` (re-cierre de CODE tras la vuelta 3 de la spec, que solo agregó ids `test-…`; el
código es el mismo de `1cecf85`), con Node 24.22.2 (el `node` del PATH del host es v26). Esta
corrida reemplaza a la anterior sobre `1cecf85`, que dio los mismos números.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:integration && pnpm test:e2e:docker --reporter=line --output=/home/e2e/pw-out` (el `--output` va a un volumen del contenedor porque `test-results/` del repo quedó con dueño root de corridas viejas) |
| Total | 783 |
| Passed | 778 |
| Failed | 0 |
| Skipped | 5 |
| Line coverage | 99.45% |
| Branch coverage | 97.73% |
| Function coverage | 99.33% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 463 tests en 52 archivos.
- **Integración:** 48 tests en 6 archivos.
- **E2E:** 272 ejecuciones en los 4 proyectos (`iphone-webkit`, `mobile-chromium`, `mobile-360` y
  `desktop`). Pasan 267 y se saltean 5, en 2,8 min. Incluye `grid.spec.ts`, `wallpaper.spec.ts`,
  `offline.spec.ts` y `demo.spec.ts`: el botón "En vivo" no intercepta sus clics (G12).
- **Cobertura:** es la de la suite unitaria (statements 99,31 %).
- **Casos nuevos:**
  - `tests/e2e/live.spec.ts`: 6 tests por proyecto mobile (10 tests de la spec como test o
    `test.step`).
  - Unit: `tests/unit/lib/live-now.test.ts`, `live-messages.test.ts`,
    `tests/unit/components/use-now.test.tsx`, `live-panel.test.tsx`, `live-button.test.tsx`, y
    casos nuevos en `festival-time.test.ts`, `schedule-screen.test.tsx` y `schedule-grid.test.tsx`.
- **AC-22:** el E2E afirma la animación de 250 ms y que termina; el tiempo total desde el toque se
  anota (255–356 ms en el contenedor) y se verifica en un iPhone real en VERIFY
  (`decisions-FEAT-005a.md`).

## Failures
(none)

## Skips
- `live.spec.ts` "live: el panel abre en ≤ 300 ms" en `mobile-chromium` — motivo: AC-22 se mide solo en WebKit (`OPENING_SKIP`)
- `live.spec.ts` "live: el panel abre en ≤ 300 ms" en `mobile-360` — motivo: AC-22 se mide solo en WebKit (`OPENING_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `grid.spec.ts` beforeunload en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
