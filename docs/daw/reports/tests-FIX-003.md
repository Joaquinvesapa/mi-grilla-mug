# Test run FIX-003

Corrida del cierre de CODE de FIX-003: suite completa. Incluye unit con cobertura, integración
contra PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, migrada y sembrada) y E2E de los
4 proyectos de Playwright contra el build de producción, como pide `AGENTS.md` para el cierre de
CODE.

Los 4 proyectos E2E corren dentro de la imagen oficial `mcr.microsoft.com/playwright:v1.65.1-noble`
con `pnpm test:e2e:docker`, porque a WebKit le faltan bibliotecas del sistema en este host. Corrida
el 2026-11-18 en el worktree de FIX-003, sobre `0d3ea36` más los cambios de código de FIX-003 sin
commitear.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm test && pnpm test:integration && pnpm build && pnpm test:e2e:docker` |
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
- **Unit:** 422 tests en 47 archivos (uno más que en FIX-001:
  `test-wallpaper-clear-of-lock-screen-buttons`).
- **Integración:** 48 tests en 6 archivos.
- **E2E:** 254 ejecuciones en los 4 proyectos: 251 pasan y 3 se saltean. Los 7 tests de
  `wallpaper.spec.ts` que leen píxeles del PNG corren con `AXIS_BOTTOM = 2404`.
- **Cobertura:** es la de la suite unitaria (statements 99,33 %).
- **Evidencia TDD:** con el test de regresión escrito y `SAFE_BOTTOM = 224`,
  `tests/unit/lib/wallpaper-layout.test.ts` dio 1 failed | 20 passed (21);
  `test-wallpaper-clear-of-lock-screen-buttons` falló en `expected 224 to be 392`. Después del fix
  (`SAFE_BOTTOM = 392`, `BLOCK_PADDING_Y = 4` y los números de los tests ajustados a 2404), 21/21.

## Failures
(none)

## Skips
- `grid.spec.ts` beforeunload en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
