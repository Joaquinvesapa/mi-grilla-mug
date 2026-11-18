# Fix-plan FIX-001: Correr los E2E solo al cierre de CODE, en VERIFY y completos solo en main

| Field | Value |
|-------|-------|
| Ticket | FIX-001 |
| Tier | FIX |
| RCA | docs/daw/specs/rca-FIX-001.md |
| PRD relacionado | docs/daw/prd/prd-FEAT-001.md (FR-06, AC-08, AC-09) |
| Date | 2026-11-18 |
| Spec loops | 1 |
| Loops since last human decision | 1 |

## Problem
El job `e2e` de la CI corre las 254 ejecuciones E2E (82 casos × 4 proyectos de Playwright) en cada
push a un PR y de nuevo al mergear a `main`: unos 4 minutos de `pnpm test:e2e` y unos 5 min 15 s de
job, sobre un tope de 10. Dentro de un ticket de DAW la suite completa se corre además en cada
bloque de CODE, en su cierre y en VERIFY.

## Root cause
1. `.github/workflows/ci.yml:145` corre `pnpm test:e2e` sin distinguir el evento, así que un PR paga
   los 4 proyectos aunque `main` los vuelve a correr.
2. `AGENTS.md` (sección Testing, fila "How the suite is run") lista `pnpm test:e2e` sin decir en qué
   momento del pipeline de DAW se corre, y las reglas de DAW tampoco lo fijan: cada bloque, el
   cierre y VERIFY corren la suite completa (RCA, "Causa raíz").

## Coverage: RCA → steps
| Requirement | Covered by |
|---|---|
| FR-01 | Pasos 1 y 2 |
| FR-02 | Pasos 1 y 2 |
| FR-03 | Paso 3 |
| FR-04 | Paso 3 |
| FR-05 | Paso 3 |
| FR-01, FR-02 (documentación) | Paso 4 |
| NFR-01 | Paso 2: en un PR corre solo `iphone-webkit` (82 casos) |
| NFR-02 | Paso 2: `timeout-minutes: 10` del job no cambia; el test de timeouts existente lo sigue exigiendo |

## Solution — steps
1. `tests/unit/ci/workflow.test.ts` (primero, en rojo):
   - Una constante `E2E_COMMAND = "pnpm test:e2e $E2E_PROJECTS"` y una `E2E_PROJECTS_EXPR =
     "${{ github.event_name == 'pull_request' && '--project=iphone-webkit' || '' }}"`.
   - Las búsquedas sobre el workflow real que hoy esperan `"pnpm test:e2e"` (el `arrayContaining`
     del test de e2e, el `indexOf` del orden migrate → suite de `test-workflow-auth-env` y la clave
     `e2e` de `SUITES` en `test-workflow-seed-step`) pasan a esperar `E2E_COMMAND`. Los fixtures
     sintéticos de `test-workflow-seed-step` no cambian.
   - Un helper `e2eProjectsProblem(workflow, projectNames)` que devuelve el motivo del rechazo, o
     `null`: el step de `E2E_COMMAND` del job `e2e` tiene que existir y tener
     `env.E2E_PROJECTS === E2E_PROJECTS_EXPR`, y cada `--project=<name>` de la expresión tiene que
     ser un proyecto de `playwright.config.ts` (se leen los `name:` del archivo).
   - El test nuevo `test-workflow-e2e-projects-by-event` que usa ese helper sobre el workflow real
     (`null`) y sobre fixtures rotos (rechazados).
2. `.github/workflows/ci.yml`, job `e2e`: el step `run: pnpm test:e2e` pasa a ser
   `run: pnpm test:e2e $E2E_PROJECTS`, con `env: E2E_PROJECTS:` y la expresión de arriba en el mismo
   step. Sin `if:` (el test de AC-11 lo prohíbe salvo en el step que sube el reporte) y sin interpolar
   `${{ … }}` dentro de `run:` (R-03 de `threat-FIX-001.md`). Se actualiza el comentario del step
   ("los 4 proyectos" → "en un PR solo `iphone-webkit`; en `main` los 4 proyectos").
