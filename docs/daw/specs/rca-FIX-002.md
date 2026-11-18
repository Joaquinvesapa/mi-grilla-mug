# RCA FIX-002: Correr el job e2e de la CI dentro del container de Playwright

| Field | Value |
|-------|-------|
| Ticket | FIX-002 |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 0 |
| Loops since last human decision | 0 |
| PRD relacionado | `docs/daw/prd/prd-FEAT-001.md` (FR-06, NFR-04, AC-08, AC-09), sin cambios |

## Context and Problem

El job `e2e` de `.github/workflows/ci.yml` tiene un tope de 10 minutos. En dos de las últimas cinco
corridas de un pull request, el primer intento se canceló por ese tope sin llegar a correr un solo
test: el paso `pnpm exec playwright install --with-deps webkit chromium` quedó colgado unos
9 min 30 s.

| Corrida | Intento | Paso `playwright install --with-deps` | Resultado del job |
|---------|---------|----------------------------------------|-------------------|
| 44229931407 (PR, FIX-001) | 1 | 03:22:54 → 03:32:28 (9 min 34 s) | cancelado por timeout |
| 44229931407 (PR, FIX-001) | 2 | 29 s | verde |
| 44223365039 (PR, FEAT-004) | 1 | 02:28:03 → 02:37:34 (9 min 31 s) | cancelado por timeout |
| 44223365039 (PR, FEAT-004) | 2 | 43 s | verde |
| 44231617300 (push a main) | 1 | 26 s | verde |
| 44225364519 (push a main) | 1 | 25 s | verde |
| 44207157631 (PR, FEAT-003b) | 1 | 41 s | verde |

Para sacar el PR adelante hubo que re-correr el job a mano (`gh run rerun --failed`), y cada intento
cancelado gastó 10 minutos de runner.

### Causa raíz

