# PRD DISC-001-05: En vivo ahora

| Field | Value |
|-------|-------|
| Ticket | DISC-001 (PRD 05 de 7) |
| Tracker | none |
| Date | 2026-11-16 |
| PRD loops | 0 |
| Loops since last human decision | 0 |

## Context and Problem

En el festival hay 5 escenarios funcionando a la vez. La pregunta más repetida del día es "¿quién
está tocando ahora y quién sigue?". Para contestarla con la grilla, la persona tiene que buscar la
hora actual y recorrer las columnas una por una (concepto: `docs/daw/discovery/concept-DISC-001.md`).

Este PRD agrega un botón "En vivo" que contesta esa pregunta en un toque, con los shows elegidos por
el usuario primero.

El festival ya pasó: fue del viernes 13 al domingo 15 de marzo de 2026. Con el reloj real, "En vivo"
nunca mostraría nada. Por eso, la demo en desktop (`/demo`) tiene un reloj simulado para mostrar la
función en cualquier momento.

## Goals

- Que el usuario sepa en un toque quién toca ahora y quién sigue en cada escenario.
- Que sus shows elegidos que están sonando ahora aparezcan primero y marcados.
- Que la demo pueda mostrar "En vivo" a cualquier hora del festival, aunque el festival ya pasó.

## Functional Requirements

- FR-01: La pantalla de la grilla tiene un botón flotante "En vivo" abajo a la derecha. Se ve siempre,
  aunque el usuario haga scroll en la grilla (decisión del usuario, 2026-11-16).
- FR-02: Al tocar "En vivo", se abre un panel desde abajo (bottom sheet) sobre la grilla. El panel se
  cierra deslizándolo hacia abajo, tocando fuera de él o con un botón de cerrar. Al cerrarlo, la
  grilla queda en la misma posición y con los mismos cambios pendientes (decisión del usuario,
  2026-11-16).
- FR-03: El panel muestra los 5 escenarios. En cada uno se ve el show que está sonando ahora, con el
  nombre del artista y su horario. Si en ese escenario no suena nada en ese momento, dice "Nada
  ahora" (decisión del usuario, 2026-11-16).
- FR-04: En cada escenario, el panel también muestra el show que sigue, con el nombre del artista, su
  hora de inicio y cuántos minutos faltan para que empiece. Si en ese escenario ya no hay más shows
  ese día, dice "Terminó por hoy" (decisión del usuario, 2026-11-16).
- FR-05: Un show está sonando desde su minuto de inicio hasta el minuto anterior a su fin. Por
  ejemplo, Tyler, The Creator (22:15 a 23:30) suena desde las 22:15 y ya no suena a las 23:30.
- FR-06: Un show que cruza la medianoche pertenece al día en que empezó, con el mismo corte de las
  06:00 que la grilla (PRD 03). Por ejemplo, el sábado a las 00:30 suena Peggy Gou, del viernes.
- FR-07: Los escenarios donde está sonando un show elegido por el usuario aparecen primero en el
  panel. Si son varios, van entre ellos en el orden de escenarios de la app. Después van los demás
  escenarios, también en el orden de la app (decisión del usuario, 2026-11-16).
- FR-08: Los shows elegidos por el usuario llevan un ícono que los distingue, tanto el que suena ahora
  como el que sigue (decisión del usuario, 2026-11-16).
- FR-09: El panel usa la selección que el usuario ve en la grilla en ese momento. Eso incluye los
  cambios guardados en el dispositivo que todavía no se sincronizaron y los cambios pendientes que
  todavía no confirmó con "Guardar" (como el PRD 04, FR-09).
- FR-10: Fuera del horario de shows (antes del primer show del festival, entre el último show de un
  día y el primero del siguiente), el panel dice que no hay shows en vivo e indica cuándo empieza el
  próximo show del festival, con el día, la hora y el escenario. Por ejemplo, el sábado a las 10:00:
  "Sigue hoy a las 13:45 — Tobika en Samsung Stage".
- FR-11: Después del último show del festival (Kygo, domingo de 23:20 a 00:35), el panel dice "El
  festival terminó".
- FR-12: Mientras el panel está abierto, su contenido se actualiza solo a medida que pasa el tiempo,
  sin cerrarlo ni volver a abrirlo.
- FR-13: Todas las horas se calculan y se muestran en hora de Argentina, sin importar la zona horaria
  del dispositivo.
- FR-14: Fuera de `/demo`, la hora de la app es la hora real. No hay ninguna forma de cambiarla desde
  la app (decisión del usuario, 2026-11-16).
