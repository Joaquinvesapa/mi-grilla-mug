# Fix-plan FIX-002: Correr el job e2e de la CI dentro del container de Playwright

| Field | Value |
|-------|-------|
| Ticket | FIX-002 |
| Tier | FIX |
| RCA | docs/daw/specs/rca-FIX-002.md |
| PRD relacionado | docs/daw/prd/prd-FEAT-001.md (FR-06, NFR-04, AC-08, AC-09), sin cambios |
| Date | 2026-11-18 |
| Spec loops | 0 |
| Loops since last human decision | 0 |

## Problem
En 2 de las últimas 5 corridas de un PR (44229931407 y 44223365039), el primer intento del job `e2e`
se canceló por el tope de 10 minutos sin correr ningún test: el paso
`pnpm exec playwright install --with-deps webkit chromium` quedó colgado unos 9 min 30 s. Cuando
anda, ese paso tarda entre 25 y 43 s.

## Root cause
`.github/workflows/ci.yml:139` instala con apt, en cada corrida, las bibliotecas del sistema de WebKit
y Chromium. La cache de `ci.yml:134-137` guarda solo los navegadores (`~/.cache/ms-playwright`), no
lo que apt deja en `/usr`. Así, cada corrida depende de un mirror de Ubuntu, y cuando ese mirror
anda lento el paso no falla: se queda descargando hasta que el tope cancela el job (RCA, "Causa
raíz").

## Coverage: RCA → steps
| Requirement | Covered by |
|---|---|
| FR-01 | Pasos 1 y 2 (imagen de la misma versión que `@playwright/test`), paso 3 (el script local queda alineado y protegido) |
| FR-02 | Pasos 1 y 2 (sin `playwright install` ni cache de `ms-playwright`) |
| FR-03 | Pasos 1 y 2 (`DATABASE_URL` al host `postgres` y `services.postgres` exigido) |
| FR-04 | Pasos 1 y 2 (se conservan los chequeos de E2E_PROJECTS, auth, migrate/seed, reporte y timeout) |
| FR-05 | Paso 4 (`AGENTS.md`) y paso 5 (`README.md`) |
| NFR-01 | Paso 2: el job no tiene steps de apt ni de descarga de navegadores; el test del paso 1 lo exige |
| NFR-02 | Paso 2: `timeout-minutes: 10` no cambia; el test de timeouts existente lo sigue exigiendo |

## Solution — steps
1. `tests/unit/ci/workflow.test.ts` (primero, en rojo):
   - El type `Job` (líneas 32-40) suma `container?: { image?: string } | string`, sin `any`.
   - Una función `playwrightVersion()` que lee `devDependencies['@playwright/test']` de
     `package.json`, y una `playwrightImage(version)` que devuelve
     `mcr.microsoft.com/playwright:v<version>-noble`.
   - Un helper `e2eContainerProblem(workflow, version)` que devuelve el motivo del rechazo, o `null`:
     (a) el job `e2e` tiene `container` y su imagen (forma objeto `image:` o string) es
     `playwrightImage(version)`; (b) ningún step corre `playwright install`; (c) ningún step usa una
     cache con `ms-playwright` en `with.path`; (d) el job tiene `services.postgres`; (e) el host de
     `env.DATABASE_URL` del job es `postgres`.
   - El test "e2e instala WebKit y Chromium con sus dependencias…" (línea 359) se reemplaza por
     `test-workflow-e2e-container`. Conserva lo que hoy chequea (postgres fijado, `pnpm db:migrate`,
     `pnpm db:seed`, `E2E_COMMAND` y la subida de `playwright-report` si falla), deja de exigir el step de
     install, la cache y el step `playwright-version`, y aplica el helper al workflow real (`null`) y
     a fixtures rotos (rechazados).
   - Se borra la constante `PLAYWRIGHT_CACHE_KEY` (líneas 22-23): queda sin uso, y oxlint la marca
     como error (`no-unused-vars`).
   - Un test `test-e2e-docker-image`: la línea `IMAGE=` de `scripts/test-e2e-docker.sh` es
     `playwrightImage(version)`. Sigue el precedente del test que compara la imagen de postgres de
     `ci.yml` con la de `docker-compose.yml` (líneas 326-342).
2. `.github/workflows/ci.yml`, job `e2e`:
   - Suma `container: image: mcr.microsoft.com/playwright:v1.65.1-noble`, que corre como root, sin
     `--user`: Playwright ya agrega `--no-sandbox` a Chromium cuando no se pide el sandbox, y
     `--disable-dev-shm-usage`.
   - Se borran los steps `playwright-version` (líneas 132-133), `actions/cache` de `ms-playwright`
     (134-137) y `pnpm exec playwright install --with-deps webkit chromium` (139), con sus
     comentarios. Se agrega un comentario de por qué el job corre en la imagen (FIX-002).
   - `DATABASE_URL` (línea 115) pasa a `postgresql://mi_grilla:ci-only-password@postgres:5432/mi_grilla`:
     desde un container, el service se alcanza por su nombre. `src/lib/database-url.ts:14` ya acepta
     el host `postgres` sin TLS.
   - No cambian `BETTER_AUTH_URL` (`next start` y Playwright corren en el mismo container),
     `E2E_PROJECTS`, `timeout-minutes: 10`, el service ni el job `integration`.
3. `scripts/test-e2e-docker.sh:27`: la línea `IMAGE=` no cambia de valor (ya es `v1.65.1-noble`);
   desde ahora la protege el test del paso 1. El arreglo de Docker rootless sigue fuera de alcance
   (RCA, Out of Scope).
4. `AGENTS.md:58`, sección Testing, fila "How the suite is run": la descripción del job `e2e` dice que
   corre dentro de `mcr.microsoft.com/playwright:v1.65.1-noble` (la misma imagen que
   `pnpm test:e2e:docker`), sin instalar navegadores ni bibliotecas, y llega a la base por el host
   `postgres` de su service.
5. `README.md:85-92`, sección CI: la descripción del job `e2e` menciona que corre en la imagen de
   Playwright.

Fuera de los pasos, decidido a partir del impact scan:
- `CHANGELOG.md`: lo que entrega FIX-002 se registra en CLOSEOUT, como primer paso del checklist.
- `docs/daw/specs/spec-FEAT-001.md:437-438` describe la cache y `playwright install`: es la spec de un
  ticket cerrado y queda como historia, sin editar.
- `services.postgres.ports` del job `e2e` (líneas 107-108) queda redundante desde el container, pero
  no se toca: no molesta y deja el job igual a `integration`.

## Dependencies between steps
El paso 1 va antes del paso 2: el test tiene que verse fallar contra el `ci.yml` de hoy. Los pasos 3,
4 y 5 son independientes de los otros dos.

## Error handling
- La imagen del container no coincide con la versión de `@playwright/test` (o falta el container): el
  helper lo rechaza nombrando la imagen encontrada y la esperada, el test falla y `quality` marca el
  PR como fallido.
- Hay un step de `playwright install` o una cache de `ms-playwright` en el job: el helper lo rechaza
  nombrando el step.
- `DATABASE_URL` del job apunta a `127.0.0.1`/`localhost`, o el job no tiene `services.postgres`: el
  helper lo rechaza nombrando el host o el service faltante. En la CI real, además, `pnpm db:migrate`
  fallaría sin conexión.
- La imagen de `scripts/test-e2e-docker.sh` no coincide con la versión de `@playwright/test`:
  `test-e2e-docker-image` lo rechaza nombrando las dos.

## Tests
- [ ] **Regression test** — `test-workflow-e2e-container`: con el `ci.yml` de hoy falla (no hay
      container y está el step `playwright install --with-deps`); después del paso 2 pasa.
- [ ] `test-workflow-e2e-container` rechaza un fixture con la imagen `v1.64.0-noble` (versión
      inválida) y uno sin container (error 1).
- [ ] `test-workflow-e2e-container` rechaza un fixture con un step `pnpm exec playwright install` y
      uno con una cache de `ms-playwright` (error 2).
- [ ] `test-workflow-e2e-container` rechaza un fixture con `DATABASE_URL` a `127.0.0.1` y uno sin
      `services.postgres` (error 3, host inválido o service faltante).
- [ ] `test-e2e-docker-image` pasa con el script de hoy y rechaza una imagen de otra versión (error 4,
      versión inválida).
- [ ] Los tests existentes de `tests/unit/ci/workflow.test.ts` (sin `if`, sin `${{ github.event.* }}`
      en `run:`, timeouts, actions fijadas por SHA, cada `pnpm <script>` existe, auth, seed,
      E2E_PROJECTS) siguen pasando.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` pasan.
- [ ] En el PR, el job `e2e` termina en verde en su primer intento (AC-06), y se registra cuánto tardó
      `Initialize containers`.

## Regression risk
Medium — el job `e2e` cambia de entorno: Node, pnpm y el checkout corren dentro de la imagen y no en el
runner. Puede fallar si `pnpm/action-setup` o `actions/setup-node` no andan en el container, o si
bajar la imagen se come una parte grande de los 10 minutos. Las dos cosas se ven en la CI del PR
antes del merge (AC-06). La app y los tests no cambian.

## Rollback plan *(mandatory)*
- Steps: trivial: revert the commit (vuelven los steps de cache e install, `DATABASE_URL` a
  `127.0.0.1` y el test anterior).
- Indicators: el job `e2e` del PR falla en `Initialize containers`, en `setup-node` o en
  `pnpm db:migrate` por conexión, o bajar la imagen tarda más de 3 minutos de forma sostenida.
