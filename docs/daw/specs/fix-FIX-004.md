# Fix-plan FIX-004: Base de datos aparte para los tests

| Field | Value |
|-------|-------|
| Ticket | FIX-004 |
| Tier | FIX |
| RCA | docs/daw/specs/rca-FIX-004.md |
| Date | 2026-11-18 |
| Spec loops | 0 |
| Loops since last human decision | 0 |

## Problem

En local, `pnpm dev`, los tests de integración y los E2E usan la misma base (`mi_grilla`, el
`DATABASE_URL` de `.env`). Antes de cada test, `tests/integration/setup.ts` borra `groups`, `users` y
`login_throttles` sobre esa base, y los E2E la llenan de cuentas `e2e-…@example.com`. Cuando el
usuario levanta la app, ya no están las cuentas, los grupos ni las selecciones que había cargado a
mano (RCA, memoria #8524).

## Root cause

No existe una base para los tests: todo lee `DATABASE_URL`. El guard
(`tests/integration/database-guard.ts`) solo mira si el host es local, y la base de desarrollo es
local. Detalle en `docs/daw/specs/rca-FIX-004.md`, "Causa raíz".

## Solution — steps

Diseño: una variable nueva, `TEST_DATABASE_URL`, apunta a una segunda base (`mi_grilla_test` en el
ejemplo) en el mismo servidor PostgreSQL de `docker-compose.yml`. Una sola función decide si esa URL
se puede usar, y la usan los tres caminos que tocan la base de tests: el setup de integración, la
config de Playwright y el comando que la prepara. Se verificó que `prisma migrate deploy` crea la base
si no existe (se probó sobre el servidor local con una base descartable, que se borró después), así
que no hace falta ningún script de inicialización en el compose, que solo corre con el volumen vacío.

1. `tests/test-database.ts` (nuevo) — la función que valida la base de tests, sin I/O:
   - `resolveTestDatabaseUrl(env: { TEST_DATABASE_URL?: string; DATABASE_URL?: string }): string`
     devuelve `env.TEST_DATABASE_URL` si se puede usar y, si no, lanza uno de los errores de
     "Error handling".
   - Orden de los chequeos: (a) falta o está vacía → `MissingTestDatabaseError`; (b) la URL no se puede
     parsear, o trae `host`, `hostaddr`, `port`, `dbname` o `database` como parámetros de query (`pg`
     los usa y pisan el host, el puerto o la base de la URL; hallazgo 3 del impact scan) →
     `UnsupportedTestDatabaseUrlError`; (c) `assertTruncatableDatabaseUrl` de
     `tests/integration/database-guard.ts` (host local o `postgres` de la CI) →
     `UntruncatableDatabaseError`, como hoy; (d) si `env.DATABASE_URL` está definida y apunta a la
     misma base → `SameAsDevelopmentDatabaseError`.
   - "La misma base" compara lo que `pg` usa para conectarse: host (`localhost`, `127.0.0.1`, `::1` y
     `[::1]` cuentan como el mismo loopback), puerto (5432 por defecto) y nombre de base (el
     pathname sin la `/`). Del lado de `DATABASE_URL`, si trae `host`, `hostaddr`, `port`, `dbname`
     o `database` en la query, se toma ese valor. Si `DATABASE_URL` no se puede parsear, no se puede
     afirmar que sean distintas → `SameAsDevelopmentDatabaseError`.
   - Los cuatro errores son clases con `name` propio, y su mensaje, en español, nombra la variable
     que hay que revisar (`TEST_DATABASE_URL` o `DATABASE_URL`) y nunca incluye una URL ni sus
     credenciales.
   - Importa con extensión `.ts` (`./integration/database-guard.ts`), como `prisma/seed.ts`, para
     que la pueda ejecutar `node` sin transpilar (paso 3).
   - Modo comando: con `import.meta.main`,
     `node tests/test-database.ts <comando> [args…]` resuelve la URL con `process.env` y ejecuta
     `<comando>` con `spawnSync` (`stdio: "inherit"`, sin shell) y `DATABASE_URL` igual a la base de
     tests. Sale con el código de salida del comando. Si la URL no se puede usar, imprime solo el
     mensaje del error en stderr y sale con 1 sin ejecutar nada. La URL nunca se imprime.
2. `tests/integration/setup.ts:1-21` — antes de crear cualquier cliente:
   - la primera vez que corre en el proceso, guarda el `DATABASE_URL` que vino de `.env` o del
     entorno en `process.env.MI_GRILLA_DEVELOPMENT_DATABASE_URL`, y desde entonces compara contra
     ese valor (`??=`). Así la función no depende del valor que el propio setup escribe, aunque
     después se active `isolate: false` (impact scan, "a tener en cuenta");
   - `process.env.DATABASE_URL = resolveTestDatabaseUrl({ TEST_DATABASE_URL, DATABASE_URL: <el guardado> })`,
     en el nivel del módulo. Un error ahí corta la suite antes de cualquier `DELETE` (AC-06, AC-07).
     Todos los tests de integración (`health`, `seed`, `groups` con `pg.Client`, `getDb()`) siguen
     leyendo `DATABASE_URL` sin cambios y reciben la base de tests;
   - en el `beforeEach`, `assertTruncatableDatabaseUrl(url)` se mantiene, porque el test de salud
     cambia `DATABASE_URL` por test con `vi.stubEnv`;
   - se actualizan los comentarios de las líneas 1-2 y 20-21 (hallazgo 7).
3. `scripts/db-test-prepare.sh` (nuevo) y `package.json` (`"db:test:prepare": "bash scripts/db-test-prepare.sh"`):
   - `set -euo pipefail`; corre desde la raíz del repo;
   - `node --env-file-if-exists=.env tests/test-database.ts pnpm exec prisma migrate deploy` (crea la
     base si no existe y aplica las migraciones);
   - `node --env-file-if-exists=.env tests/test-database.ts node prisma/seed.ts` (carga la grilla;
     `process.loadEnvFile` del seed no pisa el `DATABASE_URL` que recibe);
   - `--env-file-if-exists` no pisa variables que ya están en el entorno, así que en la CI manda la
     variable del job. Correrlo dos veces no cambia nada: las migraciones ya aplicadas se saltean y
     el seed es idempotente (FEAT-003a).
4. `playwright.config.ts` — al principio del archivo, si existe `.env`, `process.loadEnvFile(".env")`
   (no pisa el entorno). Después, `const TEST_DATABASE_URL = resolveTestDatabaseUrl(process.env)`, y
   `webServer.env` suma `DATABASE_URL: TEST_DATABASE_URL`. Si la base de tests no se puede usar,
   `playwright test` no arranca (hallazgo 4). `next start` no pisa el `DATABASE_URL` que recibe en el
   entorno con el de `.env`. No se agregan líneas `name:` (el test del workflow las lee).
5. `scripts/test-e2e-docker.sh:14-24,51` — reenvía `-e TEST_DATABASE_URL` en lugar de
   `-e DATABASE_URL`, y los comentarios dicen que antes hay que correr `pnpm db:up` y
   `pnpm db:test:prepare`. Dentro del container, la config de Playwright lee el `.env` del repo
   montado en `/work`.
6. `.github/workflows/ci.yml:73-92,121-141` — en los jobs `integration` y `e2e`, la variable del job
   pasa a llamarse `TEST_DATABASE_URL`, con el mismo valor de hoy: `127.0.0.1` en `integration` y el
   host `postgres` en `e2e`. Los pasos `pnpm db:migrate` y `pnpm db:seed` se reemplazan por
   `pnpm db:test:prepare`. Ninguno de los dos jobs define `DATABASE_URL`. El job `quality` no cambia.
   Se actualizan los comentarios de esos pasos.
7. `tests/unit/ci/workflow.test.ts` — se adapta a la CI nueva (hallazgo 1):
   - `jobsSeedingOutOfOrder` (l.138-150) pasa a exigir que `pnpm db:test:prepare` esté antes del
     comando de la suite y que no queden `pnpm db:migrate` ni `pnpm db:seed` en esos jobs;
   - el test de `integration` (l.391-403) exige `pnpm db:test:prepare` y `TEST_DATABASE_URL` en el
     env, y que no haya `DATABASE_URL` como clave;
   - `test-workflow-auth-env` (l.468-497) exige `pnpm db:test:prepare` antes de la suite E2E;
   - `e2eContainerProblem` (l.215) y sus fixtures (l.428, l.449) leen `TEST_DATABASE_URL`;
   - nuevas aserciones: el script de Docker reenvía `-e TEST_DATABASE_URL` y no `-e DATABASE_URL`, y
     `package.json` define `db:test:prepare` apuntando a `scripts/db-test-prepare.sh`.
8. Mensajes que nombran la variable equivocada (hallazgo 6):
   `tests/integration/database-guard.ts:17` dice "revisá TEST_DATABASE_URL", y
   `tests/integration/health.test.ts:11` pide `TEST_DATABASE_URL` y `pnpm db:test:prepare`.
9. Documentación (FR-08, hallazgo 5):
   - `.env.example`: `TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/mi_grilla_test`,
     con un comentario: es la base que vacían los tests, distinta de `DATABASE_URL`, y se prepara con
     `pnpm db:test:prepare`;
   - `AGENTS.md`, sección *Testing*: integración y E2E usan `TEST_DATABASE_URL` y se preparan con
     `pnpm db:test:prepare`; la descripción de los jobs de la CI;
   - `README.md` l.23, 29-32, 40-43, 63-70, 75-83 y 85-93: las dos bases, el `.env` de ejemplo, los
     pasos de setup, los comandos de test y la CI;
   - `docker-compose.yml`, comentario del encabezado: el mismo servidor tiene la base de desarrollo
     y la de tests, y la de tests la crea `pnpm db:test:prepare`.
10. Entorno local del usuario (no se commitea): agregar al `.env` existente una línea
    `TEST_DATABASE_URL` con el mismo usuario, contraseña, host y puerto que su `DATABASE_URL` y la
    base `mi_grilla_test`, y correr `pnpm db:test:prepare`. Se hace sin mostrar el contenido de `.env`.

No se toca: `src/` (la app sigue con `DATABASE_URL`, FR-05), `prisma.config.ts`, `prisma/seed.ts`,
`vitest.config.ts`, ni los registros históricos de `docs/daw/`.

## Dependencies between steps

- El paso 1 va primero: los pasos 2, 3 y 4 importan su función.
- Los pasos 6 y 7 van juntos (el test del workflow lee la CI), y después del 3 (la CI llama a
  `db:test:prepare`). El paso 5 va junto al 7 (el test lee el script).
- El paso 10 va antes de correr la suite de integración o los E2E en local con los pasos 2 y 4 ya
  hechos.
- Los pasos 8 y 9 no dependen de nada.

**Input validation**

- `TEST_DATABASE_URL` (variable de entorno o `.env`): string no vacío; URL que se pueda parsear con
  `new URL`; sin `host`, `hostaddr`, `port`, `dbname` ni `database` en la query; host local
  (`localhost`, `127.0.0.1`, `::1`, `[::1]`) o `postgres`; distinta de la base de `DATABASE_URL`
  (mismo host normalizado, puerto con 5432 por defecto y nombre de base).
- `DATABASE_URL` (solo para comparar): opcional; si está y no se puede parsear, se trata como si
  pudiera ser la misma base y se rechaza.
- Argumentos del modo comando de `tests/test-database.ts`: al menos uno (el comando); se pasan a
  `spawnSync` como array, sin shell, así que no se interpretan. Sin argumentos, sale con 1 y un
  mensaje de uso.

## Error handling

- `TEST_DATABASE_URL` faltante o vacía — `MissingTestDatabaseError`: "Falta TEST_DATABASE_URL: es la
  base que vacían los tests, distinta de DATABASE_URL (ver .env.example y pnpm db:test:prepare)." La
  suite de integración, `playwright test` y `db:test:prepare` se cortan sin tocar ninguna base.
- `TEST_DATABASE_URL` inválida (no se puede parsear) o con `host`, `hostaddr`, `port`, `dbname` o
  `database` en la query — `UnsupportedTestDatabaseUrlError`, que nombra `TEST_DATABASE_URL` y pide
  poner el host, el puerto y la base en la URL misma. Se corta igual que el anterior.
- `TEST_DATABASE_URL` con un host que no es local ni `postgres` — `UntruncatableDatabaseError`, el de
  hoy, que ahora dice "revisá TEST_DATABASE_URL". Se corta igual.
- `TEST_DATABASE_URL` apunta a la misma base que `DATABASE_URL`, o `DATABASE_URL` es inválida y no
  se puede descartar que lo sea — `SameAsDevelopmentDatabaseError`: "TEST_DATABASE_URL apunta a la
  misma base que DATABASE_URL: los tests la vaciarían. Usá otra base (por ejemplo mi_grilla_test)."
  Se corta igual.
- `prisma migrate deploy` o el seed fallan en `db:test:prepare` (servidor caído, credenciales
  rechazadas) — el modo comando devuelve el código de salida del comando que falló, `set -e` corta el
  script y el mensaje es el del propio Prisma o el código del seed (`[seed] SERVICE_UNAVAILABLE`).
  No se reintenta.

## Tests

- [ ] **`test-integration-runs-on-test-database`** — test de regresión (nuevo, en
      `tests/integration/test-database.test.ts`): dentro de la suite de integración, `DATABASE_URL`
      es igual a `TEST_DATABASE_URL` y apunta a otra base que `MI_GRILLA_DEVELOPMENT_DATABASE_URL`.
      Antes del fix falla (`TEST_DATABASE_URL` no existe y `DATABASE_URL` es la base de desarrollo);
      después pasa. Valida AC-03.
- [ ] **`test-test-database-missing`** (unit, `tests/unit/test-database.test.ts`): sin
      `TEST_DATABASE_URL`, o vacía, la URL faltante es rechazada con `MissingTestDatabaseError`, y el
      mensaje nombra la variable. Valida AC-06.
- [ ] **`test-test-database-same-as-development-rejected`** (unit): la misma base es rechazada con
      `SameAsDevelopmentDatabaseError`, también entre `localhost` y `127.0.0.1`, con el puerto
      implícito contra `:5432` y con una `DATABASE_URL` inválida; otra base, otro puerto u otro host
      local pasan. Valida AC-07.
- [ ] **`test-test-database-query-override-rejected`** (unit): una `TEST_DATABASE_URL` inválida o
      con `?port=`, `?host=`, `?hostaddr=`, `?dbname=` o `?database=` es rechazada con
      `UnsupportedTestDatabaseUrlError`; y una `DATABASE_URL` con `?port=` que la hace igual a la de
      tests es rechazada como misma base. Valida AC-07.
- [ ] **`test-test-database-remote-rejected`** (unit): un host remoto en `TEST_DATABASE_URL` es
      rechazado con `UntruncatableDatabaseError`, y el host `postgres` de la CI pasa. Valida AC-09.
- [ ] **`test-test-database-message-without-url`** (unit): ninguno de los cuatro rechazos incluye en
      el mensaje la URL, el usuario ni la contraseña de ninguna de las dos variables. Valida AC-08.
- [ ] **`test-test-database-command-rejected`** (unit, con `spawnSync` sobre
      `node tests/test-database.ts`): sin `TEST_DATABASE_URL`, el modo comando es rechazado con
      salida 1 y no ejecuta el comando; con una URL válida, ejecuta el comando con `DATABASE_URL`
      igual a la base de tests y devuelve su código de salida, también uno distinto de 0. Valida
      AC-02 y cubre el último caso de "Error handling".
- [ ] **`test-workflow-test-database`** (unit, `tests/unit/ci/workflow.test.ts`): `integration` y
      `e2e` definen `TEST_DATABASE_URL` y no `DATABASE_URL`, corren `pnpm db:test:prepare` antes de
      su suite y ya no corren `db:migrate` ni `db:seed`; un job sin la variable o con el paso faltante
      es rechazado. Valida AC-10 en lo que se puede ver sin correr la CI.
- [ ] **`test-e2e-docker-forwards-test-database`** (unit): `scripts/test-e2e-docker.sh` reenvía
      `-e TEST_DATABASE_URL` y no `-e DATABASE_URL`, y `package.json` define `db:test:prepare`.
      Valida FR-04 y FR-02.
- [ ] Los tests existentes de `workflow.test.ts` se adaptan (paso 7) y siguen pasando, igual que
      `database-guard.test.ts` con el mensaje nuevo.

Evidencia manual, para VERIFY (no son tests automatizados; se registran con comandos y conteos):
- AC-01 y AC-02: con la base de desarrollo con filas, `pnpm db:test:prepare` dos veces seguidas
  termina en 0 las dos veces; `mi_grilla_test` existe, con las migraciones aplicadas y la grilla
  cargada; y la cantidad de filas de `users` de `mi_grilla` es la misma antes y después.
- AC-03: se cuentan las filas de `users` de `mi_grilla` antes y después de `pnpm test:integration`,
  y no cambian.
- AC-04: se cuentan las cuentas `@example.com` en las dos bases antes y después de un archivo E2E en
  `iphone-webkit`, y solo crecen las de `mi_grilla_test`.
- AC-05: con `pnpm dev`, el health check responde sano contra `mi_grilla` (conteo de `users` sin
  cambios).
- AC-10: los tres jobs de la CI en verde en el PR, con `timeout-minutes: 10`.
- AC-11: lectura de `.env.example` y de *Testing* en `AGENTS.md`.

## Regression risk

Medio. La app no cambia, pero cambia cómo arrancan las tres suites y la CI:
- un `.env` local sin `TEST_DATABASE_URL` deja de correr integración y E2E hasta que se agregue la
  variable. Es el comportamiento buscado (FR-06), y el mensaje dice qué hacer;
- si la CI pierde la variable o el paso nuevo, `integration` o `e2e` fallan en el PR (AC-10);
- si Playwright no resuelve la importación con extensión `.ts` desde su config, `playwright test` no
  arranca. Se ve en la primera corrida del E2E en CODE.

## Rollback plan *(mandatory)*

- Steps: revertir el commit de CODE (`git revert`). La base `mi_grilla_test` puede quedar en el
  servidor sin molestar, o se borra con `DROP DATABASE mi_grilla_test`. La línea `TEST_DATABASE_URL`
  del `.env` local queda sin uso.
- Indicators: los jobs `integration` o `e2e` fallan en `main` por la base de tests, o la suite local
  no arranca con un `.env` que tiene las dos variables bien puestas.
