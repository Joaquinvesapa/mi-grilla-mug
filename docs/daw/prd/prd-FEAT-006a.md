# PRD FEAT-006a: Crear grupos, invitar y unirse

| Field | Value |
|-------|-------|
| Ticket | FEAT-006a |
| Origen | docs/daw/prd/prd-FEAT-006.md (índice de la partición) y docs/daw/prd/prd-DISC-001-06.md |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 0 |
| Loops since last human decision | 0 |

## Context and Problem

Al festival se va en grupo, y cada uno quiere ver artistas distintos. Hoy, saber quién va a qué show
se resuelve preguntando en el grupo de WhatsApp y armando la cuenta a mano (concepto:
`docs/daw/discovery/concept-DISC-001.md`).

Este PRD permite crear un grupo, invitar amigos con un link y unirse a él, y ver los grupos propios
con sus integrantes. Es la base de la administración de grupos (FEAT-006b), del grupo en la grilla
(FEAT-006c) y del fondo de pantalla del grupo (PRD 07).

Parte del PRD 06 de DISCOVERY (`prd-DISC-001-06.md`): FR-01 a FR-11, FR-21, NFR-02, NFR-03 y
NFR-04. FR-21 pasa a ser FR-12; NFR-02, NFR-03 y NFR-04 pasan a ser NFR-01, NFR-02 y NFR-03. Los AC
conservan la numeración del PRD original.

**Alcance (decisión del usuario, 2026-11-18):** el PRD de FEAT-006 (32 criterios de aceptación) se
partió en tres: FEAT-006a (este, AC-01 a AC-13, AC-29 y AC-31), FEAT-006b, administrar y salir
(AC-14 a AC-19 y AC-28), y FEAT-006c, el grupo en la grilla (AC-20 a AC-27, AC-30 y AC-32).

## Goals

- Que un usuario arme un grupo con sus amigos en menos de un minuto, compartiendo un link.
- Que solo los integrantes de un grupo vean su nombre y sus integrantes.

## Functional Requirements

- FR-01: El usuario puede crear un grupo con un nombre de 1 a 40 caracteres. Quien lo crea queda
  como integrante y como administrador del grupo.
- FR-02: Cada grupo tiene como máximo 20 integrantes, y cada usuario puede estar en como máximo 10
  grupos (decisión del usuario, 2026-11-16).
- FR-03: Cada grupo tiene un único link de invitación activo, que vence 3 días después de generado
  (decisión del usuario, 2026-11-16). Al crear el grupo se genera el primero.
- FR-04: Cualquier integrante puede ver y compartir el link activo, con la fecha y hora en que vence.
  Compartir usa la hoja de compartir del sistema (por ejemplo, para mandarlo por WhatsApp) o copia
  el link.
- FR-05: El administrador puede generar un link nuevo. Al hacerlo, el link anterior deja de
  funcionar aunque no haya vencido.
- FR-06: Al abrir un link válido, el usuario ve el nombre del grupo y cuántos integrantes tiene, y se
  une tocando "Unirme".
- FR-07: Si el usuario abre un link de invitación sin sesión iniciada, la app le pide iniciar sesión
  o registrarse, y después lo lleva de vuelta a la invitación.
- FR-08: Si el link venció o fue reemplazado, la app dice "Este link de invitación ya no es válido.
  Pedile uno nuevo a alguien del grupo" y no lo une.
- FR-09: Si el grupo ya tiene 20 integrantes, o el usuario ya está en 10 grupos, la app dice cuál de
  los dos límites se alcanzó y no lo une.
- FR-10: Si el usuario ya es integrante del grupo, abrir el link lo lleva al grupo sin unirlo de
  nuevo.
- FR-11: La pantalla "Grupos" lista los grupos del usuario. Cada grupo tiene su pantalla con el
  nombre, los integrantes (nombre visible y sus iniciales, con una marca en el administrador) y el
  link de invitación.
- FR-12: Solo los integrantes de un grupo ven su nombre, sus integrantes y las selecciones de sus
  integrantes.

## Non-Functional Requirements

- NFR-01: Un link de invitación deja de funcionar a las 72 horas exactas de generado, con un margen de
  1 minuto o menos.
- NFR-02: El link de invitación no se puede adivinar: la probabilidad de acertar un link válido al
  azar es de 1 en 2^128 o menor.
- NFR-03: En el 100 % de los intentos de alguien que no es integrante de ver un grupo o la selección
  de sus integrantes, la app lo rechaza.

## Acceptance Criteria

- AC-01 (FR-01): WHEN el usuario crea el grupo "Los del Lolla", THE app SHALL crearlo con el usuario
  como único integrante y como administrador.
