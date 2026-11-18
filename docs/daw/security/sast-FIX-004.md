# SAST FIX-004

| Field | Value |
|-------|-------|
| Ticket | FIX-004 |
| Tools | revisión manual del diff (12 archivos modificados y 4 nuevos sobre `8de19e6`), `rg` de patrones (URLs con credenciales, `spawn`/`exec`, `console`/`stderr`), `oxlint --type-aware`, `pnpm audit --prod` |
| Date | 2026-11-18 |

Alcance: `tests/test-database.ts`, `scripts/db-test-prepare.sh`, `tests/integration/setup.ts`,
`tests/integration/database-guard.ts`, `tests/integration/health.test.ts`,
`tests/integration/test-database.test.ts`, `tests/unit/test-database.test.ts`,
`tests/unit/ci/workflow.test.ts`, `playwright.config.ts`, `scripts/test-e2e-docker.sh`,
`.github/workflows/ci.yml`, `package.json`, `.env.example`, `docker-compose.yml`, `README.md` y
`AGENTS.md`. Nada de `src/` cambia: la app no tiene superficie nueva.

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos reales: `.env` sigue en `.gitignore` (`git check-ignore .env`); `.env.example` usa `USER:PASSWORD`; `.github/workflows/ci.yml:77` y `:126` son la credencial descartable `ci-only-password` del service efímero, ya presente antes de este ticket; `tests/unit/test-database.test.ts:15-16` usa credenciales ficticias de fixture |
| F-SAST-02 | ✅ | sin SQL nuevo; los `DELETE` de `tests/integration/setup.ts` son constantes con `$executeRaw` y plantilla, sin interpolación |
| F-SAST-03 | ✅ | `tests/test-database.ts:156` usa `spawnSync` sin `shell` y con los argumentos como array; el comando y sus argumentos vienen solo de `scripts/db-test-prepare.sh`, escrito en el repo, sin input externo |
| F-SAST-04 | ✅ | sin `eval`, `Function` ni deserialización insegura |
| F-SAST-05 | ✅ | sin rutas armadas con input; `process.loadEnvFile(".env")` y `--env-file-if-exists=.env` usan una ruta fija |
| F-SAST-06 | ✅ | no aplica: sin HTML ni UI nuevos |
| F-SAST-07 | ✅ | sin pedidos salientes; la única conexión es a la base que valida `resolveTestDatabaseUrl`, limitada a hosts locales o `postgres` (`tests/integration/database-guard.ts`) |
| F-SAST-08 | ✅ | sin criptografía nueva |
| F-SAST-09 | ✅ | sin cambios en la config de producción ni en `next.config` |
| F-SAST-10 | ✅ | ninguna URL de base se imprime: los mensajes de `tests/test-database.ts` nombran solo la variable (test `test-test-database-message-without-url`), el modo comando escribe en stderr solo el mensaje o el nombre del comando (`:142`, `:151`, `:162`), y `scripts/test-e2e-docker.sh:52` reenvía `-e TEST_DATABASE_URL` por nombre; ningún log de la corrida contiene `postgresql://` |
| F-SAST-11 | ✅ | no aplica: sin upload |
| F-SAST-12 | ✅ | no aplica: sin formularios ni endpoints nuevos |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found |
| F-SAST-14 | ✅ | `TEST_DATABASE_URL` se valida antes de usarla: no vacía, URL parseable y decodificable, sin `host`/`hostaddr`/`port`/`dbname`/`database` en la query, host local o `postgres` y distinta de `DATABASE_URL` (`tests/test-database.ts`, `resolveTestDatabaseUrl`) |
| F-SAST-15 | ✅ | los errores son clases tipadas con mensajes fijos; un error ajeno en el modo comando se re-lanza (`tests/test-database.ts:154`) y queda en la terminal de quien lo corre, no llega a un cliente |
| F-SAST-16 | ✅ | sin dependencias nuevas; `package.json` solo suma el script `db:test:prepare` |
| F-SAST-17 | ✅ | sin rutas de código dinámico |

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
