# PRD FEAT-007: Fondo de pantalla del grupo

| Field | Value |
|-------|-------|
| Ticket | FEAT-007 |
| Origen | docs/daw/prd/prd-DISC-001-07.md (PRD 07 de 7 de DISC-001) |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 1 |
| Loops since last human decision | 0 |

## Context and Problem

El fondo de pantalla personal (PRD 04, implementado en FEAT-004) responde "¿a quién voy a ver?". En
el festival, la segunda pregunta es "¿con quién voy?", y hoy se contesta preguntando en el grupo de
WhatsApp, con mala señal (concepto: `docs/daw/discovery/concept-DISC-001.md`).

Este PRD agrega una variante del fondo de pantalla con los amigos de un grupo (PRD 06, implementado
en FEAT-006a, FEAT-006b y FEAT-006c). Las iniciales de los amigos aparecen sobre los shows que
eligieron: en los shows del usuario dicen con quién va, y en los demás dicen adónde van los otros.

Ajuste respecto del PRD de DISCOVERY: FIX-003 subió la zona libre inferior del fondo personal de
224 px a 392 px (14 %), para dejar libres la linterna y la cámara de la pantalla de bloqueo
(`prd-FEAT-004.md`, FR-07 y AC-08). Como este fondo usa las mismas zonas libres (FR-05), AC-07 dice
392 px.

Alcance (W-PRD-06, decisión del usuario, 2026-11-18): los 20 AC van en un solo ticket. Once de ellos
(AC-07 a AC-13, AC-19 y AC-20) prueban casos de la misma regla de dibujo, y la descarga, la guía y el
modo sin conexión reusan lo de FEAT-004 y FEAT-006c. Partirlo dejaba una primera parte de 15 AC, sin
un corte más parejo en el que cada parte se pudiera publicar sola.

## Goals

- Que el usuario sepa, desde la pantalla de bloqueo y sin conexión, con qué amigos coincide en cada
  show.
- Que también vea a qué otros shows van sus amigos, sin que eso tape su propio recorrido.
- Que elegir entre el fondo personal y el del grupo sea un solo paso más al descargar.

## Functional Requirements

- FR-01: Al tocar "Descargar fondo" en la grilla, si el usuario está en al menos un grupo, la app le
  pregunta si quiere la grilla sola o con amigos (decisión del usuario, 2026-11-16).
- FR-02: Si elige "Con amigos" y está en varios grupos, elige el grupo. Viene preseleccionado el grupo
  elegido en el selector de la grilla (PRD 06, FR-15). Si en el selector está "Sin grupo", viene
  preseleccionado el grupo al que se unió último. Si está en un solo grupo, se usa ese sin preguntar
  (decisión del usuario, 2026-11-16).
- FR-03: Si el usuario no está en ningún grupo, "Descargar fondo" descarga directamente el fondo
  personal del PRD 04, sin preguntar.
- FR-04: "Grilla sola" genera exactamente el fondo personal del PRD 04.
- FR-05: El fondo del grupo usa el mismo formato que el fondo personal (PRD 04): 1290 × 2796 píxeles,
  el día completo con los 5 escenarios, el tema oscuro fijo, las mismas zonas libres arriba y abajo
  (699 px arriba y 392 px abajo, como el fondo personal después de FIX-003), y los shows del usuario
  encendidos y el resto opacos.
- FR-06: En cada show que eligió el usuario, la imagen muestra las iniciales de los integrantes del
  grupo que también lo eligieron (decisión del usuario, 2026-11-16).
- FR-07: En cada show que el usuario no eligió pero sí eligió algún amigo, el show sigue opaco y la
  imagen muestra igual las iniciales de esos amigos (decisión del usuario, 2026-11-16).
- FR-08: El indicador son las iniciales, como en la grilla: hasta 3 iniciales y, si son más, "+N". El
  usuario no aparece en los indicadores (decisión del usuario, 2026-11-16).
- FR-09: Si el día no tiene ningún show elegido por el usuario, todos los shows aparecen encendidos,
  como en el fondo personal (PRD 04, FR-05), y los shows elegidos por amigos llevan sus iniciales
  (decisión del usuario, 2026-11-16).