- FR-15: En `/demo`, al lado del iPhone, hay un control del reloj simulado. Permite elegir el día
  (viernes, sábado o domingo) y la hora, y tiene botones para atrasar o adelantar 15 minutos. La app
  que corre dentro del iPhone usa esa hora para "En vivo" y para elegir el día inicial de la grilla
  (PRD 03) (decisión del usuario, 2026-11-16).
- FR-16: `/demo` arranca con el reloj simulado en el viernes 13 de marzo de 2026 a las 22:30.
- FR-17: "En vivo" funciona sin conexión, siempre que la grilla esté disponible en el dispositivo
  (PRD 03, FR-16).
- FR-18: El botón flotante nunca tapa un show de forma permanente. La grilla deja espacio libre al
  final para que cualquier show se pueda llevar con scroll fuera de debajo del botón.

## Non-Functional Requirements

- NFR-01: El panel termina de abrirse en 300 ms o menos desde que se toca "En vivo", en un iPhone 12 o
  más nuevo.
- NFR-02: Con el panel abierto, el contenido refleja que un show empezó o terminó en 60 segundos o
  menos desde ese momento.
- NFR-03: Para el 100 % de los minutos entre las 13:00 del viernes y las 06:00 del lunes, el panel
  muestra en cada escenario el show actual y el siguiente correctos según la grilla.
- NFR-04: El botón "En vivo" y el botón de cerrar miden al menos 44 × 44 pt. En pantallas de 360 a
  430 px de ancho, el panel se lee completo sin scroll horizontal.
- NFR-05: En `/demo`, un cambio en el reloj simulado se ve dentro de la app en 2 segundos o menos.

## Acceptance Criteria

- AC-01 (FR-01): WHEN el usuario hace scroll en la grilla en cualquier dirección, THE botón "En vivo"
  SHALL seguir visible abajo a la derecha.
- AC-02 (FR-02): WHEN el usuario toca "En vivo", THE app SHALL abrir el panel desde abajo sobre la
  grilla.
- AC-03 (FR-02): WHEN el usuario cierra el panel deslizándolo, tocando fuera o con el botón de
  cerrar, THE grilla SHALL quedar en la misma posición de scroll y con los mismos cambios pendientes.
- AC-04 (FR-03, FR-04): WHEN son las 22:30 del viernes, THE panel SHALL mostrar: Flow con Tyler,
  The Creator ahora y "Terminó por hoy"; Samsung con "Nada ahora" y Peggy Gou a las 23:30 (en 60
  min); Alternative con Turf ahora; Perry's con ¥ousuk€ ¥uk1mat$u ahora; y Kidzapalooza con "Nada
  ahora" y "Terminó por hoy".
- AC-05 (FR-05): WHEN son las 23:30 del viernes, THE panel SHALL no mostrar a Tyler, The Creator
  como show actual en Flow, y SHALL mostrar a Peggy Gou como show actual en Samsung.
- AC-06 (FR-06): WHEN son las 00:30 del sábado 14, THE panel SHALL mostrar a Peggy Gou como show
  actual en Samsung.
- AC-07 (FR-07): WHEN son las 22:30 del viernes y el usuario eligió Turf, THE panel SHALL mostrar
  Alternative en el primer lugar y después Flow, Samsung, Perry's y Kidzapalooza, en ese orden.
- AC-08 (FR-07): WHEN son las 22:30 del viernes y el usuario no eligió ningún show que suene ahora,
  THE panel SHALL mostrar los escenarios en el orden de la app.
- AC-09 (FR-08): WHEN son las 22:30 del viernes y el usuario eligió Tyler, The Creator y Peggy Gou,
  THE panel SHALL mostrar el ícono de elegido junto a Tyler, The Creator (ahora) y junto a Peggy Gou
  (sigue).
- AC-10 (FR-09): WHEN el usuario marca Turf en la grilla, no toca "Guardar" y abre "En vivo" a las
  22:30 del viernes, THE panel SHALL mostrar Alternative primero y con el ícono de elegido junto a
  Turf.
- AC-11 (FR-10): WHEN son las 10:00 del sábado, THE panel SHALL decir que no hay shows en vivo y
  SHALL indicar "Sigue hoy a las 13:45 — Tobika en Samsung Stage".
- AC-12 (FR-11): IF la hora es posterior a las 00:35 del lunes 16 de marzo de 2026, THEN THE panel
  SHALL decir "El festival terminó".
- AC-13 (FR-12, NFR-02): WHILE el panel está abierto y la hora pasa de las 23:29 a las 23:30 del
  viernes, THE panel SHALL mostrar a Peggy Gou como show actual en Samsung en 60 segundos o menos,
  sin cerrarse.
