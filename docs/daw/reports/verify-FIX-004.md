# Verification FIX-004

Verificación de FIX-004 (base de datos aparte para los tests) sobre `b149b8a`. El contrato es el RCA
(`docs/daw/specs/rca-FIX-004.md`, AC-01 a AC-11) y el fix-plan (`docs/daw/specs/fix-FIX-004.md`).
El código no cambió desde la corrida del cierre de CODE, así que esa corrida
(`docs/daw/reports/tests-FIX-004.md`, con los E2E en los 4 proyectos) es la evidencia de los tests,
como pide `AGENTS.md`. La verificación cruzada la hizo un `daw-module-verifier` que no escribió el
código: volvió a correr unit (557/557), integración (81/81), lint, formato y tipos, y dio PASSED con
3 WARN. Los WARN de AC-02 y AC-05 se cerraron con la evidencia de abajo. El de AC-10 queda para la CI
del PR.

| Field | Value |
|---|---|
| Module | tests/test-database.ts, tests/integration/setup.ts, playwright.config.ts, scripts/db-test-prepare.sh, .github/workflows/ci.yml |
| Line coverage | 99.55% |
| Branch coverage | 97.25% |
| Function coverage | 99.45% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint --type-aware) — clean; `pnpm format:check` — OK; `pnpm typecheck` — 0 errores |

## Acceptance criteria
- ✅ AC-01 — `scripts/db-test-prepare.sh` + `pnpm db:test:prepare`: `mi_grilla_test` existe en el mismo servidor; `users` de `mi_grilla` 452 antes y después de las dos corridas.
- ✅ AC-02 — dos corridas seguidas de `pnpm db:test:prepare` en VERIFY: exit 0 y exit 0, las dos con "No pending migrations to apply." y `[seed] OK days=3 stages=5 shows=91`; `mi_grilla_test` con 3 migraciones terminadas y 91 shows; ningún log contiene `postgresql://`. `test-test-database-command-rejected` cubre que el comando devuelve el código de salida del hijo.
- ✅ AC-03 — `tests/integration/setup.ts` fija `DATABASE_URL` en la base de tests antes de crear clientes; `test-integration-runs-on-test-database`; `users` de `mi_grilla` 452 antes y después de la integración (cierre de CODE y corrida del verificador).
- ✅ AC-04 — `playwright.config.ts` pasa `DATABASE_URL: TEST_DATABASE_URL` a `webServer.env`; con la suite E2E completa, los `@example.com` de `mi_grilla` siguieron en 450 y los de `mi_grilla_test` pasaron de 0 a 233.
- ✅ AC-05 — `git diff main...HEAD -- src` vacío; `src/server/db.ts:44` lee `DATABASE_URL`, que en `.env` nombra `mi_grilla`; con `next dev`, `/api/health` respondió `{"status":"ok","database":"up"}` con la conexión de la app abierta en `mi_grilla`.
- ✅ AC-06 — `resolveTestDatabaseUrl` corre a nivel de módulo en el setup, antes de cualquier `DELETE`; `test-test-database-missing`.
- ✅ AC-07 — `targetOf` / `isSameTarget` en `tests/test-database.ts`; `test-test-database-same-as-development-rejected` y `test-test-database-query-override-rejected`.
- ✅ AC-08 — mensajes fijos sin URL; `test-test-database-message-without-url` y el stderr de `test-test-database-command-rejected`.
- ✅ AC-09 — `assertTruncatableDatabaseUrl` sobre `TEST_DATABASE_URL`; `test-test-database-remote-rejected`.
- ⚠️ AC-10 — cubierto sin correr la CI: `integration` y `e2e` definen `TEST_DATABASE_URL` sin `DATABASE_URL`, corren `pnpm db:test:prepare` antes de su suite y mantienen `timeout-minutes: 10` (`test-workflow-test-database`). Falta ver los tres jobs en verde en la CI del PR, en CLOSEOUT.
- ✅ AC-11 — `.env.example:9-12` y `AGENTS.md`, *Testing* (fila "How the suite is run" y el ítem "Dos bases en local"), nombran `TEST_DATABASE_URL` y `pnpm db:test:prepare`; el README también.

