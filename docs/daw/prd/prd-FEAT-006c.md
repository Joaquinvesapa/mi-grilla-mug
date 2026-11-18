# PRD FEAT-006c: El grupo en la grilla

| Field | Value |
|-------|-------|
| Ticket | FEAT-006c |
| Origen | docs/daw/prd/prd-FEAT-006.md (índice de la partición) y docs/daw/prd/prd-DISC-001-06.md |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 0 |
| Loops since last human decision | 0 |

## Context and Problem

Con FEAT-006a hay grupos con integrantes. Lo que el usuario quiere en el festival es ver, show por
show, qué amigos del grupo lo eligieron. Este PRD agrega a la grilla un selector de grupo y las
iniciales de los amigos en cada show, también sin conexión.

Parte del PRD 06 de DISCOVERY (`prd-DISC-001-06.md`): FR-15 a FR-19, la parte de lectura de FR-20,
NFR-01 y NFR-05. Pasan a ser FR-01 a FR-06, NFR-01 y NFR-02. Los AC conservan la numeración del PRD
original.

**Alcance (decisión del usuario, 2026-11-18):** el PRD de FEAT-006 (32 criterios de aceptación) se
partió en tres: FEAT-006a (AC-01 a AC-13, AC-29 y AC-31), FEAT-006b (AC-14 a AC-19 y AC-28) y
FEAT-006c (este, AC-20 a AC-27, AC-30 y AC-32). FEAT-006c depende de FEAT-006a.

## Goals

- Que en la grilla el usuario vea, show por show, qué amigos del grupo lo eligieron.

## Functional Requirements

- FR-01: Si el usuario está en al menos un grupo, la grilla tiene arriba un selector de grupo con sus
  grupos y la opción "Sin grupo". Si no está en ningún grupo, la grilla no muestra el selector ni
  indicadores de amigos (decisión del usuario, 2026-11-16).
- FR-02: Con un grupo elegido en el selector, cada show de la grilla muestra las iniciales de los
  demás integrantes que lo eligieron: hasta 3 iniciales y, si son más, "+N". Por ejemplo, un show
  elegido por 5 amigos muestra 3 iniciales y "+2". El usuario no se ve a sí mismo en los
  indicadores.
- FR-03: Con "Sin grupo" elegido, la grilla no muestra indicadores de amigos.
- FR-04: La grilla recuerda en el dispositivo el último grupo elegido en el selector. La primera vez,
  elige el grupo al que el usuario se unió más recientemente.
- FR-05: Los indicadores muestran la selección guardada de cada amigo. Los cambios que un amigo
  todavía no guardó o no sincronizó no se ven.
- FR-06: Sin conexión, la grilla muestra los indicadores con los últimos datos del grupo que cargó.

## Non-Functional Requirements

- NFR-01: Con conexión 4G simulada, la grilla de un día con un grupo de 20 integrantes, todos con
  selección, se ve completa con sus indicadores en 2 segundos o menos.
- NFR-02: En una pantalla de 360 px de ancho, las iniciales de los indicadores miden al menos 12 px y
  el selector de grupo mide al menos 44 × 44 pt.

## Acceptance Criteria

- AC-20 (FR-01): WHILE el usuario no está en ningún grupo, THE grilla SHALL no mostrar el selector de
  grupo ni indicadores de amigos.
- AC-21 (FR-01, FR-02): WHEN el usuario elige "Los del Lolla" en el selector y Ana y Bruno eligieron
  Tyler, The Creator, THE bloque de Tyler, The Creator SHALL mostrar las iniciales de Ana y de Bruno.
- AC-22 (FR-02): WHEN 5 integrantes, además del usuario, eligieron el mismo show, THE bloque SHALL
  mostrar 3 iniciales y "+2", y SHALL no incluir las iniciales del usuario.
- AC-23 (FR-03): WHEN el usuario elige "Sin grupo" en el selector, THE grilla SHALL no mostrar
  indicadores de amigos.
- AC-24 (FR-04): WHEN el usuario elige un grupo, cierra la app y la vuelve a abrir, THE selector SHALL
  mostrar ese mismo grupo.
- AC-25 (FR-04): WHEN el usuario abre la grilla por primera vez después de unirse a dos grupos, THE
  selector SHALL mostrar el grupo al que se unió último.
- AC-26 (FR-05): WHILE un amigo tiene cambios sin guardar, THE indicadores que ve el usuario SHALL
  mostrar la última selección que ese amigo guardó.
- AC-27 (FR-06): IF no hay conexión, THEN THE grilla SHALL mostrar los indicadores con los últimos
  datos cargados del grupo.
- AC-30 (NFR-01): WHEN con 4G simulada se abre la grilla de un día con un grupo de 20 integrantes con
  selección, THE grilla SHALL verse completa con sus indicadores en 2 segundos o menos.
- AC-32 (NFR-02): WHEN se mide la grilla en una pantalla de 360 px de ancho, THE iniciales SHALL medir
  al menos 12 px y THE selector de grupo SHALL medir al menos 44 × 44 pt.

## Out of Scope

- Crear grupos, invitar y unirse (FEAT-006a); administrar y salir (FEAT-006b).
- Ver indicadores de varios grupos a la vez.
- Actualización en tiempo real de los indicadores: se actualizan al cargar la grilla con conexión.
- Ocultar mi selección a un grupo en particular: estar en un grupo es compartir la selección con él.
- El fondo de pantalla del grupo (PRD 07).

## Risks and Mitigations

- **Un bloque corto de la grilla tiene poco espacio** para nombre, horario e indicadores. → Hasta 3
  iniciales y "+N" (FR-02). El detalle visual se define en el diseño.
- **Sin conexión, los indicadores pueden estar desactualizados.** → Se muestran los últimos datos
  cargados (FR-06). Es mejor que no ver nada en el festival.
- **Las iniciales pueden repetirse.** → La pantalla del grupo (FEAT-006a) muestra nombre e iniciales.

## Dependencies

- FEAT-006a (Crear grupos, invitar y unirse): los grupos, sus integrantes y la verificación de que
  solo los integrantes ven las selecciones.
- PRD 03 / FEAT-003a y FEAT-003b (Grilla y mi selección): la grilla, la selección guardada y la
  lectura sin conexión.
- PRD 02 / FEAT-002 (Cuentas): el nombre visible, del que salen las iniciales.
