# RCA FIX-001: Correr los E2E solo al cierre de CODE, en VERIFY y completos solo en main

| Field | Value |
|-------|-------|
| Ticket | FIX-001 |
| Tracker | none |
| Date | 2026-11-17 |
| PRD loops | 0 |
| Loops since last human decision | 0 |
| PRD relacionado | `docs/daw/prd/prd-FEAT-001.md` (FR-06, AC-08, AC-09), actualizado en este ticket |

## Context and Problem

La suite E2E tiene 82 casos que Playwright corre en 4 proyectos: 254 ejecuciones. En la CI, el paso
`pnpm test:e2e` tarda unos 4 minutos, y el job `e2e` completo unos 5 min 15 s, sobre un tope de
10 minutos (corridas 44225364519 y 44223365039, FEAT-004). En el pipeline de DAW la suite se corre
varias veces por ticket: en cada bloque de CODE, en su cierre y en VERIFY.

### Causa raíz

1. **CI:** el job `e2e` de `.github/workflows/ci.yml` corre `pnpm test:e2e` igual en los dos eventos
   (`pull_request` y `push` a `main`), así que un PR paga los 4 proyectos (iPhone WebKit, Pixel
   Chromium, Chromium 360 y desktop) en cada push, aunque después `main` vuelve a correr todo.
2. **DAW:** la sección *Testing* de `AGENTS.md` lista `pnpm test:e2e` como parte de "cómo se corre
   la suite" sin decir en qué momento del pipeline. Las reglas de DAW no fijan cuándo correr los E2E
   (`.daw/rules/testing.instructions.md` solo dice dónde viven), así que el implementer de cada
   bloque, `daw-test` en el cierre y el verificador corren la suite completa cada vez.

Componente afectado: la CI (job `e2e`) y las reglas de testing del proyecto (`AGENTS.md`). No
cambia nada de la app.

Hueco en el PRD: sí. `prd-FEAT-001.md` FR-06 y AC-08 pedían los E2E completos en cada PR. Se
actualizó con la decisión del usuario (2026-11-17): en un PR, solo el navegador del iPhone; en
`main`, todos.

## Goals

- Que un PR espere menos la corrida E2E, sin dejar de probar en el navegador del iPhone, que es
  donde aparecen los fallos que Chromium no muestra.
- Que `main` siga probándose en los 4 proyectos después de cada merge.
- Que en un ticket de DAW la suite E2E completa corra una vez al cerrar CODE, y no en cada bloque.

## Functional Requirements

- FR-01: En un pull request, la corrida automática ejecuta los E2E solo en el proyecto del iPhone
  (`iphone-webkit`).
- FR-02: Al mergear un pull request a `main`, la corrida automática ejecuta los E2E en los 4
  proyectos.
- FR-03: Durante un bloque de CODE, los tests que se corren son los unitarios, los de integración y,
  si el bloque crea o cambia un E2E, solo ese archivo en un proyecto.
- FR-04: Al cerrar CODE, se corre la suite E2E completa, en los 4 proyectos.
- FR-05: En VERIFY, si el código no cambió desde la corrida del cierre de CODE, se usa esa corrida
  como evidencia; si cambió, la suite E2E completa se corre de nuevo.

## Non-Functional Requirements

- NFR-01: En un pull request, el job `e2e` ejecuta como máximo 90 casos E2E (hoy son 82 en
  `iphone-webkit`, contra 254 en los 4 proyectos).
- NFR-02: El job `e2e` sigue cortándose a los 10 minutos como máximo en los dos eventos.

## Acceptance Criteria

- AC-01 (FR-01): WHEN se abre un pull request o se le suben cambios, THE job `e2e` SHALL ejecutar
  solo los tests del proyecto `iphone-webkit`.
- AC-02 (FR-02): WHEN un pull request se mergea a `main`, THE job `e2e` SHALL ejecutar los tests de
  los proyectos `iphone-webkit`, `mobile-chromium`, `mobile-360` y `desktop`.
- AC-03 (FR-01): IF un test E2E falla en `iphone-webkit` dentro de un pull request, THEN THE job
  `e2e` SHALL marcar el pull request como fallido.
- AC-04 (FR-03): WHEN un agente implementa un bloque de CODE, THE regla de `AGENTS.md` SHALL indicar
  que se corren los unitarios, los de integración y solo el E2E que el bloque escribe, en un
  proyecto.
- AC-05 (FR-04): WHEN se cierra la fase CODE, THE regla de `AGENTS.md` SHALL indicar que se corre la
  suite E2E completa en los 4 proyectos.
- AC-06 (FR-05): WHILE el código no cambió desde la corrida del cierre de CODE, THE regla de
  `AGENTS.md` SHALL indicar que VERIFY usa esa corrida como evidencia de los E2E.
- AC-07 (FR-05): IF el código cambió después del cierre de CODE, THEN THE regla de `AGENTS.md` SHALL
  indicar que VERIFY corre de nuevo la suite E2E completa.

## Out of Scope

- Cambiar los tests E2E, los proyectos de Playwright o su configuración.
- Cachear las dependencias de WebKit o subir el tope de 10 minutos del job.
- Cambiar los jobs `quality` e `integration`.
- Modificar los archivos de DAW en `.daw/`: la regla vive en `AGENTS.md`, que es del proyecto.

## Risks and Mitigations

- **Un fallo solo de Chromium o de 360 px llega a `main`.** Mitigación: el push a `main` corre los 4
  proyectos y marca el commit como fallido; además, el cierre de CODE de cada ticket corre los 4
  proyectos antes del PR.
- **Si `e2e` es un check obligatorio de la protección de `main`, tiene que seguir corriendo en el
  PR.** Mitigación: el job no se saltea, solo cambia qué proyectos corre, así que el check sigue
  apareciendo con su resultado real.

## Dependencies

- `prd-FEAT-001.md` (FR-06, AC-08, AC-09), actualizado en este ticket.
- `playwright.config.ts`: los nombres de los 4 proyectos.
