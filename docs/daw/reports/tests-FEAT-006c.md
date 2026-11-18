# Test run FEAT-006c

Corrida de la suite completa después de traer `main` a la rama en CLOSEOUT (merge `3c9b1d8`, con
FEAT-006b y FIX-004). Reemplaza a la corrida del cierre de CODE sobre `0cef9f8`, que dio 1040
pasados, 0 fallidos y 5 salteados sobre 1045. Abarca:
- unit con cobertura;
- integración contra PostgreSQL real, en la base de tests de FIX-004: `TEST_DATABASE_URL` →
  `mi_grilla_feat006c`, propia del worktree, preparada con `pnpm db:test:prepare`;
- E2E de los 4 proyectos de Playwright contra el build de producción, que levanta la app con la
  base de tests.

Los 3 proyectos Chromium corrieron en el host. `iphone-webkit` corrió con `pnpm test:e2e:docker`,
dentro de la imagen `mcr.microsoft.com/playwright:v1.65.1-noble` con la red del host, porque a
WebKit le faltan bibliotecas del sistema en este host.

Corrida el 2026-11-18 sobre `3c9b1d8`, en el worktree `mi-grilla-mug--wt-feat-006c`, con Node
24.22.2.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm db:test:prepare && pnpm test && pnpm test:integration && pnpm build && pnpm test:e2e --project=mobile-chromium --project=mobile-360 --project=desktop --output=<scratchpad> && pnpm test:e2e:docker --project=iphone-webkit --output=<scratchpad>` |
| Total | 1139 |
| Passed | 1134 |
| Failed | 0 |
| Skipped | 5 |
| Line coverage | 99.62% |
| Branch coverage | 97.48% |
| Function coverage | 99.54% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 687 tests en 73 archivos. Incluye `group-picks`, `group-picker`, las iniciales y los
  bloques cortos de `schedule-grid`, la elección de grupo en `device-store` y `schedule-screen`, el
  guard del helper de E2E (`tests/unit/e2e/db.test.ts`, que ahora rechaza también la base de
  desarrollo) y los tests de FEAT-006b y FIX-004 que trajo `main`.
- **Integración:** 110 tests en 10 archivos. Incluye `listGroupPicks` en `groups.test.ts`
  (privacidad con un tercero, orden, solo lo guardado y sin ids de cuenta), junto a los tests de
  administrar y salir de FEAT-006b.
- **E2E, 3 proyectos Chromium:** 231 ejecuciones (`mobile-chromium`, `mobile-360` y `desktop`), de
  las que 227 pasan y 4 se saltean, en 2,0 min. Incluye:
  - `group-grid.spec.ts` (10 tests por proyecto mobile, entre ellos `test-e2e-group-grid-fit`);
  - `performance.spec.ts` con `test-e2e-group-grid-load` (AC-30).
- **E2E, `iphone-webkit`:** 111 ejecuciones, de las que 110 pasan y 1 se saltea, en 1,7 min.
- **Cobertura:** es la de la suite unitaria (statements 99,46 %).

## Failures
(none)

## Skips
- `live.spec.ts` "live: el panel abre en ≤ 300 ms" en `mobile-chromium` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`)
- `live.spec.ts` "live: el panel abre en ≤ 300 ms" en `mobile-360` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`)
- `grid.spec.ts` `test-e2e-grid-leave-beforeunload` en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
