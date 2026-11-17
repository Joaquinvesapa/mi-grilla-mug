# Test run FEAT-001

Corrida del Block 2 (Inicio y shell nativo): suite unitaria con cobertura y E2E de los 4 proyectos
de Playwright. Se reemplaza en cada bloque y en el cierre de CODE por la corrida de la suite
completa.

| Field | Value |
|---|---|
| Runner | vitest 5.1.0 (unit, coverage v8) + @playwright/test 1.65.1 (E2E, imagen mcr.microsoft.com/playwright:v1.65.1-noble) |
| Command | `pnpm test && pnpm test:e2e:docker` |
| Total | 50 |
| Passed | 50 |
| Failed | 0 |
| Skipped | 0 |
| Line coverage | 100% |
| Branch coverage | 100% |
| Function coverage | 100% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings |

Detalle: 12 tests unitarios (`tests/unit/lib/utils.test.ts`, `tests/unit/components/pressable.test.ts`,
`tests/unit/components/install-guide.test.tsx`) + 38 ejecuciones E2E (`iphone-webkit` 12,
`mobile-chromium` 14, `mobile-360` 12; `desktop` sin tests hasta el Block 5). La cobertura es la de
la suite unitaria.

## Failures
(none)

## Skips
(none)
