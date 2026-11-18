# Verification FIX-002

Ronda 1, 2026-11-18, sobre `a6945f9`. La verificación cruzada la hizo `daw-module-verifier`, un
agente que no escribió el código. Los E2E no se volvieron a correr, según la regla de FIX-001: el
único commit después de la corrida del cierre de CODE es `a6945f9`, el árbol está limpio y el diff es
solo `ci.yml`, el test, `AGENTS.md`, `README.md` y los reportes. Esa corrida
(`docs/daw/reports/tests-FIX-002.md`: 254 ejecuciones E2E en los 4 proyectos, dentro de
`mcr.microsoft.com/playwright:v1.65.1-noble`, 251 pasan y 3 se saltean con motivo) es la evidencia de
los E2E. El verificador volvió a correr `tests/unit/ci/workflow.test.ts` (21/21), `pnpm test` (422),
`pnpm lint`, `pnpm format:check` y `pnpm typecheck` (los tres limpios), y reprodujo el rojo de TDD
con el `ci.yml` de `387ae32`.

| Field | Value |
|---|---|
| Module | `.github/workflows/ci.yml` (job `e2e`), `tests/unit/ci/workflow.test.ts`, `scripts/test-e2e-docker.sh`, `AGENTS.md`, `README.md` |
| Line coverage | 99.5% |
| Branch coverage | 97.64% |
| Function coverage | 99.23% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean; `pnpm format:check` — OK; `pnpm typecheck` — 0 errores |

## Acceptance criteria
- ✅ AC-01 — `.github/workflows/ci.yml:104-105`, con la imagen `v1.65.1-noble` igual a `package.json:48` + `test-workflow-e2e-container`
- ✅ AC-02 — `playwrightVersion()`/`playwrightImage()`; `test-workflow-e2e-container` rechaza `v1.64.0-noble` y el container faltante (probado contra `387ae32`)
- ✅ AC-03 — los steps de versión, cache de `ms-playwright` y `playwright install --with-deps` ya no están en `ci.yml`; el helper los rechaza con fixtures
- ✅ AC-04 — `ci.yml:123` apunta al host `postgres`; `src/lib/database-url.ts:14` lo acepta; el helper rechaza `127.0.0.1` y el service faltante
- ✅ AC-05 — timeout de 10 (`ci.yml:98`), auth (`:125-127`), migrate y seed (`:139,141`), `E2E_PROJECTS` (`:145-147`), subida del reporte con `if: failure()` (`:148-153`); los cubren `test-workflow-auth-env`, `test-workflow-seed-step`, `test-workflow-e2e-projects-by-event` y el test de timeouts
- ✅ AC-06 — evidencia local: la suite E2E completa corrió verde dentro de la misma imagen. La confirmación real (el job `e2e` del PR en verde al primer intento) se revisa en CLOSEOUT, con la CI del PR
- ✅ AC-07 — `AGENTS.md:58` describe el job dentro de la imagen, sin instalar navegadores ni bibliotecas, con el host `postgres`

## Fix-plan steps
- ✅ Step 1 — `tests/unit/ci/workflow.test.ts`: `container` en el type `Job` (`:37`), helpers (`:180-224`), `PLAYWRIGHT_CACHE_KEY` borrada, tests nuevos en `:406` y `:459`; escrito primero y visto en rojo
- ✅ Step 2 — `ci.yml:99-105` (container con su comentario), `:122-123` (`DATABASE_URL`), 3 steps borrados; el service, `BETTER_AUTH_URL`, `E2E_PROJECTS` y el timeout sin cambios
- ✅ Step 3 — `scripts/test-e2e-docker.sh:27` sin cambios y protegido por `test-e2e-docker-image`
- ✅ Step 4 — `AGENTS.md:58`
- ✅ Step 5 — `README.md:90`