1. **Las bibliotecas del sistema se instalan con apt en cada corrida.** `--with-deps` llama a
   `apt-get install` con las dependencias de WebKit y Chromium (bibliotecas gráficas y fuentes, unos
   436 MB según el log de la corrida cancelada, registrado en la memoria #8520). El `actions/cache`
   del job guarda solo `~/.cache/ms-playwright`, es decir los navegadores: las bibliotecas del sistema
   viven en `/usr` del runner, que se descarta al terminar, así que no hay cache que las cubra.
2. **Esa descarga depende de un mirror de Ubuntu que el repo no controla.** Cuando el mirror anda
   lento, el paso no falla: se queda descargando hasta que el tope de 10 minutos cancela el job.
   Para ese momento se gastó todo el presupuesto del job sin haber corrido ningún test.

Componente afectado: la CI (job `e2e`). No cambia nada de la app ni de los tests.

Hueco en el PRD: no. `prd-FEAT-001.md` fija qué corre la CI (FR-06, AC-08, AC-09) y que tarde
10 minutos o menos (NFR-04), no cómo se instalan los navegadores. Este fix ayuda a cumplir NFR-04 sin
cambiar ningún requisito.

## Goals

- Que el job `e2e` no dependa de apt ni de descargar navegadores en cada corrida.
- Que un PR no tenga que re-correrse a mano porque se colgó una instalación.
- Que la CI y `pnpm test:e2e:docker` corran los E2E sobre la misma imagen, con las mismas versiones
  de los navegadores.

## Functional Requirements

- FR-01: El job `e2e` corre dentro de la imagen oficial de Playwright
  (`mcr.microsoft.com/playwright`) de la misma versión que `@playwright/test` en `package.json`, que
  ya trae los navegadores y las bibliotecas del sistema.
- FR-02: El job `e2e` no instala bibliotecas del sistema ni descarga navegadores: no tiene un paso
  `playwright install` ni una cache de `ms-playwright`.
- FR-03: Desde dentro del container, el job `e2e` llega a la base PostgreSQL de su service para migrar,
  cargar la grilla y correr la suite.
- FR-04: El job `e2e` conserva todo lo demás que hace hoy: proyectos de Playwright según el evento
  (FIX-001), `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` descartables, migración y seed antes de la
  suite, subida del reporte si falla y tope de 10 minutos.
- FR-05: La sección *Testing* de `AGENTS.md` describe el job `e2e` como lo deja este fix.

## Non-Functional Requirements

- NFR-01: El job `e2e` no hace ninguna descarga de apt ni de navegadores de Playwright durante la
  corrida.
- NFR-02: El tope del job `e2e` sigue siendo de 10 minutos.

## Acceptance Criteria

- AC-01 (FR-01): WHEN corre el job `e2e`, THE job SHALL ejecutarse dentro de un `container` cuya
  imagen es `mcr.microsoft.com/playwright:v<versión>-noble`, con `<versión>` igual a la versión de
  `@playwright/test` en `package.json`.
- AC-02 (FR-01): IF la versión de la imagen del container no coincide con la de `@playwright/test`,
  THEN THE test del workflow SHALL fallar.
- AC-03 (FR-02, NFR-01): WHEN corre el job `e2e`, THE job SHALL NOT tener un paso que corra
  `playwright install` ni una cache con `ms-playwright` en su ruta.
- AC-04 (FR-03): WHEN el job `e2e` corre `pnpm db:migrate`, `pnpm db:seed` y la suite, THE
  `DATABASE_URL` del job SHALL apuntar al service `postgres` por su nombre de host.
- AC-05 (FR-04, NFR-02): WHEN se abre un pull request o se mergea a `main`, THE job `e2e` SHALL correr
  los mismos proyectos que hoy, con las mismas variables de auth, migrando y cargando la grilla antes
  de la suite, subiendo `playwright-report` si falla y con `timeout-minutes: 10`.
- AC-06 (FR-01..04): WHEN se abre el pull request de este fix, THE job `e2e` SHALL terminar en verde
  en su primer intento.
- AC-07 (FR-05): WHEN se lee la sección *Testing* de `AGENTS.md`, THE descripción del job `e2e`
  SHALL indicar que corre dentro de la imagen de Playwright y que no instala navegadores.

## Out of Scope

- Cambiar los jobs `quality` e `integration`.
- Cambiar los tests E2E, los proyectos de Playwright o `playwright.config.ts`.
- Arreglar `scripts/test-e2e-docker.sh` para Docker rootless (memorias #8502 y #8514): es otro
  ticket.
- Subir el tope de 10 minutos del job.

## Risks and Mitigations

- **Bajar la imagen tarda más que la instalación cuando anda bien.** La imagen de Playwright pesa más
  de 1 GB. Mitigación: el registry de Microsoft no depende de un mirror de Ubuntu y su tiempo de
  descarga es estable. El PR de este fix mide cuánto tarda `Initialize containers` y deja el número en
  el reporte de verificación.
- **Las actions de setup pueden andar distinto dentro de un container.** `pnpm/action-setup` y
  `actions/setup-node` tienen que funcionar en la imagen. Mitigación: AC-06 lo prueba en la CI real
  antes del merge.
- **Actualizar `@playwright/test` sin actualizar la imagen deja navegadores de otra versión.**
  Mitigación: AC-02 hace fallar el test del workflow si las dos versiones no coinciden.
- **Los services se ven distinto desde un container.** Dentro de un container, el service se alcanza
  por su nombre (`postgres`) y no por `127.0.0.1`. Mitigación: AC-04, y la migración del propio job lo
  prueba.

## Dependencies

- `prd-FEAT-001.md` (FR-06, NFR-04, AC-08, AC-09): sin cambios.
- `package.json`: la versión exacta de `@playwright/test` (1.65.1).
- `scripts/test-e2e-docker.sh`: ya usa `mcr.microsoft.com/playwright:v1.65.1-noble`.
- `tests/unit/ci/workflow.test.ts`: los tests del job `e2e` que hoy exigen `playwright install` y la
  cache.
