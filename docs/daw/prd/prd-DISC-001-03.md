# PRD DISC-001-03: Grilla y mi selección

| Field | Value |
|-------|-------|
| Ticket | DISC-001 (PRD 03 de 7) |
| Tracker | none |
| Date | 2026-11-16 |
| PRD loops | 1 |
| Loops since last human decision | 0 |

## Context and Problem

La grilla oficial del Lollapalooza Argentina 2026 es una tabla de doble entrada: los escenarios van
en columnas, los horarios en filas, y cada show es un bloque con el nombre del artista y su
horario. Tiene 3 días (viernes, sábado y domingo), 5 escenarios (Flow, Samsung, Alternative,
Perry's y Kidzapalooza) y 91 shows. Algunos terminan después de la medianoche, como Peggy Gou,
Skrillex y Kygo.

En un celular, esa tabla no entra en la pantalla. Mirarla como imagen obliga a hacer zoom, y no deja
marcar qué artistas vas a ir a ver. Este PRD es el corazón de Mi Grilla: ver la grilla en el
celular con el mismo formato del póster y armar la selección propia (concepto:
`docs/daw/discovery/concept-DISC-001.md`). Los datos salen de la grilla del repo anterior del
usuario, descrita en el concepto.

## Goals

- Que el usuario recorra la grilla de cada día en su celular, con el formato del póster oficial y
  scroll horizontal y vertical.
- Que marque los artistas que va a ir a ver y que esa selección quede guardada en su cuenta.
- Que note cuándo eligió dos shows que se superponen.
- Que pueda consultar la grilla y su selección sin señal en el festival.

## Functional Requirements

- FR-01: La grilla muestra los 3 días del festival y los 91 shows de la fuente de datos, cada uno
  en su día, su escenario y su horario.
- FR-02: Cada día se ve como una tabla con los escenarios en columnas, en este orden: Flow,
  Samsung, Alternative, Perry's y Kidzapalooza. Los horarios van en filas, con marcas por hora.
- FR-03: Cada show es un bloque con el nombre del artista, el subtítulo si tiene, y el horario de
  inicio y fin. La altura y la posición vertical del bloque son proporcionales a su duración y a su
  hora de inicio.
- FR-04: Un show que termina después de la medianoche se muestra en el día del festival en que
  empezó, y el eje horario continúa más allá de las 00:00. Por ejemplo, Peggy Gou va el viernes de
  23:30 a 01:00.
- FR-05: El usuario cambia de día con una selección de día (viernes, sábado o domingo) siempre
  visible en la pantalla de la grilla.
- FR-06: En un celular se ven 3 escenarios a la vez, y los demás se alcanzan con scroll horizontal
  (decisión del usuario, 2026-11-16). Los horarios se recorren con scroll vertical.
- FR-07: Los nombres de los escenarios siguen visibles durante el scroll vertical, y las marcas de
  hora siguen visibles durante el scroll horizontal.
- FR-08: Al abrir la grilla, el día que se muestra depende de la hora actual de la app. Durante un
  día del festival se muestra ese día, contando hasta las 06:00 del día siguiente como parte de él.
  Fuera del festival se muestra el viernes (decisión del usuario, 2026-11-16).
- FR-09: Tocar un show lo marca como elegido. Tocarlo de nuevo lo desmarca.
- FR-10: Las marcas y desmarcas son cambios pendientes hasta que el usuario toca "Guardar". Recién
  ahí quedan guardadas en su cuenta (decisión del usuario, 2026-11-16). Los cambios pendientes se
  conservan al cambiar de día.
- FR-11: Mientras hay cambios pendientes, la pantalla muestra que hay cambios sin guardar y ofrece
  "Guardar" y "Descartar". "Descartar" vuelve a la última selección guardada.
- FR-12: Si el usuario intenta salir de la grilla con cambios pendientes, la app le pide confirmar
  si quiere salir y perderlos.
- FR-13: Los shows elegidos se distinguen visualmente de los no elegidos.
- FR-14: Cuando dos shows elegidos del mismo día se superponen en horario, los dos bloques muestran
  una marca de choque. Superponerse quiere decir compartir al menos un minuto: un show que termina a
  las 18:00 y otro que empieza a las 18:00 no chocan.
- FR-15: La grilla solo se puede ver con sesión iniciada (decisión del usuario, 2026-11-16).
- FR-16: Sin conexión, la app muestra la grilla y la selección del usuario, si ya las vio antes con
  conexión en ese dispositivo. Esa selección incluye los cambios guardados en el dispositivo que
  todavía no se sincronizaron.
- FR-17: Si el usuario toca "Guardar" sin conexión, la selección queda guardada en el dispositivo
  como pendiente de sincronizar. No se pierde aunque se cierre la app o se apague el celular
  (decisión del usuario, 2026-11-16).
- FR-18: Cuando vuelve la conexión y el usuario que guardó tiene la sesión iniciada, la app
  sincroniza automáticamente la selección pendiente con su cuenta, sin que tenga que hacer nada.
- FR-19: Mientras haya una selección pendiente de sincronizar, la app muestra un aviso que dice que
  los cambios están guardados solo en el dispositivo hasta que haya conexión. El aviso sugiere
  descargar la grilla como fondo de pantalla para tenerla a mano mientras tanto (decisión del
  usuario, 2026-11-16).
- FR-20: Si la sincronización encuentra que la selección de la cuenta cambió desde otro dispositivo
  mientras tanto, gana la selección pendiente de este dispositivo, porque es el último guardado que
  hizo el usuario.
- FR-21: La selección pendiente de sincronizar pertenece al usuario que la guardó. Si en ese
  dispositivo inicia sesión otra cuenta, no se le muestra ni se sincroniza en esa cuenta.

## Non-Functional Requirements

- NFR-01: Con conexión 4G simulada, la grilla de un día se ve completa en 2 segundos o menos desde
  que se abre la pantalla.
- NFR-02: Guardar la selección se confirma en 1 segundo o menos en el 95 % de los casos, con la base
  de datos disponible.
- NFR-03: Mobile first. Entre 360 px y 430 px de ancho se ven exactamente 3 columnas de escenario
  completas. Cada bloque de show, aunque dure 30 minutos, mide al menos 44 pt de alto, para que se
  pueda tocar.
- NFR-04: Los nombres de artista se leen en un bloque de 45 minutos o más sin cortarse en más de 2
  líneas, con tamaño de texto de al menos 12 pt.
- NFR-05: Los datos de la grilla coinciden en un 100 % con la fuente: 91 shows, mismos nombres,
  escenarios, días y horarios.

## Acceptance Criteria

- AC-01 (FR-01, NFR-05): WHEN se recorren los 3 días de la grilla, THE app SHALL mostrar los 91
  shows de la fuente, cada uno con su día, escenario, inicio y fin exactos.
- AC-02 (FR-02): WHEN se abre la grilla de cualquier día, THE app SHALL mostrar las columnas en el
  orden Flow, Samsung, Alternative, Perry's, Kidzapalooza, y las filas de horario con marcas por
  hora.
- AC-03 (FR-03): WHEN se muestra un show, THE bloque SHALL incluir el nombre del artista, el
  subtítulo si existe (por ejemplo, Arjaus Crew con "Franco y Mateo Trocca - B2B") y el horario en
  formato "HH:MM – HH:MM".
- AC-04 (FR-03): WHEN se comparan dos shows de duraciones distintas en la misma columna, THE altura
  de cada bloque SHALL ser proporcional a su duración, y su posición vertical SHALL coincidir con su
  hora de inicio en el eje.
- AC-05 (FR-04): WHEN se muestra el viernes, THE app SHALL ubicar a Peggy Gou en Samsung Stage de
  23:30 a 01:00, con el eje horario extendido hasta la 01:00.
- AC-06 (FR-05): WHEN el usuario elige otro día en la selección de día, THE app SHALL mostrar la
  grilla de ese día.
- AC-07 (FR-06): WHERE el ancho de pantalla está entre 360 px y 430 px, THE app SHALL mostrar 3
  columnas de escenario completas y permitir llegar a las otras 2 con scroll horizontal.
- AC-08 (FR-07): WHILE el usuario hace scroll vertical, THE app SHALL mantener visibles los nombres
  de los escenarios. WHILE hace scroll horizontal, SHALL mantener visibles las marcas de hora.
- AC-09 (FR-08): WHEN se abre la grilla y la hora de la app es el sábado del festival a las 21:30,
  o el domingo a las 00:30, THE app SHALL mostrar el sábado.
- AC-10 (FR-08): WHEN se abre la grilla y la hora de la app está fuera de los días del festival,
  THE app SHALL mostrar el viernes.
- AC-11 (FR-09, FR-13): WHEN el usuario toca un show no elegido, THE app SHALL mostrarlo como
  elegido. WHEN lo toca de nuevo, SHALL mostrarlo como no elegido.
- AC-12 (FR-10): WHEN el usuario marca shows y toca "Guardar" con conexión, THE app SHALL guardar
  la selección en su cuenta, y al cerrar sesión y volver a entrar SHALL mostrar esos mismos shows
  elegidos.
- AC-13 (FR-10): WHEN el usuario marca un show el viernes, cambia al sábado y vuelve al viernes sin
  guardar, THE app SHALL seguir mostrando ese show como elegido y pendiente.
- AC-14 (FR-11): WHILE hay cambios pendientes, THE app SHALL mostrar el aviso de cambios sin
  guardar con las opciones "Guardar" y "Descartar".
- AC-15 (FR-11): WHEN el usuario toca "Descartar", THE app SHALL volver a mostrar exactamente la
  última selección guardada.
- AC-16 (FR-12): IF el usuario intenta salir de la grilla con cambios pendientes, THEN THE app SHALL
  pedirle confirmación, y solo SHALL descartar los cambios si confirma.
- AC-17 (FR-14): WHEN el usuario elige dos shows del mismo día que comparten al menos un minuto,
  THE app SHALL mostrar la marca de choque en los dos bloques.
- AC-18 (FR-14): IF dos shows elegidos solo se tocan en el borde (uno termina a la hora en que
  empieza el otro), THEN THE app SHALL no mostrar marca de choque.
- AC-19 (FR-15): IF un visitante sin sesión intenta abrir la grilla, THEN THE app SHALL llevarlo a
  la pantalla de inicio de sesión.
- AC-20 (FR-16): WHEN el usuario abre la grilla sin conexión en un dispositivo donde antes la vio
  con conexión, THE app SHALL mostrar la grilla y su última selección guardada.
- AC-21 (FR-16): IF el usuario abre la grilla sin conexión en un dispositivo donde nunca la vio con
  conexión, THEN THE app SHALL mostrar la pantalla de "sin conexión" del PRD 01.
- AC-22 (FR-17): IF el usuario toca "Guardar" sin conexión, THEN THE app SHALL guardar la selección
  en el dispositivo como pendiente de sincronizar, y al cerrar y volver a abrir la app sin conexión
  SHALL seguir mostrando esa selección.
- AC-23 (FR-18): WHEN vuelve la conexión, hay una selección pendiente y su usuario tiene la sesión
  iniciada, THE app SHALL sincronizarla con la cuenta y quitar el aviso de pendiente. Al entrar
  desde otro dispositivo SHALL verse esa selección.
- AC-24 (FR-18): IF la sincronización falla, THEN THE app SHALL conservar la selección pendiente en
  el dispositivo y reintentar la próxima vez que haya conexión.
- AC-25 (FR-19): WHILE hay una selección pendiente de sincronizar, THE app SHALL mostrar el aviso de
  que los cambios están solo en el dispositivo, con la sugerencia de descargar la grilla como fondo
  de pantalla.
- AC-26 (FR-20): WHEN se sincroniza una selección pendiente y la cuenta tenía otra selección
  guardada desde otro dispositivo, THE app SHALL dejar en la cuenta la selección pendiente de este
  dispositivo.
- AC-27 (FR-21): IF en un dispositivo con selección pendiente de la cuenta A inicia sesión la
  cuenta B, THEN THE app SHALL no mostrar ni sincronizar esa selección en la cuenta B, y SHALL
  conservarla para cuando vuelva a entrar la cuenta A.
- AC-28 (NFR-03): WHERE el ancho de pantalla está entre 360 px y 430 px, THE bloque de un show de 30
  minutos SHALL medir al menos 44 pt de alto.

## Out of Scope

- Agenda: una vista de lista con solo los artistas elegidos.
- Información extra del artista: biografía, fotos, links o música.
- Buscar o filtrar artistas.
- Editar la grilla desde la app (no hay panel de admin, la grilla viene de la fuente).
- Guardar en el dispositivo los cambios que el usuario no confirmó con "Guardar". Si la app se
  cierra antes, esos cambios se pierden.
- Fusionar selecciones de varios dispositivos marca por marca. Gana el último guardado (FR-20).
- Exportar la grilla como imagen (PRDs 04 y 07).
- "En vivo ahora" y el reloj simulado (PRD 05). Este PRD usa la hora de la app tal como esté
  disponible.
- Otros festivales u otras ediciones.

## Risks and Mitigations

- **Con el botón "Guardar", el usuario puede olvidarse de guardar y perder su selección.** → El
  aviso de cambios pendientes está siempre visible (FR-11) y la app pide confirmar antes de salir
  (FR-12).
- **Si se cierra la app o se pierde la batería antes de tocar "Guardar", los cambios se pierden.**
  → Riesgo aceptado con el guardado manual que se eligió. Lo que sí se guardó, aun sin conexión,
  queda en el dispositivo (FR-17).
- **Con "gana el último guardado" (FR-20), lo que se cambió en otro dispositivo mientras este
  estaba sin conexión se pisa.** → Riesgo aceptado: lo normal es usar un solo celular en el
  festival.
- **Si iOS borra los datos de la PWA antes de que vuelva la conexión**, la selección pendiente se
  pierde. → El aviso de FR-19 sugiere descargar la grilla como fondo de pantalla, que no depende de
  la app.
- **Errores al transcribir la fuente**: un horario mal copiado manda al usuario al show equivocado.
  → La fuente se coteja contra los pósters oficiales, y hay un test que verifica los 91 shows
  (NFR-05).
- **Los shows de 30 minutos son bloques chicos para el dedo.** → Tienen alto mínimo de 44 pt
  (NFR-03), aunque la escala se estire.
- **iOS puede borrar los datos guardados sin conexión de una PWA** que no se usa por un tiempo. →
  Se vuelven a cachear cada vez que se abre con conexión, y si no están, la app lo informa
  (AC-21).
- **El festival ya pasó, así que FR-08 casi siempre va a mostrar el viernes.** → El reloj simulado
  del PRD 05 permite probar los otros días.

## Dependencies

- PRD 01 (Plataforma base): la aplicación, la pantalla de "sin conexión" y la corrida automática
  de tests.
- PRD 02 (Cuentas): la selección es por usuario, y la grilla requiere sesión iniciada.
- PRD 05 (En vivo ahora): define el reloj simulado. Mientras no exista, FR-08 usa la hora real.
- PRD 04 (Fondo de pantalla personal): es lo que permite descargar la grilla que sugiere el aviso
  de FR-19. Para que sirva sin conexión, el PRD 04 tiene que poder generar la imagen sin conexión y
  con la selección pendiente. Mientras no exista, el aviso de FR-19 solo informa.
- La fuente de datos de la grilla: el archivo `lollapalooza-schedule.json` del repo
  `joaquinvesapa/mi-grilla-app`, commit `248dba3`, convertido al formato normalizado que define el
  concepto.
- Los PRDs 04, 05, 06 y 07 dependen de este.
