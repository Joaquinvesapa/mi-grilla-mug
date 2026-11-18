# Threat model FIX-004: Base de datos aparte para los tests

| Field | Value |
|-------|-------|
| Ticket | FIX-004 |
| Spec | docs/daw/specs/fix-FIX-004.md |
| Tier | FIX |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `tests/test-database.ts` | Paso 1 |
| `tests/integration/setup.ts` | Paso 2 |
| `scripts/db-test-prepare.sh` | Paso 3 |
| `playwright.config.ts` | Paso 4 |
| `scripts/test-e2e-docker.sh` | Paso 5 |
| `.github/workflows/ci.yml` | Paso 6 |

## Trust boundaries
- `.env` / entorno del proceso → herramientas de test: `TEST_DATABASE_URL` y `DATABASE_URL` cruzan
  con credenciales de la base adentro; las escribe el desarrollador o el workflow.
- Herramientas de test → servidor PostgreSQL local (`127.0.0.1:5432` del compose, o el service
  `postgres` del job): `DELETE`, migraciones y seed sobre la base que la URL nombra.
- Host → container de Playwright (`scripts/test-e2e-docker.sh`): `TEST_DATABASE_URL` se reenvía por
  nombre con `-e`.
- `tests/test-database.ts` (modo comando) → proceso hijo: el comando y sus argumentos vienen de
  `scripts/db-test-prepare.sh`, y el hijo recibe `DATABASE_URL` en su entorno.

## STRIDE analysis
### `tests/test-database.ts`
- **Spoofing:** una URL armada para parecer otra base (`?port=`, `?host=`, `?hostaddr=`, `?dbname=`)
  haría que `pg` conecte a la base de desarrollo pasando la comparación; se rechaza cualquier URL con
  esos parámetros (R-01).
- **Tampering:** la función no escribe nada; el único efecto es devolver la URL o lanzar. El modo
  comando pasa los argumentos a `spawnSync` como array, sin shell, así que no hay inyección de
  comandos por los argumentos.
- **Repudiation:** no aplica a una herramienta local de desarrollo; los rechazos se ven en la salida
  de la suite o del comando, con el nombre de la variable.
- **Information Disclosure:** los mensajes de los cuatro errores nunca incluyen la URL ni sus
  credenciales, y el modo comando nunca imprime la URL (R-02).
- **Denial of Service:** un `.env` sin la variable corta la suite; es el comportamiento buscado y el
  mensaje dice qué agregar. No hay un vector que dependa de un tercero.
- **Elevation of Privilege:** el proceso hijo corre con los mismos permisos del usuario que lo lanza;
  no hay cambio de privilegios.

### `tests/integration/setup.ts`
- **Spoofing:** compara contra la `DATABASE_URL` original guardada en
  `MI_GRILLA_DEVELOPMENT_DATABASE_URL`, no contra la que el setup reescribe, así que un segundo archivo
  en el mismo proceso no puede hacer pasar la base de desarrollo por la de tests (R-03).
- **Tampering:** el `DELETE` antes de cada test es el riesgo central del ticket: solo corre después de
  que `resolveTestDatabaseUrl` aceptó la base, y `assertTruncatableDatabaseUrl` se sigue aplicando en
  cada `beforeEach` (R-04).
- **Repudiation:** no aplica; los tests no registran acciones de usuarios.
- **Information Disclosure:** el error que corta la suite es el de `tests/test-database.ts`, sin URL.
- **Denial of Service:** si la base de tests no está preparada, la suite falla con el error de
  conexión de siempre; no afecta a la base de desarrollo.
- **Elevation of Privilege:** sin cambio: usa las credenciales del `.env`, que ya tienen permiso para
  crear tablas.

### `scripts/db-test-prepare.sh`
- **Spoofing:** usa la misma función de validación, así que no migra ni siembra la base de desarrollo
  aunque `TEST_DATABASE_URL` la nombre (R-04).
- **Tampering:** `prisma migrate deploy` crea la base de tests si no existe y aplica las migraciones
  versionadas del repo; el seed carga `data/schedule.json`. No toca otra base.
- **Repudiation:** no aplica a una herramienta local.
- **Information Disclosure:** la URL no aparece en el script, en sus argumentos ni en su salida: viaja
  solo por el entorno del proceso hijo.
- **Denial of Service:** con el servidor caído, el comando falla y `set -e` corta; no reintenta en
  bucle.
- **Elevation of Privilege:** `CREATE DATABASE` lo hace Prisma con el usuario del compose, que ya es
  dueño del servidor local; no se piden permisos nuevos.

### `playwright.config.ts`
- **Spoofing:** misma validación que el setup antes de levantar `next start` (R-04).
- **Tampering:** los E2E escriben cuentas solo en la base de tests; `next start` no pisa con `.env`
  el `DATABASE_URL` que recibe del entorno.
