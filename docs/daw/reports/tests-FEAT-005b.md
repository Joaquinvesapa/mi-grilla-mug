# Test run FEAT-005b

Corrida del re-cierre de CODE de FEAT-005b, después de traer `main` otra vez. `main` sumó FEAT-006b
(PR #13) cuando FEAT-005b ya estaba en VERIFY, así que se volvió a CODE (`VERIFY → CODE`), se
mergeó (`c1a9462`) y se corrió de nuevo la suite completa, como pide `AGENTS.md`. La corrida incluye:

- unit con cobertura;
- integración contra PostgreSQL real;
- E2E en los 4 proyectos de Playwright, dentro de `mcr.microsoft.com/playwright:v1.65.1-noble`
  (`pnpm test:e2e:docker`).

La base de tests es `mi_grilla_feat005b`, propia de este worktree, en el `postgres:17.12` de
`docker-compose.yml`, preparada con `pnpm db:test:prepare`. Corrida el 2026-11-18 sobre `c1a9462`:
los 4 bloques de FEAT-005b más los merges de FIX-004 (`c33e325`) y de FEAT-006b (`c1a9462`).

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm db:test:prepare && pnpm test && pnpm test:integration` en el host + `pnpm test:e2e:docker` |
| Total | 1041 |
| Passed | 1036 |
| Failed | 0 |
| Skipped | 5 |
| Line coverage | 99.61% |
| Branch coverage | 97.1% |
| Function coverage | 99.54% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** pasan los 622 tests de 74 archivos. Los tests de FEAT-005b (reloj puro, store del reloj,
  control y escenario de `/demo`, y su uso en la grilla y en En vivo) se escribieron y se vieron
  fallar bloque por bloque. La evidencia TDD, con el veredicto del verificador, está en
  `.daw-work/review-block-1.md` a `review-block-4.md`.
- **Integración:** pasan los 104 tests de 10 archivos, contra `mi_grilla_feat005b`. Son 23 más que
  en la corrida anterior: los suma FEAT-006b.
- **E2E:** de las 315 ejecuciones en los 4 proyectos (4 workers, 4.5 min), 310 pasan y 5 se
  saltean. Los 4 tests del reloj de `/demo` (`demo.spec.ts`: AC-16, AC-17, AC-18 y AC-19) corren y
  pasan en el proyecto `desktop`, el único que abre `/demo`. También pasa
  `tests/e2e/groups-admin.spec.ts`, que trae FEAT-006b.
- **Cobertura:** sale de la suite unitaria (statements 99,51 %). `tests/` no entra en el coverage
  (`vitest.config.ts`).
- **Entorno:** el host tiene Node v26.13.0, no la 24 de `.nvmrc`. Los E2E corren con el Node de la
  imagen de Playwright, y la CI vuelve a correr la suite con Node 24 en el PR.
- **Base de tests propia:** en el `.env` de este worktree, `TEST_DATABASE_URL` pasó de
  `mi_grilla_test`, que comparten las otras sesiones, a `mi_grilla_feat005b`, para que otra corrida
  no vacíe la base en medio de esta. La base de desarrollo (`DATABASE_URL`) no se tocó.
- **Corrida anterior:** la del cierre de CODE sobre `c33e325` (956 tests: 951 pasan y 5 se saltean)
  queda reemplazada por esta, porque el merge de FEAT-006b cambió el código.

## Failures
(none)

## Skips
- `[iphone-webkit] tests/e2e/grid.spec.ts:436` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`).
- `[mobile-chromium] tests/e2e/live.spec.ts:445` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`).
- `[mobile-360] tests/e2e/live.spec.ts:445` — motivo: AC-22 de FEAT-005a se mide solo en WebKit (`OPENING_SKIP`).
- `[mobile-chromium] tests/e2e/wallpaper.spec.ts:591` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`).
- `[mobile-360] tests/e2e/wallpaper.spec.ts:591` — motivo: AC-15 de FEAT-004 se mide solo en WebKit (`TIME_SKIP`).