## Fix-plan tests
- ✅ Test 1 — regresión `test-workflow-e2e-container`: en rojo con el `ci.yml` de `387ae32` (`imagen del container inválida: undefined, se esperaba mcr.microsoft.com/playwright:v1.65.1-noble`), en verde con `a6945f9`
- ✅ Test 2 — sad path: imagen `v1.64.0-noble` (versión inválida) y container faltante rechazados
- ✅ Test 3 — sad path: step de `playwright install` y cache de `ms-playwright` rechazados
- ✅ Test 4 — sad path: `DATABASE_URL` a `127.0.0.1` (host inválido) y service `postgres` faltante rechazados
- ✅ Test 5 — `test-e2e-docker-image` pasa con el script de hoy y rechaza un `IMAGE` en 1.64.0
- ✅ Test 6 — los tests que ya existían en `workflow.test.ts` pasan (21/21)
- ✅ Test 7 — lint, format:check, typecheck y `pnpm test` (422) limpios
- ✅ Test 8 — evidencia local: los 4 proyectos verdes dentro de la imagen. El primer intento del job `e2e` en el PR y el tiempo de `Initialize containers` se registran en CLOSEOUT

## Tests
- ✅ Sad-path tests: `test-workflow-e2e-container` rechaza versión inválida, container faltante, `playwright install`, cache de `ms-playwright`, host inválido y service faltante; `test-e2e-docker-image` rechaza una imagen de otra versión

## Reglas
- ✅ F-VER-01 — FIX sin PRD propio (`prd-FEAT-001` sin cambios); AC-01..07 del RCA con evidencia, AC-06 a confirmar en la CI del PR
- ✅ F-VER-02 — Step 1 a Step 5 hechos
- ✅ F-VER-03 — 99.5 % / 97.64 % / 99.23 % contra 80 / 70 / 80
- ✅ F-VER-04 — sad paths del helper y del script probados
- ✅ F-VER-05 — lint, formato y tipos limpios
- ✅ F-VER-06 — Test 1 a Test 8 existen; del 1 al 7 pasan en local, y el 8 tiene evidencia local y se confirma en CLOSEOUT
- ✅ W-VER-01 — sin código muerto (`PLAYWRIGHT_CACHE_KEY` borrada)
- ✅ W-VER-02 — no aplica: el diff no toca lógica de negocio
- ✅ W-VER-03 — los tests leen el `package.json` y el script reales; `1.64.0` solo se usa como versión inválida

## Hallazgos de la verificación cruzada (no bloquean)
1. AC-06 y Test 8 se confirman en CLOSEOUT con la CI del PR. El tiempo de `Initialize containers` va en el PR y en el CHANGELOG, porque el PR se abre después de VERIFY.
2. La corrida local no reproduce la CI tal cual: en local fue con `--network host`, `--ipc=host`, `--init`, el Node de la imagen (v26) y migrate y seed en el host. En la CI va a ser red bridge hacia el alias `postgres`, `/dev/shm` de 64 MB, sin `--init`, Node 24 de `setup-node`, y migrate y seed dentro del container. Si el PR falla por memoria compartida o procesos zombie, el arreglo directo es `container.options: --ipc=host --init` (vuelta a CODE).
3. Dentro del container, `HOME=/github/home`: el store de pnpm queda en otra ruta y `e2e` no comparte la cache de pnpm con `quality` e `integration`. Su primera corrida baja todo del registry. Cuesta tiempo, no hace fallar el job.
4. La imagen ocupa 3,68 GB sin comprimir en local. Cuánto tarda el pull en la CI se mide en el PR (hallazgo 1).
5. El helper es más estricto con lo que pide AC-03 que con todo NFR-01: un step `apt-get install` o `npx playwright@x install` no lo rechaza.
6. Que el código no cambió desde la corrida del cierre de CODE se deduce (un commit, árbol limpio, diff igual al descripto); no se comparó byte a byte.
7. `README.md:90` mide 170 caracteres y rompe el corte a ~100 del párrafo. Es cosmético.

## Verificado en la imagen (sin hallazgo)
- La imagen trae git 2.43, así que `actions/checkout` clona y configura `safe.directory`. Corriendo como root no hay problemas de permisos sobre `/__w`.
- `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` viene en el `ENV` de la imagen.
- `next start` en `127.0.0.1:3100` corre en el mismo container que los navegadores, y `playwright.config.ts:53` pisa `HOSTNAME`.
- OpenSSL 3.0.13 está presente para Prisma.
- `playwright-report` es una ruta relativa al workspace.

Result: PASSED