- FR-10: La imagen incluye el nombre del día, el nombre del grupo y la marca "Mi Grilla", sin logos ni
  marcas de Lollapalooza.
- FR-11: La selección del usuario es la que ve en la pantalla (PRD 04, FR-09). La de cada amigo es la
  que tiene guardada (PRD 06, FR-19).
- FR-12: Sin conexión, el fondo del grupo se genera con los últimos datos del grupo que cargó el
  dispositivo (PRD 06, FR-20).
- FR-13: En un iPhone, el usuario termina con la imagen en su app Fotos. En una computadora se
  descarga como `mi-grilla-<día>-<grupo>.png`, con el nombre del grupo en minúsculas, sin tildes y con
  guiones. Por ejemplo, `mi-grilla-viernes-los-del-lolla.png`.
- FR-14: Después de descargar, la app muestra la misma guía del fondo personal (PRD 04, FR-12).

## Non-Functional Requirements

- NFR-01: En un iPhone 12 o más nuevo, con un grupo de 20 integrantes, generar la imagen tarda 3
  segundos o menos desde que se confirma la descarga.
- NFR-02: Legibilidad. En la imagen, las iniciales miden al menos 20 px de alto. El nombre de artista
  y la altura de un show de 30 minutos cumplen los mínimos del PRD 04 (28 px y 70 px).
- NFR-03: Contraste. Las iniciales tienen una relación de contraste de al menos 4.5:1 con su fondo,
  también sobre los shows opacos.
- NFR-04: La imagen pesa 5 MB o menos.
- NFR-05: El 100 % de los indicadores de la imagen coinciden con las selecciones guardadas de los
  integrantes del grupo para ese día.

## Acceptance Criteria

- AC-01 (FR-01): WHEN un usuario que está en un grupo toca "Descargar fondo", THE app SHALL preguntarle
  si quiere la grilla sola o con amigos.
- AC-02 (FR-02): WHEN el usuario está en "Los del Lolla" y "Facu y cía", tiene "Facu y cía" en el
  selector de la grilla y elige "Con amigos", THE app SHALL mostrar "Facu y cía" preseleccionado y
  SHALL permitir cambiarlo.
- AC-03 (FR-02): WHEN el usuario está en un solo grupo y elige "Con amigos", THE app SHALL generar la
  imagen con ese grupo sin preguntar cuál.
- AC-04 (FR-02): WHEN el usuario tiene "Sin grupo" en el selector, está en dos grupos y elige "Con
  amigos", THE app SHALL preseleccionar el grupo al que se unió último.
- AC-05 (FR-03): IF el usuario no está en ningún grupo, THEN THE app SHALL descargar el fondo personal
  sin preguntar nada.
- AC-06 (FR-04): WHEN el usuario elige "Grilla sola", THE imagen SHALL ser igual a la del fondo
  personal del PRD 04, sin indicadores de amigos.
- AC-07 (FR-05): WHEN se genera el fondo del grupo, THE imagen SHALL medir 1290 × 2796 píxeles, usar
  el tema oscuro y no tener bloques de shows ni marcas de hora en los 699 px superiores (25 %) ni en
  los 392 px inferiores (14 %).
- AC-08 (FR-06): WHEN el usuario eligió Tyler, The Creator y Ana y Bruno también, THE bloque de Tyler,
  The Creator SHALL estar encendido y mostrar las iniciales de Ana y de Bruno.
- AC-09 (FR-07): WHEN el usuario no eligió Peggy Gou y Ana sí, THE bloque de Peggy Gou SHALL estar
  opaco y mostrar las iniciales de Ana.
- AC-10 (FR-07): WHEN ningún integrante eligió un show que el usuario tampoco eligió, THE bloque de
  ese show SHALL estar opaco y sin iniciales.
- AC-11 (FR-08): WHEN 5 integrantes, además del usuario, eligieron el mismo show, THE bloque SHALL
  mostrar 3 iniciales y "+2", y SHALL no incluir las iniciales del usuario.
