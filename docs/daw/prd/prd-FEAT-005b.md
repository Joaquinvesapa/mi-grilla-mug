# PRD FEAT-005b: Reloj simulado de /demo

| Field | Value |
|-------|-------|
| Ticket | FEAT-005b |
| Origen | docs/daw/prd/prd-FEAT-005.md (índice de la partición) y docs/daw/prd/prd-DISC-001-05.md |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 0 |
| Loops since last human decision | 0 |

## Context and Problem

El festival ya pasó: fue del viernes 13 al domingo 15 de marzo de 2026. Con el reloj real, "En vivo"
(FEAT-005a) siempre dice "El festival terminó" y la grilla abre en el día por defecto. Por eso, la
demo en desktop (`/demo`) necesita un reloj simulado para mostrar la función a cualquier hora del
festival.

Parte del PRD 05 de DISCOVERY (`prd-DISC-001-05.md`): FR-15, FR-16 y NFR-05. Pasan a ser FR-01,
FR-02 y NFR-01; los AC conservan la numeración del PRD original.

**Alcance (decisión del usuario, 2026-11-18):** el PRD de FEAT-005 (24 criterios de aceptación) se
partió en dos: FEAT-005a, el botón y el panel "En vivo" con la hora real (AC-01 a AC-15 y AC-20 a
AC-24), y FEAT-005b, el reloj simulado de `/demo` (AC-16 a AC-19). FEAT-005b depende de FEAT-005a.

## Goals

- Que la demo pueda mostrar "En vivo" y la grilla a cualquier hora del festival, aunque el festival
  ya pasó.

## Functional Requirements

- FR-01: En `/demo`, al lado del iPhone, hay un control del reloj simulado. Permite elegir el día
  (viernes, sábado o domingo) y la hora, y tiene botones para atrasar o adelantar 15 minutos. La app
  que corre dentro del iPhone usa esa hora para "En vivo" y para elegir el día inicial de la grilla
  (PRD 03) (decisión del usuario, 2026-11-16).
- FR-02: `/demo` arranca con el reloj simulado en el viernes 13 de marzo de 2026 a las 22:30.

## Non-Functional Requirements

- NFR-01: En `/demo`, un cambio en el reloj simulado se ve dentro de la app en 2 segundos o menos.

## Acceptance Criteria

- AC-16 (FR-01, NFR-01): WHEN en `/demo` se elige el domingo a las 23:00, THE app dentro del iPhone
  SHALL mostrar en "En vivo" a Sabrina Carpenter como show actual en Flow en 2 segundos o menos.
- AC-17 (FR-01): WHEN en `/demo` el reloj está en el viernes a las 22:30 y se toca "+15 min", THE
  reloj simulado SHALL pasar a las 22:45 y la app SHALL usar esa hora.
- AC-18 (FR-01): WHEN en `/demo` se elige el sábado a las 18:00 y se abre la grilla, THE grilla SHALL
  abrir en el sábado.
- AC-19 (FR-02): WHEN se abre `/demo`, THE reloj simulado SHALL marcar el viernes 13 de marzo de 2026
  a las 22:30.

## Out of Scope

- Reloj simulado fuera de `/demo`, por ejemplo con un parámetro en la URL (FR-14 de FEAT-005a).
- Que el reloj simulado avance solo (reproducción acelerada).
- Elegir una fecha fuera de los 3 días del festival.

## Risks and Mitigations

- **El reloj simulado de `/demo` tiene que llegar a la app que corre dentro del iPhone.** → NFR-01 y
  AC-16 lo verifican de punta a punta.
- **Que el reloj simulado se pueda usar fuera de la demo** confundiría a un usuario real. → FR-14 y
  AC-15 de FEAT-005a, que este ticket no puede romper.

## Dependencies

- FEAT-005a (En vivo con la hora real): el botón y el panel "En vivo".
- PRD 01 / FEAT-001 (Plataforma base): la ruta `/demo` con el marco de iPhone.
- PRD 03 / FEAT-003a (Grilla y mi selección): el día inicial de la grilla según la hora de la app.