- **Repudiation:** no aplica.
- **Information Disclosure:** `process.loadEnvFile` no imprime nada; la URL solo llega al entorno de
  `next start`.
- **Denial of Service:** sin la variable, `playwright test` no arranca; es lo buscado.
- **Elevation of Privilege:** no cambia el proceso ni sus permisos.

### `scripts/test-e2e-docker.sh`
- **Spoofing:** el container usa la red del host; la base sigue siendo el `127.0.0.1` del host,
  validada por `playwright.config.ts` dentro del container.
- **Tampering:** solo cambia qué variable se reenvía; el montaje del repo y los volúmenes no cambian.
- **Repudiation:** no aplica.
- **Information Disclosure:** `TEST_DATABASE_URL` se reenvía por nombre (`-e NAME`), nunca como
  `NAME=valor`, así que no aparece en el script, en su salida ni en `ps`.
- **Denial of Service:** sin cambio respecto de hoy.
- **Elevation of Privilege:** sin cambio: el container sigue corriendo con el uid/gid del host.

### `.github/workflows/ci.yml`
- **Spoofing:** el valor de `TEST_DATABASE_URL` está escrito en el workflow, con la credencial
  descartable `ci-only-password` de hoy; no viene de un input del evento.
- **Tampering:** los jobs siguen corriendo contra su service efímero; no se agregan permisos ni
  actions nuevas.
- **Repudiation:** los logs de Actions registran cada paso, como hoy.
- **Information Disclosure:** la credencial del service no es un secreto: la base es efímera y solo
  accesible desde el job (R-05).
- **Denial of Service:** el tope de 10 minutos no cambia; `db:test:prepare` hace lo mismo que los dos
  pasos que reemplaza.
- **Elevation of Privilege:** sin cambios en `permissions` ni en el token del workflow.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| `TEST_DATABASE_URL` / `DATABASE_URL` (usuario y contraseña de la base local) | credentials | en `.env`, fuera de git (`.gitignore`), con los permisos del archivo del usuario | solo por loopback (`127.0.0.1`, puerto atado a 127.0.0.1 en el compose) o la red interna del job; nunca en argumentos ni en la salida |
| Cuentas de prueba `e2e-…@example.com` y sus contraseñas de test | credentials | en `mi_grilla_test`, con hash de Better Auth; datos de prueba descartables | loopback, sin TLS como hoy (R-04 de FEAT-001) |
| Cuentas reales creadas a mano por el desarrollador | PII | en `mi_grilla`, el volumen local del compose; este fix es lo que evita que los tests las borren | loopback, sin TLS como hoy |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | Una `TEST_DATABASE_URL` con `?port=` o `?host=` pasa la comparación y `pg` conecta a la base de desarrollo, que los tests vacían | S | L | H | `resolveTestDatabaseUrl` rechaza `host`, `hostaddr`, `port`, `dbname` y `database` en la query, y del lado de `DATABASE_URL` los aplica antes de comparar (fix-plan, paso 1; test `test-test-database-query-override-rejected`) |
| R-02 | Un mensaje de rechazo o la salida del modo comando muestran la URL con la contraseña | I | L | M | los mensajes nombran solo la variable y el modo comando nunca imprime la URL (test `test-test-database-message-without-url`) |
| R-03 | Con `isolate: false`, el setup compara la base de tests contra sí misma y deja de detectar la de desarrollo | S | L | H | se guarda la `DATABASE_URL` original una sola vez en `MI_GRILLA_DEVELOPMENT_DATABASE_URL` y se compara contra esa (fix-plan, paso 2) |
| R-04 | Un `.env` mal armado hace que la integración, los E2E o `db:test:prepare` escriban en la base de desarrollo | T | M | H | los tres caminos pasan por la misma función, que rechaza una base faltante, igual a la de desarrollo o remota antes de conectar (tests `test-test-database-missing`, `test-test-database-same-as-development-rejected`, `test-test-database-remote-rejected`) |
| R-05 | La credencial del service de la CI se lee en el workflow público | I | L | L | es una credencial descartable de una base efímera solo alcanzable desde el job, como hoy; no se reutiliza en ningún otro lado |

## Supply chain
Sin dependencias nuevas. `tests/test-database.ts` usa solo `node:child_process` y `URL`; el script
usa `node --env-file-if-exists` (Node 24) y Prisma, que ya están fijados en `package.json`.

## Availability
El único vector es que la suite no corra si falta la variable, y es el comportamiento buscado
(FR-06). En la CI, los jobs mantienen el tope de 10 minutos; `db:test:prepare` reemplaza dos pasos
que hacían lo mismo.