3. `AGENTS.md`, sección Testing:
   - En la fila "How the suite is run", la descripción del job `e2e` dice que en un PR corre solo
     `iphone-webkit` y en el push a `main` los 4 proyectos.
   - Un bullet nuevo, debajo de la fila, con cuándo se corren los E2E en DAW: en un bloque de CODE,
     unit, integración y solo el E2E que el bloque crea o cambia, en un proyecto
     (`pnpm test:e2e <archivo> --project=iphone-webkit`); en el cierre de CODE, la suite E2E completa
     en los 4 proyectos; en VERIFY, si el código no cambió desde la corrida del cierre de CODE, se
     usa esa corrida como evidencia, y si cambió, se corre de nuevo la suite completa. El bullet
     va después de las filas de cobertura: `.daw/scripts/validate_verify.py` toma el primer `N %`
     de la sección Testing como piso.
   - El encabezado del archivo (línea 3) dice que "cuándo testear" lo define DAW y no se repite
     acá; se ajusta para decir que la sección Testing fija cuándo se corren los E2E, como regla
     del proyecto que complementa a DAW.
   - Límite conocido (impact scan): los archivos de DAW (`.claude/agents/daw-module-verifier.md`,
     `.claude/skills/daw-verify-module/SKILL.md`, `.claude/skills/daw-test/SKILL.md`) no se editan
     en este ticket. La regla se aplica porque los agentes leen `AGENTS.md`; al lanzar el
     implementer y el verifier, el orquestador les pasa la regla en el prompt.
4. `README.md`, sección "CI": la descripción del job `e2e` dice que en un PR corre Playwright solo
   con WebKit (`iphone-webkit`) y al mergear a `main` con WebKit y Chromium en los 4 proyectos.

## Dependencies between steps
El paso 1 va antes del paso 2 (el test tiene que verse fallar contra el `ci.yml` de hoy). Los pasos 3
y 4 son independientes de los otros dos.

## Error handling
- Falta `E2E_PROJECTS` en el step de `pnpm test:e2e`, o tiene otra expresión — el helper lo
  rechaza nombrando el valor encontrado y el test falla; la CI (`quality`) marca el PR como fallido.
- La expresión nombra un proyecto que no existe en `playwright.config.ts` — el helper lo rechaza
  nombrando el proyecto inválido; Playwright también fallaría con "Project(s) not found", pero
  recién en el job `e2e`.

## Tests
- [ ] **Regression test** — `test-workflow-e2e-projects-by-event`: con el `ci.yml` de hoy falla
      (el step corre `pnpm test:e2e` sin `E2E_PROJECTS`); después del paso 2 pasa.
- [ ] `test-workflow-e2e-projects-by-event` rechaza un fixture con `E2E_PROJECTS` faltante o con
      otra expresión (sad path, error 1).
- [ ] `test-workflow-e2e-projects-by-event` rechaza un fixture cuya expresión nombra un proyecto
      inválido, `--project=iphone-safari` (sad path, error 2).
- [ ] Los tests existentes de `tests/unit/ci/workflow.test.ts` (sin `if`, sin `${{ github.event.* }}`
      en `run:`, timeouts, cada `pnpm <script>` existe en `package.json`) siguen pasando con el
      workflow nuevo.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` pasan.

## Regression risk
Low — el cambio en la CI solo agrega argumentos a `pnpm test:e2e` según el evento; el push a `main`
corre exactamente lo mismo que hoy. El riesgo es que un fallo solo de Chromium o de 360 px se vea
recién en `main` (R-02 de `threat-FIX-001.md`), mitigado porque el cierre de CODE corre los 4
proyectos antes de abrir el PR.

## Rollback plan *(mandatory)*
- Steps: trivial: revert the commit (vuelve el `run: pnpm test:e2e` sin argumentos, el test y la
  regla de `AGENTS.md`).
- Indicators: un PR en verde rompe `main` en `mobile-chromium`, `mobile-360` o `desktop` más de una
  vez, o el job `e2e` del PR falla con "Project(s) not found".
