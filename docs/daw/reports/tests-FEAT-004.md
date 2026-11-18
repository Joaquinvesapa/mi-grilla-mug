# Test run FEAT-004

Corrida del re-cierre de CODE después del ciclo de corrección desde VERIFY (ronda 1): suite completa.
Incluye unit con cobertura, integración contra PostgreSQL real (`postgres:17.12` de
`docker-compose.yml`, migrada y sembrada) y E2E de los 4 proyectos de Playwright. Los E2E corren
dentro de la imagen oficial `mcr.microsoft.com/playwright:v1.65.1-noble` con la red del host,
porque a WebKit le faltan bibliotecas del sistema en este host. Corrida el 2026-11-18 sobre
`4b4cc2a`, con Node 24.22.2 (el `node` del PATH del host es v20 y Vitest no arranca con él).

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit en jsdom con coverage v8, e integración en node) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:integration && CI=1 bash e2e-root.sh "$PWD"` (equivalente a `CI=1 pnpm test:e2e:docker` sin `--user`, porque el Docker de este host es rootless) |
| Total | 722 |
| Passed | 719 |
| Failed | 0 |
| Skipped | 3 |
| Line coverage | 99.5% |
| Branch coverage | 97.64% |
| Function coverage | 99.23% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` (oxfmt) — OK; `pnpm typecheck` (`next typegen && tsc --noEmit`) — 0 errores |

Detalle:
- **Unit:** 420 tests en 47 archivos.
- **Integración:** 48 tests en 6 archivos.
- **E2E:** 254 ejecuciones en los 4 proyectos (`iphone-webkit`, `mobile-chromium`, `mobile-360` y
  `desktop`). Pasan 251 y se saltean 3.
- **Cobertura:** es la de la suite unitaria (statements 99,33 %).
- **Casos nuevos:**
  - `tests/e2e/wallpaper.spec.ts`: 8 casos por proyecto mobile.
  - Unit: `tests/unit/lib/wallpaper-layout.test.ts`, `wallpaper-messages.test.ts`,
    `tests/unit/components/wallpaper-canvas.test.ts`, `wallpaper-delivery.test.ts` y
    `wallpaper-button.test.tsx`.
- **Tiempo:** en `iphone-webkit`, del toque a la vista previa (referencia de AC-15) se midió 113 ms
  en la corrida del Block 4.

## Failures
(none)

## Skips
- `grid.spec.ts` beforeunload en `iphone-webkit` — motivo: iOS no respeta `beforeunload` (`BEFOREUNLOAD_SKIP`, desde FEAT-003a)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-chromium` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
- `wallpaper.spec.ts` `test-e2e-wallpaper-time` en `mobile-360` — motivo: AC-15 se mide solo en WebKit (`TIME_SKIP`)