- AC-14 (FR-13): IF el dispositivo está configurado con la zona horaria de Madrid, THEN THE app SHALL
  calcular y mostrar "En vivo" con la hora de Argentina.
- AC-15 (FR-14): WHEN el usuario usa la app fuera de `/demo`, THE app SHALL usar la hora real y SHALL
  no ofrecer ningún control para cambiarla.
- AC-16 (FR-15, NFR-05): WHEN en `/demo` se elige el domingo a las 23:00, THE app dentro del iPhone
  SHALL mostrar en "En vivo" a Sabrina Carpenter como show actual en Flow en 2 segundos o menos.
- AC-17 (FR-15): WHEN en `/demo` el reloj está en el viernes a las 22:30 y se toca "+15 min", THE
  reloj simulado SHALL pasar a las 22:45 y la app SHALL usar esa hora.
- AC-18 (FR-15): WHEN en `/demo` se elige el sábado a las 18:00 y se abre la grilla, THE grilla SHALL
  abrir en el sábado.
- AC-19 (FR-16): WHEN se abre `/demo`, THE reloj simulado SHALL marcar el viernes 13 de marzo de 2026
  a las 22:30.
- AC-20 (FR-17): IF no hay conexión pero la grilla está disponible en el dispositivo, THEN THE panel
  "En vivo" SHALL abrirse y mostrar lo mismo que con conexión.
- AC-21 (FR-18): WHEN el usuario hace scroll hasta el final de la grilla, THE último show de la
  columna de la derecha SHALL quedar completamente visible, sin que lo tape el botón "En vivo".
- AC-22 (NFR-01): WHEN el usuario toca "En vivo" en un iPhone 12 o más nuevo, THE panel SHALL
  terminar de abrirse en 300 ms o menos.
- AC-23 (NFR-03): WHEN se recorre cada minuto entre las 13:00 del viernes y las 06:00 del lunes, THE
  show actual y el siguiente de cada escenario SHALL coincidir con la grilla en el 100 % de los
  minutos.
- AC-24 (NFR-04): WHEN se mide la app en una pantalla de 360 px de ancho, THE botón "En vivo" y el
  botón de cerrar SHALL medir al menos 44 × 44 pt, y THE panel SHALL no tener scroll horizontal.

## Out of Scope

- Notificaciones o recordatorios antes de que empiece un show elegido.
- Tocar un show del panel para ir a esa posición de la grilla.
- Cambios de horario en vivo, retrasos o cancelaciones: la grilla es fija (seed).
- Mostrar qué amigos están en cada show (eso es de los grupos, PRD 06 y 07).
- Widgets, Live Activities o la pantalla de bloqueo con "En vivo".
- Reloj simulado fuera de `/demo`, por ejemplo con un parámetro en la URL.
- Que el reloj simulado avance solo (reproducción acelerada).
- Mostrar más de un show siguiente por escenario.

## Risks and Mitigations

- **La hora del dispositivo puede estar mal configurada.** → La app usa la hora del dispositivo
  convertida a hora de Argentina (FR-13). Si el dispositivo tiene la hora mal, "En vivo" también.
  Se acepta: no hay forma confiable de saber la hora sin conexión.
- **La zona horaria del dispositivo puede no ser la de Argentina**, por ejemplo en la demo desde la
  PC. → FR-13 y AC-14.
- **Los shows que cruzan la medianoche** (Peggy Gou, Skrillex y Kygo) pueden caer en el día
  equivocado. → FR-06 y AC-06, con el mismo corte de las 06:00 que la grilla.
- **El botón flotante tapa parte de la grilla.** → FR-18 y AC-21.
- **El reloj simulado de `/demo` tiene que llegar a la app que corre dentro del iPhone.** → NFR-05 y
  AC-16 lo verifican de punta a punta.
- **Que el reloj simulado se pueda usar fuera de la demo** confundiría a un usuario real. → FR-14 y
  AC-15.

## Dependencies

- PRD 03 (Grilla y mi selección): la grilla, el orden de escenarios, la selección, los cambios
  pendientes, la selección pendiente de sincronizar, el corte de las 06:00, el día inicial según la
  hora de la app y la disponibilidad sin conexión (FR-16).
- PRD 01 (Plataforma base): la ruta `/demo` con el marco de iPhone y la app instalable.
- PRD 02 (Cuentas): la grilla, y por lo tanto el botón "En vivo", requieren sesión iniciada.
- PRD 04 (Fondo de pantalla personal): este PRD usa la misma regla de selección (FR-09 del PRD 04).
