# Test run FEAT-005b

Corrida del cierre de CODE de FEAT-005b: la suite completa, como pide `AGENTS.md` para el cierre de
CODE. Incluye unit con cobertura, integración contra PostgreSQL real y E2E en los 4 proyectos de
Playwright, dentro de `mcr.microsoft.com/playwright:v1.65.1-noble` (`pnpm test:e2e:docker`). La
base es `mi_grilla_feat005b`, una base de tests propia de este worktree en el `postgres:17.12` de
`docker-compose.yml`, preparada con `pnpm db:test:prepare`. Corrida el 2026-11-18 sobre `c33e325`
(los 4 bloques de FEAT-005b más el merge de `origin/main`, que trae FIX-004).

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm db:test:prepare && pnpm test && pnpm test:integration` en el host + `pnpm test:e2e:docker` |
| Total | 956 |
| Passed | 951 |
| Failed | 0 |
| Skipped | 5 |
| Line coverage | 99.59% |
| Branch coverage | 97.09% |
| Function coverage | 99.5% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 584 tests en 71 archivos, todos pasan. Los tests nuevos de FEAT-005b (reloj puro, store
  del reloj, control y escenario de `/demo`, y su uso en la grilla y en En vivo) se escribieron y se
  vieron fallar en cada bloque. La evidencia TDD está en `.daw-work/review-block-1.md` a
  `review-block-4.md`, con el veredicto del verificador.
- **Integración:** 81 tests en 10 archivos, todos pasan, contra `mi_grilla_feat005b`.
- **E2E:** 291 ejecuciones en los 4 proyectos (4 workers): 286 pasan y 5 se saltean, en 3.1 min.
  Los 4 tests nuevos del reloj de `/demo` (`demo.spec.ts`: AC-16, AC-17, AC-18 y AC-19) corren en
  el proyecto `desktop`, el único que abre `/demo`, y pasan.
- **Cobertura:** sale de la suite unitaria (statements 99,48 %). `tests/` no entra en el coverage
  (`vitest.config.ts`).
- **Entorno:** en el host, Node v26.13.0, no la 24 que pide `.nvmrc`. Los E2E corren con el Node de
  la imagen de Playwright. La CI corre con Node 24 y vuelve a correr la suite en el PR.
- **Base de tests propia:** el `.env` de este worktree pasó de `mi_grilla_test`, la base compartida
  con las otras sesiones, a `mi_grilla_feat005b`. Así ninguna otra corrida le vacía la base a esta.
  La base de desarrollo (`DATABASE_URL`) no se tocó.

## Failures
(none)

## Skips
- `[iphone-webkit] tests/e2e/grid.spec.ts:436` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`).
- `[mobile-chromium] tests/e2e/live.spec.ts:445` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`).
- `[mobile-360] tests/e2e/live.spec.ts:445` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`).
- `[mobile-chromium] tests/e2e/wallpaper.spec.ts:591` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`).
- `[mobile-360] tests/e2e/wallpaper.spec.ts:591` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`).