- AC-12 (FR-09): IF el usuario no eligió ningún show el sábado y Ana eligió Chappell Roan, THEN THE
  imagen del sábado SHALL mostrar todos los shows encendidos y las iniciales de Ana en Chappell Roan.
- AC-13 (FR-10): WHEN se genera el fondo del viernes para "Los del Lolla", THE imagen SHALL incluir
  "Viernes", "Los del Lolla" y "Mi Grilla", y SHALL no incluir logos ni marcas de Lollapalooza.
- AC-14 (FR-11): WHEN el usuario marca un show sin tocar "Guardar" y Bruno tiene cambios sin guardar,
  THE imagen SHALL mostrar encendido el show que marcó el usuario y SHALL mostrar las iniciales de
  Bruno según su última selección guardada.
- AC-15 (FR-12): IF no hay conexión pero el dispositivo tiene datos cargados del grupo, THEN THE app
  SHALL generar el fondo del grupo con esos datos.
- AC-16 (FR-13): WHEN el usuario descarga desde una computadora el fondo del viernes de "Los del
  Lolla", THE archivo SHALL llamarse `mi-grilla-viernes-los-del-lolla.png`.
- AC-17 (FR-13): WHEN el usuario descarga el fondo del grupo en un iPhone, THE app SHALL permitir
  guardarlo en Fotos.
- AC-18 (FR-14): WHEN termina la descarga del fondo del grupo, THE app SHALL mostrar la guía de cómo
  ponerlo como fondo de la pantalla de bloqueo.
- AC-19 (NFR-01): WHEN el usuario confirma la descarga con un grupo de 20 integrantes en un iPhone 12
  o más nuevo, THE app SHALL tener la imagen lista en 3 segundos o menos.
- AC-20 (NFR-02, NFR-03): WHEN se genera el fondo del grupo de cualquier día, THE iniciales SHALL
  medir al menos 20 px de alto y tener un contraste de al menos 4.5:1 con su fondo, también sobre
  shows opacos.

## Out of Scope

- Una leyenda en la imagen con el nombre completo de cada integrante.
- Combinar varios grupos en una misma imagen.
- Elegir qué integrantes del grupo aparecen.
- Un fondo con los 3 días juntos, o para Android.
- Cambiar el formato, la resolución o la paleta respecto del fondo personal.
- Marcas de choque entre shows dentro de la imagen.

## Risks and Mitigations

- **Un bloque corto tiene que entrar con el nombre, el horario y las iniciales.** Con la zona libre
  inferior de 392 px, el bloque real más corto (domingo, Kidzapalooza 18:00–18:20) mide unos 60 px.
  → Hasta 3 iniciales y "+N" (FR-08), con los mínimos de NFR-02 verificados en el día más largo, el
  domingo de 13:30 a 00:35, y en los bloques más cortos.
- **Con iniciales en los shows opacos, la imagen se puede volver confusa** y tapar el recorrido del
  usuario. → Los shows opacos siguen opacos (FR-07). Solo las iniciales mantienen su contraste
  (NFR-03).
- **Las iniciales pueden repetirse** (Ana Pérez y Andrés Paz son "AP"). → Se acepta, igual que en la
  grilla (PRD 06). La leyenda queda fuera del alcance.
- **Sin conexión, los datos del grupo pueden estar desactualizados.** → Se usan los últimos cargados
  (FR-12), igual que en la grilla.

## Dependencies

- PRD 04 / FEAT-004 (Fondo de pantalla personal), con el ajuste de FIX-003: formato, tamaño, tema,
  zonas libres, regla del día sin selección, regla de la selección en pantalla, descarga en iPhone y
  computadora, y guía.
- PRD 06 / FEAT-006a, FEAT-006b y FEAT-006c (Grupos): los grupos del usuario, el selector de grupo,
  las selecciones guardadas de los integrantes, las iniciales y los datos del grupo sin conexión.
- PRD 03 / FEAT-003a y FEAT-003b (Grilla y mi selección): la grilla y la selección del usuario.
- PRD 02 / FEAT-002 (Cuentas): sesión iniciada y nombre visible de cada integrante.
- PRD 01 / FEAT-001 (Plataforma base): la aplicación instalable y la corrida automática de tests.
