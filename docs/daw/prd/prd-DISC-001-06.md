# PRD DISC-001-06: Grupos

| Field | Value |
|-------|-------|
| Ticket | DISC-001 (PRD 06 de 7) |
| Tracker | none |
| Date | 2026-11-16 |
| PRD loops | 0 |
| Loops since last human decision | 0 |

## Context and Problem

Al festival se va en grupo, y cada uno quiere ver artistas distintos. Hoy, saber quién va a qué show
se resuelve preguntando en el grupo de WhatsApp y armando la cuenta a mano (concepto:
`docs/daw/discovery/concept-DISC-001.md`).

Este PRD permite crear grupos, invitar amigos con un link y ver en la grilla qué shows eligió cada
integrante. Es la base del fondo de pantalla del grupo (PRD 07).

## Goals

- Que un usuario arme un grupo con sus amigos en menos de un minuto, compartiendo un link.
- Que en la grilla vea, show por show, qué amigos del grupo lo eligieron.
- Que la selección de cada uno la vean solo los integrantes de sus grupos.

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
- FR-12: El administrador puede cambiar el nombre del grupo, sacar a un integrante y borrar el
  grupo. Borrar el grupo pide confirmación (decisión del usuario, 2026-11-16).
- FR-13: Cualquier integrante puede salir del grupo, con confirmación. Si sale el administrador,
  pasa a serlo el integrante que se unió hace más tiempo. Si sale el último integrante, el grupo se
  borra (decisión del usuario, 2026-11-16).
- FR-14: Quien sale o es sacado de un grupo deja de ver ese grupo y las selecciones de sus
  integrantes. Puede volver a unirse con un link válido.
- FR-15: Si el usuario está en al menos un grupo, la grilla tiene arriba un selector de grupo con sus
  grupos y la opción "Sin grupo". Si no está en ningún grupo, la grilla no muestra el selector ni
  indicadores de amigos (decisión del usuario, 2026-11-16).
- FR-16: Con un grupo elegido en el selector, cada show de la grilla muestra las iniciales de los
  demás integrantes que lo eligieron: hasta 3 iniciales y, si son más, "+N". Por ejemplo, un show
  elegido por 5 amigos muestra 3 iniciales y "+2". El usuario no se ve a sí mismo en los
  indicadores.
- FR-17: Con "Sin grupo" elegido, la grilla no muestra indicadores de amigos.
- FR-18: La grilla recuerda en el dispositivo el último grupo elegido en el selector. La primera vez,
  elige el grupo al que el usuario se unió más recientemente.
- FR-19: Los indicadores muestran la selección guardada de cada amigo. Los cambios que un amigo
  todavía no guardó o no sincronizó no se ven.
- FR-20: Sin conexión, la grilla muestra los indicadores con los últimos datos del grupo que cargó.
  Crear un grupo, unirse, salir, sacar a alguien, renombrar o generar un link requieren conexión, y
  sin ella la app dice "Necesitás conexión para hacer esto".
- FR-21: Solo los integrantes de un grupo ven su nombre, sus integrantes y las selecciones de sus
  integrantes.

## Non-Functional Requirements

- NFR-01: Con conexión 4G simulada, la grilla de un día con un grupo de 20 integrantes, todos con
  selección, se ve completa con sus indicadores en 2 segundos o menos.
- NFR-02: Un link de invitación deja de funcionar a las 72 horas exactas de generado, con un margen de
  1 minuto o menos.
- NFR-03: El link de invitación no se puede adivinar: la probabilidad de acertar un link válido al
  azar es de 1 en 2^128 o menor.
- NFR-04: En el 100 % de los intentos de alguien que no es integrante de ver un grupo o la selección
  de sus integrantes, la app lo rechaza.
- NFR-05: En una pantalla de 360 px de ancho, las iniciales de los indicadores miden al menos 12 px y
  el selector de grupo y los botones de "Grupos" miden al menos 44 × 44 pt.

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
- AC-09 (FR-08, NFR-02): IF el link se generó hace más de 72 horas, THEN THE app SHALL mostrar "Este
  link de invitación ya no es válido. Pedile uno nuevo a alguien del grupo" y SHALL no unirlo.
- AC-10 (FR-09): IF el grupo ya tiene 20 integrantes, THEN THE app SHALL decir que el grupo está
  completo y SHALL no unirlo.
- AC-11 (FR-09): IF el usuario ya está en 10 grupos, THEN THE app SHALL decir que llegó al máximo de
  grupos y SHALL no unirlo.
- AC-12 (FR-10): WHEN un integrante abre el link de su propio grupo, THE app SHALL llevarlo a la
  pantalla del grupo sin duplicarlo como integrante.
- AC-13 (FR-11): WHEN el usuario abre "Grupos", THE app SHALL listar todos sus grupos, y en cada
  grupo SHALL mostrar los integrantes con su nombre visible, sus iniciales y la marca del
  administrador.
- AC-14 (FR-12): WHEN el administrador saca a un integrante, THE integrante SHALL dejar de figurar
  en el grupo.
- AC-15 (FR-12): WHEN el administrador toca "Borrar grupo" y confirma, THE grupo SHALL dejar de
  existir para todos sus integrantes.
- AC-16 (FR-12): IF un integrante que no es administrador está en la pantalla del grupo, THEN THE app
  SHALL no ofrecerle renombrar el grupo, sacar integrantes ni borrarlo.