## Fix-plan steps
- ✅ Step 1 — `tests/test-database.ts`: `resolveTestDatabaseUrl`, cuatro errores tipados y modo comando con `spawnSync` sin shell.
- ✅ Step 2 — `tests/integration/setup.ts`: guarda `MI_GRILLA_DEVELOPMENT_DATABASE_URL` con `??=` y resuelve a nivel de módulo; el chequeo del `beforeEach` se mantiene.
- ✅ Step 3 — `scripts/db-test-prepare.sh` y `db:test:prepare` en `package.json`.
- ✅ Step 4 — `playwright.config.ts` carga `.env` sin pisar el entorno y resuelve la base de tests.
- ✅ Step 5 — `scripts/test-e2e-docker.sh` reenvía `-e TEST_DATABASE_URL`.
- ✅ Step 6 — `.github/workflows/ci.yml`: `TEST_DATABASE_URL` y `pnpm db:test:prepare` en `integration` y `e2e`.
- ✅ Step 7 — `tests/unit/ci/workflow.test.ts` adaptado, con dos tests nuevos.
- ✅ Step 8 — mensajes de `database-guard.ts` y `health.test.ts` apuntan a `TEST_DATABASE_URL`.
- ✅ Step 9 — `.env.example`, `AGENTS.md`, `README.md` y el encabezado de `docker-compose.yml`.
- ✅ Step 10 — `.env` local con `TEST_DATABASE_URL` (sin commitear) y `mi_grilla_test` preparada.

## Fix-plan tests
- ✅ Test 1 — `test-integration-runs-on-test-database`: regresión, rojo antes del fix en `tests/integration/test-database.test.ts:16` y verde después.
- ✅ Test 2 — `test-test-database-missing` (sad path: variable faltante).
- ✅ Test 3 — `test-test-database-same-as-development-rejected` (sad path: misma base rechazada).
- ✅ Test 4 — `test-test-database-query-override-rejected` (sad path: overrides de la query rechazados).
- ✅ Test 5 — `test-test-database-remote-rejected` (sad path: host remoto rechazado).
- ✅ Test 6 — `test-test-database-message-without-url`.
- ✅ Test 7 — `test-test-database-command-rejected` (sad path: el modo comando no ejecuta nada sin base válida).
- ✅ Test 8 — `test-workflow-test-database`.
- ✅ Test 9 — `test-e2e-docker-forwards-test-database`.
- ✅ Test 10 — los tests existentes de `workflow.test.ts` y `database-guard.test.ts`, adaptados, pasan.
- ✅ Test 11 — evidencia manual de AC-01 y AC-02: dos corridas de `pnpm db:test:prepare` con exit 0; `mi_grilla_test` migrada y con la grilla; `users` de `mi_grilla` 452 antes y después.
- ✅ Test 12 — evidencia manual de AC-03: `users` de `mi_grilla` 452 antes y después de `pnpm test:integration`.
- ✅ Test 13 — evidencia manual de AC-04: `@example.com` 450 → 450 en `mi_grilla` y 0 → 233 en `mi_grilla_test` con la suite E2E completa.
- ✅ Test 14 — evidencia manual de AC-05: `/api/health` con `next dev` sano y la conexión de la app en `mi_grilla`.
- ⚠️ Test 15 — evidencia de AC-10: los tres jobs de la CI en verde, a confirmar en la CI del PR (CLOSEOUT); cubierto sin correr la CI por Test 8.
- ✅ Test 16 — evidencia manual de AC-11: `.env.example` y *Testing* de `AGENTS.md` leídos.

## Tests
- ✅ Sad-path tests: Tests 2, 3, 4, 5 y 7 rechazan una base faltante, igual a la de desarrollo, con overrides en la query, remota o un comando sin base válida.

## Warnings
- ⚠️ El test de regresión compara el nombre de la base, no el host ni el puerto; la comparación completa la cubren los tests unitarios 3 y 4.
- ⚠️ Una `DATABASE_URL` que apunte al mismo servidor por un alias que no sea loopback (la IP de la LAN) no se reconoce como la misma base. AC-07 compara host, puerto y nombre tal como están escritos, así que se cumple.

Result: PASSED
