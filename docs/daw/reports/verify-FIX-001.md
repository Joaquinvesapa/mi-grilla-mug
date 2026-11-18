# Verification FIX-001

Ronda 1, 2026-11-18, sobre `8dbc4a5`. Verificación cruzada de `daw-module-verifier`, un agente que
no escribió el código. Aplicando la regla nueva de este mismo ticket, los E2E no se volvieron a
correr: `git diff --stat 8dbc4a5 -- src tests playwright.config.ts .github` sale vacío y no hubo
commits después de la corrida del cierre de CODE, así que esa corrida
(`docs/daw/reports/tests-FIX-001.md`: 254 ejecuciones E2E en los 4 proyectos, 251 pasan y 3 se
saltean con motivo) es la evidencia de los E2E. El verificador volvió a correr
`tests/unit/ci/workflow.test.ts` (20/20), `pnpm lint`, `pnpm format:check` y `pnpm typecheck`
(los tres limpios), y reprodujo el rojo de TDD sobre una copia de `5dbdebe`.

| Field | Value |
|---|---|
| Module | `.github/workflows/ci.yml` (job `e2e`), `tests/unit/ci/workflow.test.ts`, `AGENTS.md`, `README.md` |
| Line coverage | 99.5% |
| Branch coverage | 97.64% |
| Function coverage | 99.23% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean; `pnpm format:check` — OK; `pnpm typecheck` — 0 errores |

## Acceptance criteria
- ✅ AC-01 — `.github/workflows/ci.yml:147-149` + `test-workflow-e2e-projects-by-event` (expresión exacta de `E2E_PROJECTS`)
- ✅ AC-02 — en un push a `main` la expresión da `''` y `pnpm test:e2e` corre los 4 proyectos; el mismo test exige los 4 nombres en `playwright.config.ts`
- ✅ AC-03 — el step sale con error si un test falla; sin `if:` ni `continue-on-error` en el job ni en el step (tests existentes de `workflow.test.ts`)
- ✅ AC-04 — `AGENTS.md:67-68`: en un bloque de CODE, unit, integración y solo el E2E del bloque, en un proyecto
- ✅ AC-05 — `AGENTS.md:69`: en el cierre de CODE, la suite E2E completa en los 4 proyectos
- ✅ AC-06 — `AGENTS.md:69-70`: en VERIFY, la corrida del cierre de CODE es la evidencia si el código no cambió (aplicada en esta misma ronda)
- ✅ AC-07 — `AGENTS.md:70-71`: si el código cambió, se corre de nuevo la suite completa
- ✅ AC-08 (PRD FEAT-001) — el mismo workflow y test que AC-01
- ✅ AC-09 (PRD FEAT-001) — el mismo workflow y test que AC-02

## Fix-plan steps
- ✅ Step 1 — `tests/unit/ci/workflow.test.ts`: `E2E_COMMAND` y `E2E_PROJECTS_EXPR`, las tres búsquedas sobre el workflow real pasan a `E2E_COMMAND`, el helper `e2eProjectsProblem` y el test nuevo; escrito primero y visto en rojo
- ✅ Step 2 — `.github/workflows/ci.yml:144-149`: `run` y `env` en el mismo step, sin `if:` y sin `${{ }}` dentro de `run:`
- ✅ Step 3 — `AGENTS.md`: encabezado (`:3-5`), fila "How the suite is run" (`:58`) y bullet nuevo (`:67-71`) después de las filas de cobertura
- ✅ Step 4 — `README.md:89-91`: descripción del job `e2e` por evento

## Fix-plan tests
- ✅ Test 1 — regresión `test-workflow-e2e-projects-by-event`: rojo con el `ci.yml` de `5dbdebe` en la aserción sobre el workflow real (`falta el step \`pnpm test:e2e $E2E_PROJECTS\``), verde después del cambio
- ✅ Test 2 — sad path: `E2E_PROJECTS` faltante o con otra expresión es rechazado
- ✅ Test 3 — sad path: un fixture con `--project=iphone-safari` es rechazado (por la rama "otra expresión"; la rama "proyecto inválido" se cubre con una lista de proyectos recortada)
- ✅ Test 4 — los tests existentes de `workflow.test.ts` pasan con el workflow nuevo (20/20)
- ✅ Test 5 — lint, formato, tipos y `pnpm test` (421 unit) limpios

## Tests
- ✅ Sad-path tests: `test-workflow-e2e-projects-by-event` rechaza el step faltante, `E2E_PROJECTS` faltante, otra expresión y un proyecto inválido

## Reglas
- ✅ F-VER-01 — todos los AC del RCA y AC-08/AC-09 del PRD FEAT-001 con evidencia
- ✅ F-VER-02 — Step 1 a Step 4 hechos
- ✅ F-VER-03 — 99.5 % / 97.64 % / 99.23 % contra 80 / 70 / 80
- ✅ F-VER-04 — sad paths del helper probados
- ✅ F-VER-05 — lint, formato y tipos limpios
- ✅ F-VER-06 — Test 1 a Test 5 existen y pasan
- ⚠️ W-VER-01 — `[...projects]` copia el array sin necesidad (`workflow.test.ts:482-484`)
- ✅ W-VER-02 — no aplica: el diff no toca lógica de negocio
- ⚠️ W-VER-03 — `playwrightProjectNames` lee `playwright.config.ts` con una regex (`workflow.test.ts:155-158`); si se rompe, falla de forma visible por el `toEqual` de los 4 nombres

## Hallazgos de la verificación cruzada (no bloquean)
1. `tests/unit/ci/workflow.test.ts` se reformateó con `oxfmt` después de la corrida de `pnpm test` del reporte. El cambio fue solo de formato; el verificador corrió la versión commiteada (20/20) y no entra en los E2E ni en la cobertura de `src/`.
2. W-VER-03 de arriba.
3. Test 3: el mensaje para `iphone-safari` dice "otra expresión" y no nombra el proyecto inválido, como pedía el "Error handling" del fix-plan. El rechazo funciona; difiere el texto.
4. W-VER-01 de arriba.
5. La regla de `AGENTS.md` no define qué es "el código" para reusar la corrida en VERIFY (`package.json`, `next.config.*`, `prisma/`, `data/`). Queda para un ticket aparte.
6. AC-01 y AC-02 se prueban sobre el texto de la expresión; la confirmación real es el log del job `e2e` del PR (solo `iphone-webkit`, 82) y de `main` después del merge (los 4 proyectos, 254). Se revisa en CLOSEOUT.
7. AC-04 a AC-07 no tienen test automático: la evidencia es el texto de `AGENTS.md`.

Result: PASSED
