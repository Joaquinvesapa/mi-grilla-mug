# Test run FIX-001

Corrida del cierre de CODE de FIX-001: suite completa. Incluye unit con cobertura, integración
contra PostgreSQL real (`postgres:17.12` de `docker-compose.yml`, migrada y sembrada) y E2E de los
4 proyectos de Playwright, como pide la regla nueva de `AGENTS.md` para el cierre de CODE.

Los proyectos de Chromium (`mobile-chromium`, `mobile-360` y `desktop`) corren en el host.
`iphone-webkit` corre dentro de la imagen oficial `mcr.microsoft.com/playwright:v1.65.1-noble`, con
la red del host y sin `--user`, porque a WebKit le faltan bibliotecas del sistema en este host y el
Docker es rootless (Cortex #8514). Corrida el 2026-11-18 sobre `5dbdebe` más los cambios de
FIX-001 sin commitear.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E) |
| Command | `pnpm test && pnpm test:integration && pnpm test:e2e --project=mobile-chromium --project=mobile-360 --project=desktop` + `pnpm test:e2e --project=iphone-webkit` dentro de `mcr.microsoft.com/playwright:v1.65.1-noble` (el `docker run` de `scripts/test-e2e-docker.sh` sin `--user`) |
| Total | 723 |
| Passed | 720 |
| Failed | 0 |
| Skipped | 3 |
| Line coverage | 99.5% |
| Branch coverage | 97.64% |
| Function coverage | 99.23% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 421 tests en 47 archivos (uno más que en FEAT-004: `test-workflow-e2e-projects-by-event`).
- **Integración:** 48 tests en 6 archivos.
- **E2E:** 254 ejecuciones. Chromium: 172 (170 pasan, 2 salteados). `iphone-webkit`: 82 (81 pasan,
  1 salteado).
- **Cobertura:** es la de la suite unitaria (statements 99,33 %).
- **Evidencia TDD:** con el test escrito y `ci.yml` sin cambios, `tests/unit/ci/workflow.test.ts`
  dio 4 failed | 16 passed (20); `test-workflow-e2e-projects-by-event` falló en la aserción sobre
  el workflow real (`falta el step \`pnpm test:e2e $E2E_PROJECTS\``). Después del cambio, 20/20.

## Failures
(none)

## Skips
- `grid.spec.ts` beforeunload en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
