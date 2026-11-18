# PRD FEAT-006b: Administrar y salir de un grupo

| Field | Value |
|-------|-------|
| Ticket | FEAT-006b |
| Origen | docs/daw/prd/prd-FEAT-006.md (índice de la partición) y docs/daw/prd/prd-DISC-001-06.md |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 0 |
| Loops since last human decision | 0 |

## Context and Problem

Con FEAT-006a se puede crear un grupo, invitar con un link y unirse. Falta poder corregir el grupo:
cambiarle el nombre, sacar a alguien que no corresponde, borrarlo, o salir de él. Este PRD agrega
esas acciones y el aviso para cuando se intentan sin conexión.

Parte del PRD 06 de DISCOVERY (`prd-DISC-001-06.md`): FR-12, FR-13, FR-14, la parte de acciones de
FR-20, y NFR-04. Pasan a ser FR-01, FR-02, FR-03, FR-04 y NFR-01. Los AC conservan la numeración del
PRD original.

**Alcance (decisión del usuario, 2026-11-18):** el PRD de FEAT-006 (32 criterios de aceptación) se
partió en tres: FEAT-006a (AC-01 a AC-13, AC-29 y AC-31), FEAT-006b (este, AC-14 a AC-19 y AC-28) y
FEAT-006c (AC-20 a AC-27, AC-30 y AC-32). FEAT-006b depende de FEAT-006a.

## Goals

- Que el administrador pueda corregir su grupo y que cualquiera pueda salir de él.
- Que quien deja un grupo deje de ver sus datos.

## Functional Requirements

- FR-01: El administrador puede cambiar el nombre del grupo, sacar a un integrante y borrar el
  grupo. Borrar el grupo pide confirmación (decisión del usuario, 2026-11-16).
- FR-02: Cualquier integrante puede salir del grupo, con confirmación. Si sale el administrador,
  pasa a serlo el integrante que se unió hace más tiempo. Si sale el último integrante, el grupo se
  borra (decisión del usuario, 2026-11-16).
- FR-03: Quien sale o es sacado de un grupo deja de ver ese grupo y las selecciones de sus
  integrantes. Puede volver a unirse con un link válido.
- FR-04: Crear un grupo, unirse, salir, sacar a alguien, renombrar o generar un link requieren
  conexión, y sin ella la app dice "Necesitás conexión para hacer esto".

## Non-Functional Requirements

- NFR-01: En el 100 % de los intentos de alguien que salió o fue sacado de un grupo de ver ese grupo o
  la selección de sus integrantes, la app lo rechaza.

## Acceptance Criteria

- AC-14 (FR-01): WHEN el administrador saca a un integrante, THE integrante SHALL dejar de figurar
  en el grupo.
- AC-15 (FR-01): WHEN el administrador toca "Borrar grupo" y confirma, THE grupo SHALL dejar de
  existir para todos sus integrantes.
- AC-16 (FR-01): IF un integrante que no es administrador está en la pantalla del grupo, THEN THE app
  SHALL no ofrecerle renombrar el grupo, sacar integrantes ni borrarlo.
- AC-17 (FR-02): WHEN el administrador sale de un grupo con 3 integrantes, THE integrante que se unió
  hace más tiempo SHALL pasar a ser administrador.
- AC-18 (FR-02): WHEN sale el último integrante de un grupo, THE grupo SHALL borrarse.
- AC-19 (FR-03, NFR-01): IF un usuario que salió o fue sacado de un grupo intenta ver ese grupo o la
  selección de sus integrantes, THEN THE app SHALL rechazarlo.
- AC-28 (FR-04): IF no hay conexión y el usuario intenta crear un grupo, unirse, salir, sacar a
  alguien, renombrar o generar un link, THEN THE app SHALL decir "Necesitás conexión para hacer esto"
  y SHALL no hacer el cambio.

## Out of Scope

- Crear grupos, el link de invitación y unirse (FEAT-006a).
- El selector de grupo y las iniciales en la grilla (FEAT-006c).
- Varios administradores por grupo.
- Transferir la administración a mano a otro integrante.
- Notificar a un integrante que fue sacado.

## Risks and Mitigations

- **Borrar un grupo por error.** → Pide confirmación (FR-01).
- **Que el grupo quede sin administrador.** → Al salir el administrador, pasa a serlo el integrante
  más antiguo (FR-02); si no queda nadie, el grupo se borra.
- **Que quien salió siga viendo datos cacheados.** → FR-03 y NFR-01: verificación en cada acceso.

## Dependencies

- FEAT-006a (Crear grupos, invitar y unirse): el grupo, sus integrantes, el administrador y la
  pantalla del grupo.
- PRD 02 / FEAT-002 (Cuentas): la sesión iniciada.