- AC-17 (FR-13): WHEN el administrador sale de un grupo con 3 integrantes, THE integrante que se unió
  hace más tiempo SHALL pasar a ser administrador.
- AC-18 (FR-13): WHEN sale el último integrante de un grupo, THE grupo SHALL borrarse.
- AC-19 (FR-14, FR-21, NFR-04): IF un usuario que salió o fue sacado de un grupo intenta ver ese grupo
  o la selección de sus integrantes, THEN THE app SHALL rechazarlo.
- AC-20 (FR-15): WHILE el usuario no está en ningún grupo, THE grilla SHALL no mostrar el selector de
  grupo ni indicadores de amigos.
- AC-21 (FR-15, FR-16): WHEN el usuario elige "Los del Lolla" en el selector y Ana y Bruno eligieron
  Tyler, The Creator, THE bloque de Tyler, The Creator SHALL mostrar las iniciales de Ana y de Bruno.
- AC-22 (FR-16): WHEN 5 integrantes, además del usuario, eligieron el mismo show, THE bloque SHALL
  mostrar 3 iniciales y "+2", y SHALL no incluir las iniciales del usuario.
- AC-23 (FR-17): WHEN el usuario elige "Sin grupo" en el selector, THE grilla SHALL no mostrar
  indicadores de amigos.
- AC-24 (FR-18): WHEN el usuario elige un grupo, cierra la app y la vuelve a abrir, THE selector SHALL
  mostrar ese mismo grupo.
- AC-25 (FR-18): WHEN el usuario abre la grilla por primera vez después de unirse a dos grupos, THE
  selector SHALL mostrar el grupo al que se unió último.
- AC-26 (FR-19): WHILE un amigo tiene cambios sin guardar, THE indicadores que ve el usuario SHALL
  mostrar la última selección que ese amigo guardó.
- AC-27 (FR-20): IF no hay conexión, THEN THE grilla SHALL mostrar los indicadores con los últimos
  datos cargados del grupo.
- AC-28 (FR-20): IF no hay conexión y el usuario intenta crear un grupo, unirse, salir, sacar a
  alguien, renombrar o generar un link, THEN THE app SHALL decir "Necesitás conexión para hacer esto"
  y SHALL no hacer el cambio.
- AC-29 (FR-21, NFR-04): IF un usuario que no es integrante intenta ver un grupo o las selecciones de
  sus integrantes, THEN THE app SHALL rechazarlo y SHALL no mostrar el nombre del grupo, sus
  integrantes ni sus selecciones.
- AC-30 (NFR-01): WHEN con 4G simulada se abre la grilla de un día con un grupo de 20 integrantes con
  selección, THE grilla SHALL verse completa con sus indicadores en 2 segundos o menos.
- AC-31 (NFR-03): WHEN se generan links de invitación, THE parte variable de cada link SHALL tener al
  menos 128 bits de aleatoriedad.
- AC-32 (NFR-05): WHEN se mide la grilla en una pantalla de 360 px de ancho, THE iniciales SHALL medir
  al menos 12 px y THE selector de grupo SHALL medir al menos 44 × 44 pt.

## Out of Scope

- Invitación por código corto para tipear: solo link (decisión del usuario, 2026-11-16).
- Invitación con aprobación del administrador.
- Ver amigos que no están en un grupo con el usuario (amistad 1 a 1).
- Ver indicadores de varios grupos a la vez.
- Chat, comentarios o reacciones dentro del grupo.
- Notificaciones cuando alguien se une o cambia su selección.
- Actualización en tiempo real de los indicadores: se actualizan al cargar la grilla con conexión.
- Ocultar mi selección a un grupo en particular: estar en un grupo es compartir la selección con él.
- Fotos o avatares de los integrantes.
- Varios administradores por grupo.

## Risks and Mitigations

- **Las iniciales pueden repetirse** (Ana Pérez y Andrés Paz son "AP"). → La pantalla del grupo
  muestra cada integrante con su nombre visible y sus iniciales, para saber quién es quién. Se
  acepta para el MVP.
- **Un bloque corto de la grilla tiene poco espacio** para nombre, horario e indicadores. → Hasta 3
  iniciales y "+N" (FR-16). El detalle visual se define en el diseño.
- **Un link compartido puede llegar a gente que no corresponde.** → El link vence a los 3 días
  (FR-03), el administrador puede reemplazarlo (FR-05) y sacar integrantes (FR-12).
- **La selección de cada uno es visible para su grupo.** → Solo para integrantes (FR-21), con
  verificación en el 100 % de los accesos (NFR-04).
- **Sin conexión, los indicadores pueden estar desactualizados.** → Se muestran los últimos datos
  cargados (FR-20). Es mejor que no ver nada en el festival.

## Dependencies

- PRD 02 (Cuentas): sesión iniciada, nombre visible (de ahí salen las iniciales) y la vuelta a la
  invitación después de iniciar sesión.
- PRD 03 (Grilla y mi selección): la grilla donde se muestran los indicadores, la selección guardada
  de cada integrante y la lectura sin conexión.
- PRD 01 (Plataforma base): la aplicación instalable y la corrida automática de tests.
- El PRD 07 (Fondo de pantalla del grupo) depende de este: usa el grupo elegido y las selecciones de
  sus integrantes.
