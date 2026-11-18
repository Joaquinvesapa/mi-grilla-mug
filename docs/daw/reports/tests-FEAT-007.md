# Test run FEAT-007

Corrida de la suite completa en el cierre de CODE de FEAT-007, sobre `67d0e5e` (los 4 bloques y la
acción principal fija de la hoja, commiteados), con `main` sin commits nuevos respecto de la rama.

Abarca:
- unit con cobertura;
- integración contra PostgreSQL real, en la base de tests (`TEST_DATABASE_URL`, preparada con
  `pnpm db:test:prepare` durante el Block 4);
- E2E de los 4 proyectos de Playwright contra el build de producción, que levanta la app con la
  base de tests.

Los 3 proyectos Chromium corrieron en el host. `iphone-webkit` corrió con `pnpm test:e2e:docker`,
dentro de la imagen `mcr.microsoft.com/playwright:v1.65.1-noble` con la red del host, porque a
WebKit le faltan bibliotecas del sistema en este host (Arch).

Corrida el 2026-11-18 sobre `67d0e5e`, en el repo principal, rama `feat/FEAT-007-fondo-grupo`.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm test:integration && pnpm test:e2e --project=mobile-chromium --project=mobile-360 --project=desktop && pnpm test:e2e:docker --project=iphone-webkit` |
| Total | 1240 |
| Passed | 1233 |
| Failed | 0 |
| Skipped | 7 |
| Line coverage | 99.55% |
| Branch coverage | 97.18% |
| Function coverage | 99.59% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 766 tests en 77 archivos. Incluye los tests nuevos de FEAT-007: el layout con grupo
  (`wallpaper-layout.test.ts`, `group-picks.test.ts`), el dibujo de las píldoras
  (`wallpaper-canvas.test.ts`), la hoja con "Grilla sola / Con amigos", el selector y la acción
  fija (`wallpaper-button.test.tsx`), `schedule-screen`, `group-picker` y `wallpaper-messages`.
- **Integración:** 110 tests en 10 archivos, sin cambios: FEAT-007 no toca el server ni la base.
- **E2E, 3 proyectos Chromium:** 247 ejecuciones (`mobile-chromium`, `mobile-360` y `desktop`), de
  las que 241 pasan y 6 se saltean, en 2,1 min. Incluye `wallpaper-group.spec.ts` (6 tests por
  proyecto mobile) y `wallpaper.spec.ts` con los helpers movidos a `tests/e2e/wallpaper.ts`.
- **E2E, `iphone-webkit`:** 117 ejecuciones, de las que 116 pasan y 1 se saltea, en 1,8 min.
  Incluye `test-e2e-wallpaper-group-budget` (AC-19: vista previa con 19 amigos dentro de
  `PREVIEW_BUDGET_MS`).
- **Cobertura:** es la de la suite unitaria (statements 99,42 %).
- **Entorno:** la shell del host usó Node v26.13.0, no el 24 de `.nvmrc`; la CI corre con Node 24.

## Failures
(none)

## Skips
- `live.spec.ts` "live: el panel abre en ≤ 300 ms" en `mobile-chromium` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`)
- `live.spec.ts` "live: el panel abre en ≤ 300 ms" en `mobile-360` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper-group.spec.ts` `test-e2e-wallpaper-group-budget` en `mobile-chromium` — motivo: AC-19 de FEAT-007 se mide solo en WebKit (`BUDGET_SKIP`)
- `wallpaper-group.spec.ts` `test-e2e-wallpaper-group-budget` en `mobile-360` — motivo: AC-19 de FEAT-007 se mide solo en WebKit (`BUDGET_SKIP`)
- `grid.spec.ts` `test-e2e-grid-leave-beforeunload` en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
