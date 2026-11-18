# RCA FIX-004: Base de datos aparte para los tests

| Field | Value |
|-------|-------|
| Ticket | FIX-004 |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 0 |
| Loops since last human decision | 0 |
| PRD relacionado | `docs/daw/prd/prd-FEAT-001.md` (FR-06, FR-09, riesgo de la base en la CI), sin cambios |

## Context and Problem

En local, la app (`pnpm dev` y `pnpm start`), los tests de integración y los E2E usan la misma base:
la `mi_grilla` del Postgres de `docker-compose.yml`, a la que apunta el `DATABASE_URL` de `.env`.
Cuando el usuario levanta la app para probar algo, encuentra la base vacía de lo que había cargado:
las cuentas creadas a mano desaparecen, y el login con una de ellas responde "credenciales
incorrectas". Para seguir probando tiene que volver a crear las cuentas, los grupos y las selecciones.

El síntoma ya se había diagnosticado (memoria #8524): en la base de desarrollo no quedaba ninguna
cuenta real, solo 307 usuarios `@example.com` creados por los E2E y 2 filas de `login_throttles`.
DAW corre `pnpm test:integration` en cada bloque de CODE, así que la base se vacía muchas veces por
ticket sin que el usuario lo pida.

### Causa raíz

1. **Los tests de integración vacían la base de `.env`.** `tests/integration/setup.ts` carga
   `dotenv/config` y, antes de cada test, ejecuta `DELETE FROM groups`, `DELETE FROM users` y
   `DELETE FROM login_throttles` sobre `process.env.DATABASE_URL`. Borrar `users` arrastra en cascada
   `sessions`, `accounts` y `selected_shows`, y borrar `groups` arrastra `group_members` y
   `group_invites`. Como ese `DATABASE_URL` es el mismo que lee la app en desarrollo, cada corrida
   borra todo lo que el usuario cargó.
2. **El guard protege contra la base equivocada por ubicación, no por propósito.**
   `tests/integration/database-guard.ts` solo deja vaciar bases en `localhost`, `127.0.0.1`, `::1` o
   en el host `postgres` de la CI. Eso evita borrar una base remota, pero la base de desarrollo
   también es local, así que el guard la deja vaciar.
3. **Los E2E escriben en la misma base.** `playwright.config.ts` levanta `pnpm build && pnpm start`
   con el `DATABASE_URL` del entorno o de `.env`, y cada test crea cuentas
   `e2e-…@example.com` (`tests/e2e/auth.ts`) que nunca se borran. No vacían la base, pero la llenan de
   cuentas de prueba que el usuario ve mezcladas con las suyas (por ejemplo, al buscar integrantes de
   un grupo).
4. **No existe una segunda base.** `docker-compose.yml` crea una sola base (`POSTGRES_DB: mi_grilla`)
   y `.env.example` documenta un solo `DATABASE_URL`. No hay ningún comando que prepare otra base para
   los tests.

Componente afectado: el entorno de tests local (setup de integración, configuración de Playwright,
`docker-compose.yml`, scripts de `package.json` y `scripts/test-e2e-docker.sh`). La app no cambia.

En la CI el problema no existe: cada job `integration` y `e2e` tiene su propio service `postgres`
efímero, que se descarta al terminar.

Hueco en el PRD: no. `prd-FEAT-001.md` pide tests de integración contra una base real (FR-09) y una
base efímera dentro de la corrida automática (Risks), y no dice nada de la base del entorno local.
Este fix no cambia ningún requisito de producto.

## Goals

- Que correr los tests de integración o los E2E en local no borre ni ensucie los datos que el usuario
  cargó a mano para probar la app.
- Que sea imposible, y no solo improbable, que los tests de integración vacíen la base de desarrollo
  por un `.env` mal armado.
- Que la CI siga funcionando con su base efímera, sin pasos extra.

## Functional Requirements

- FR-01: En local existe una base de tests, distinta de la base de desarrollo, en el mismo servidor
  PostgreSQL de `docker-compose.yml`. Se crea sin borrar el volumen de datos existente ni los datos de
  la base de desarrollo.
- FR-02: Hay un único comando de `package.json` que deja la base de tests lista para usar: la crea si
  no existe, le aplica las migraciones y le carga la grilla.
- FR-03: Los tests de integración (`pnpm test:integration`) se conectan a la base de tests y nunca a
  la base que usa la app en desarrollo.
- FR-04: Los E2E (`pnpm test:e2e` y `pnpm test:e2e:docker`) levantan la app contra la base de tests.
- FR-05: `pnpm dev`, `pnpm start`, `pnpm db:migrate` y `pnpm db:seed` siguen usando la base de
  desarrollo, como hoy.
- FR-06: Si la base de tests no está configurada, o es la misma base que la de desarrollo, los tests
  de integración se niegan a correr antes de borrar nada, con un mensaje en español que dice qué
  configurar y no muestra la URL ni sus credenciales.
- FR-07: En la CI, los jobs `integration` y `e2e` siguen corriendo contra el service `postgres`
  efímero de cada job.
- FR-08: `.env.example` y la sección *Testing* de `AGENTS.md` describen las dos bases, para qué sirve
  cada una y cómo se prepara la de tests.

## Non-Functional Requirements

- NFR-01: La base de tests usa la misma imagen y la misma versión de PostgreSQL que la de desarrollo
  (`postgres:17.12`), porque está en el mismo servidor.
- NFR-02: El tope de 10 minutos de cada job de la CI no cambia.

## Acceptance Criteria

- AC-01 (FR-01): WHEN el usuario ya tiene la base de desarrollo con datos y corre el comando de FR-02,
  THE base de tests SHALL existir en el mismo servidor y THE base de desarrollo SHALL conservar sus
  filas.
- AC-02 (FR-02): WHEN se corre el comando de FR-02 dos veces seguidas, THE segunda corrida SHALL
  terminar sin error y THE base de tests SHALL tener las migraciones aplicadas y la grilla cargada.
- AC-03 (FR-03): WHEN hay una cuenta en la base de desarrollo y se corre `pnpm test:integration`,
  THE cuenta SHALL seguir existiendo en la base de desarrollo al terminar.
- AC-04 (FR-04): WHEN corre la suite E2E en local, THE cuentas `e2e-…@example.com` que crea SHALL
  quedar en la base de tests y no en la base de desarrollo.
- AC-05 (FR-05): WHEN el usuario corre `pnpm dev` con el `.env` de `.env.example` completo, THE app
  SHALL leer y escribir en la base de desarrollo.
- AC-06 (FR-06): IF la variable de la base de tests falta, THEN THE suite de integración SHALL fallar
  antes de ejecutar cualquier `DELETE`, con un mensaje que nombra la variable.
- AC-07 (FR-06): IF la base de tests apunta a la misma base que `DATABASE_URL` (mismo host, puerto y
  nombre de base), THEN THE suite de integración SHALL fallar antes de ejecutar cualquier `DELETE`.
- AC-08 (FR-06): WHEN la suite de integración se niega a correr, THE mensaje SHALL NOT incluir la URL
  de ninguna de las dos bases ni sus credenciales.
- AC-09 (FR-06): IF la base de tests apunta a un host que no es local ni el `postgres` de la CI, THEN
  THE suite de integración SHALL negarse a vaciarla, como hoy.
- AC-10 (FR-07, NFR-02): WHEN se abre el pull request de este fix, THE jobs `quality`,
  `integration` y `e2e` SHALL terminar en verde, con `timeout-minutes: 10`.
- AC-11 (FR-08): WHEN se leen `.env.example` y la sección *Testing* de `AGENTS.md`, THE dos
  archivos SHALL nombrar la variable de la base de tests y el comando que la prepara.

## Out of Scope

- Borrar las cuentas `@example.com` que ya quedaron en la base de desarrollo: lo puede hacer el
  usuario, y el fix no toca sus datos.
- Un segundo contenedor o un segundo puerto de PostgreSQL para los tests.
- Vaciar la base de tests entre corridas de E2E.
- Cambiar cómo la CI crea sus bases.

## Risks and Mitigations

- **Los scripts de inicialización de la imagen de PostgreSQL solo corren con el volumen vacío.** Una
  base creada con `docker-entrypoint-initdb.d` no aparecería en el volumen que el usuario ya tiene.
  Mitigación: FR-02 crea la base si no existe, sobre el servidor en marcha, y AC-01 lo prueba con
  una base de desarrollo que ya tiene datos.
- **Un `.env` viejo, sin la variable nueva, haría que los tests vuelvan a la base de desarrollo.**
  Mitigación: FR-06 y AC-06: sin la variable, los tests no corren, no la toman de `DATABASE_URL`.
- **La CI dejaría de andar si exige una variable que su workflow no define.** Mitigación: FR-07 y
  AC-10, probados en la CI real antes del merge.
- **Los E2E pueden quedar contra la base equivocada si `.env` define `DATABASE_URL` y Next lo lee
  antes que el entorno.** Next no pisa una variable que ya está en el entorno del proceso.
  Mitigación: AC-04 lo verifica contando las cuentas en las dos bases.

## Dependencies

- `prd-FEAT-001.md` (FR-06, FR-09): sin cambios.
- `docker-compose.yml`: el servidor `postgres:17.12` con el volumen `postgres-data`.
- `tests/integration/setup.ts` y `tests/integration/database-guard.ts`: el borrado antes de cada test
  y el guard de hosts.
- `playwright.config.ts` y `scripts/test-e2e-docker.sh`: cómo los E2E reciben `DATABASE_URL`.
- `.github/workflows/ci.yml`: las variables de los jobs `integration` y `e2e`.