- AC-02 (FR-01): IF el nombre del grupo está vacío o tiene más de 40 caracteres, THEN THE app SHALL no
  crear el grupo y SHALL indicar el largo permitido.
- AC-03 (FR-03): WHEN se crea un grupo, THE app SHALL generar su link de invitación con vencimiento a
  los 3 días.
- AC-04 (FR-04): WHEN un integrante abre la pantalla del grupo, THE app SHALL mostrar el link activo
  con su fecha y hora de vencimiento, y un botón para compartirlo.
- AC-05 (FR-05): WHEN el administrador genera un link nuevo, THE link anterior SHALL dejar de
  funcionar.
- AC-06 (FR-05): IF un integrante que no es administrador está en la pantalla del grupo, THEN THE app
  SHALL no ofrecerle generar un link nuevo.
- AC-07 (FR-06): WHEN un usuario con sesión abre un link válido y toca "Unirme", THE app SHALL
  sumarlo al grupo y mostrarle la pantalla del grupo.
- AC-08 (FR-07): WHEN un usuario sin sesión abre un link válido e inicia sesión, THE app SHALL
  llevarlo de vuelta a la invitación de ese grupo.
- AC-09 (FR-08, NFR-01): IF el link se generó hace más de 72 horas, THEN THE app SHALL mostrar "Este
  link de invitación ya no es válido. Pedile uno nuevo a alguien del grupo" y SHALL no unirlo.
- AC-10 (FR-09, FR-02): IF el grupo ya tiene 20 integrantes, THEN THE app SHALL decir que el grupo
  está completo y SHALL no unirlo.
- AC-11 (FR-09, FR-02): IF el usuario ya está en 10 grupos, THEN THE app SHALL decir que llegó al
  máximo de grupos y SHALL no unirlo.
- AC-12 (FR-10): WHEN un integrante abre el link de su propio grupo, THE app SHALL llevarlo a la
  pantalla del grupo sin duplicarlo como integrante.
- AC-13 (FR-11): WHEN el usuario abre "Grupos", THE app SHALL listar todos sus grupos, y en cada
  grupo SHALL mostrar los integrantes con su nombre visible, sus iniciales y la marca del
  administrador.
- AC-29 (FR-12, NFR-03): IF un usuario que no es integrante intenta ver un grupo o las selecciones de
  sus integrantes, THEN THE app SHALL rechazarlo y SHALL no mostrar el nombre del grupo, sus
  integrantes ni sus selecciones.
- AC-31 (NFR-02): WHEN se generan links de invitación, THE parte variable de cada link SHALL tener al
  menos 128 bits de aleatoriedad.

## Out of Scope

- Renombrar el grupo, sacar integrantes, borrar el grupo y salir de él (FEAT-006b).
- El aviso "Necesitás conexión para hacer esto" para las acciones del grupo sin conexión (FEAT-006b,
  AC-28).
- El selector de grupo y las iniciales de los amigos en la grilla (FEAT-006c).
- Invitación por código corto para tipear: solo link (decisión del usuario, 2026-11-16).
- Invitación con aprobación del administrador.
- Ver amigos que no están en un grupo con el usuario (amistad 1 a 1).
- Chat, comentarios o reacciones dentro del grupo.
- Notificaciones cuando alguien se une.
- Fotos o avatares de los integrantes.
- Varios administradores por grupo.

## Risks and Mitigations

- **Las iniciales pueden repetirse** (Ana Pérez y Andrés Paz son "AP"). → La pantalla del grupo
  muestra cada integrante con su nombre visible y sus iniciales, para saber quién es quién. Se
  acepta para el MVP.
- **Un link compartido puede llegar a gente que no corresponde.** → El link vence a los 3 días
  (FR-03) y el administrador puede reemplazarlo (FR-05). Sacar integrantes llega con FEAT-006b.
- **La lista de integrantes es visible para el grupo.** → Solo para integrantes (FR-12), con
  verificación en el 100 % de los accesos (NFR-03).
- **Hasta FEAT-006b no hay forma de salir de un grupo.** → Se acepta: los sub-tickets se entregan
  en orden y FEAT-006b sigue a este.

## Dependencies

- PRD 02 / FEAT-002 (Cuentas): sesión iniciada, nombre visible (de ahí salen las iniciales) y la
  vuelta a la invitación después de iniciar sesión.
- PRD 03 / FEAT-003a (Grilla y mi selección): la selección guardada de cada integrante, que FR-12
  protege.
- PRD 01 / FEAT-001 (Plataforma base): la aplicación instalable y la corrida automática de tests.
- FEAT-006b y FEAT-006c dependen de este.
