# color-en-vivo — color por escenario y día, línea de tiempo y «En vivo»

Implementa el artboard elegido `design/color-en-vivo/02-carriles.html` (visual spec) sobre el stack
real. Brief: `design/color-en-vivo/brief.md`. Tokens: `design/system.md`. Rama `feat/FEAT-008-color-en-vivo`.

## Specs

- **S1** — «Me gustaria que hagamos que los escenarios y cada dia corerspondan a un color de la paleta, la app parece muy sobria con todo el mismo color o maso los mismo colores. tiene que ser tanto para cunado lo vemos en la app como para cuando descargamos la imagen que va a ir de fondo de pantalla»
  - Decidido: Flow = foam `#9ccfd8`, Samsung = gold `#f6c177`, Alternative = rose `#ebbcba`, Perry's = pine `#31748f`, Kidzapalooza = iris `#c4a7e7`. Días (artboard 02): Viernes gold, Sábado rose, Domingo pine. Love `#eb6f92` reservado para «En vivo», nunca escenario ni día.
  - Artboard 02 · Carriles: la columna del escenario lleva un tinte del color (7 %), el encabezado un tinte (9 %) con un filete de 3 px arriba; el show elegido se rellena del color del escenario con texto base (texto `#e0def4` peso ≥ 600 sobre pine); el no elegido, borde del color al 45 %; el pestaña activa del día se rellena con su color y las otras muestran un punto del color; barra de 2 px del color del día bajo las pestañas. Fondo de pantalla: mismo carril y encabezado por escenario, bloques del color del escenario (elegidos al 100 %, el resto al 30 %), título del día en su color con una barra debajo.
  - Choque: «Gold is now Samsung's color, so the clash marker (today a gold warning triangle) must be redesigned so it is not confused with Samsung (e.g. text-colored triangle icon + "Choque" label, or a hatched edge). Status never by color alone.» Artboard: borde rayado a la izquierda + ícono triángulo en color de texto + «Choque» visible.
- **S2** — «Por otro lado quiero cambiar en el panel que maneja la hora d ela demo, quiero cambiar el selecctor de horario por un slide, ademas de poder poner un horario tambien a mano»
  - Brief: «a **slider** over the festival day 06:00 → 06:00 of the next day (5-minute steps; hour ticks labeled at least every 3 h; 00:00–05:59 belongs to the previous festival day), a **manual entry** field (text, `inputmode="numeric"`, HH:MM, 16 px font, validates and shows an inline error in Spanish such as "Escribí una hora entre 06:00 y 05:59 del día siguiente" when invalid; Enter or an "Ir" button applies it), and the existing "−15 min" / "+15 min" buttons.»
  - Artboard: error «Escribí una hora con formato HH:MM, entre 06:00 y 05:59 del día siguiente. Por ejemplo, 22:40.»; label «Poné la hora a mano»; mini línea de tiempo por escenario sobre el slider con cursor love.
- **S3** — «Me gustaria tener una linea de tiempo que vaya avanzando en la grilla con el horario ademas de tener la parte 'en vivo'»
  - Brief: «A **now-line** (love) crossing all columns at the simulated time, with the time label on the hour column, that moves when the time changes. Shows playing now get a pulsing love dot.» Artboard: los shows ya terminados se atenúan.
- **S4** — «El 'en vivo' tiene que tener alguna animacion y tener mas color del rojo de la paleta porque no tiene forma de 'en vivo' con el foam»
  - Brief: «The «En vivo» trigger (bottom right) in love with a looping animation.» Artboard: píldora «En vivo» con punto love que late y anillo love.
- **S5** — «Otra cosa que quiero ahcer es que quiero que en el bottom sheet de 'en vivo' cuando en un escenario este tocando algun artista tambien tenga alguna animacion con un punto como el de 'en vivo' y tambien hay que identificar mejor los artistas por escenario con los colores que elijamos. Cuando un artista no este tocando tiene que estar mas opaco o al menos no tener el marcador de 'en vivo'»
  - Brief: «A stage with a show playing: pulsing love dot + "Ahora:" artist + time range, full opacity. A stage with nothing playing: lower opacity and no live dot ("Nada ahora" / "Terminó por hoy"), still showing "Sigue: <artista> en N min" when there is one. Chosen shows keep a check + sr-only "Elegido". Stages playing a chosen show sort first.» Artboard: chip del escenario en su color, barra de avance love, «quedan N min».
- **S6** — Calidad (brief): «Every animation (live button, dots) under `@media (prefers-reduced-motion: no-preference)`; with reduced motion the dot stays solid and the "EN VIVO"/live meaning is still readable as text.» «Status never by color alone: playing = dot + "Ahora" text; chosen = check icon; clash = icon + text.» «WCAG AA for text (4.5:1 normal, 3:1 large); visible focus rings (foam) on every control.»

## Tasks

| ID  | Specs      | Route                                                                                                                                                       | Commit    |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| T1  | S1, S4, S6 | inline — base compartida: `src/lib/stage-colors.ts` (escenario/día → color y color de texto), animaciones `live-*` en `globals.css`, `palette.ts`           | dfb626b   |
| T2  | S1, S3, S6 | worker — grilla: carriles, encabezados, bloques por color, choque rayado, pestañas de día con color, línea del ahora, puntos de show sonando, shows pasados | 8e57ffe   |
| T3  | S1, S6     | worker — fondo de pantalla: colores por escenario y día (layout + canvas)                                                                                   | a6c4a09   |
| T4  | S4, S5, S6 | worker — botón «En vivo» en love animado y panel con chips de color, punto, atenuado, avance                                                                | 29b9e65   |
| T5  | S2, S6     | worker — reloj de `/demo`: slider + hora a mano + ±15                                                                                                       | a9c457b   |
| T6  | S1–S6      | inline — cierre: suite completa, e2e en 4 proyectos, handoff                                                                                                | pendiente |

## Log

- **L1** (2026-11-18, pedido original, textual):
  > - Me gustaria que hagamos que los escenarios y cada dia corerspondan a un color de la paleta, la app parece muy sobria con todo el mismo color o maso los mismo colores. tiene que ser tanto para cunado lo vemos en la app como para cuando descargamos la imagen que va a ir de fondo de pantalla
  > - Por otro lado quiero cambiar en el panel que maneja la hora d ela demo, quiero cambiar el selecctor de horario por un slide, ademas de poder poner un horario tambien a mano
  > - Me gustaria tener una linea de tiempo que vaya avanzando en la grilla con el horario ademas de tener la parte 'en vivo'
  > - El 'en vivo' tiene que tener alguna animacion y tener mas color del rojo de la paleta porque no tiene forma de 'en vivo' con el foam
  > - Otra cosa que quiero ahcer es que quiero que en el bottom sheet de 'en vivo' cuando en un escenario este tocando algun artista tambien tenga alguna animacion con un punto como el de 'en vivo' y tambien hay que identificar mejor los artistas por escenario con los colores que elijamos. Cuando un artista no este tocando tiene que estar mas opaco o al menos no tener el marcador de 'en vivo'
- **L2** (2026-11-18): el usuario eligió 02 · Carriles, revisarla en el canvas (sin comentarios) y entregar todo junto; luego pidió «Implement the design artboard design/color-en-vivo/02-carriles.html … Use the artboard as the visual spec: map its parts to the project's existing components and styles, and do not copy the artboard HTML verbatim. Take colors, typography, spacing, radius and shadows from design/system.md».
- **L3**: mapa del código (explorer): grilla `src/components/schedule-grid.tsx`, `day-picker.tsx`, `schedule-screen.tsx`; en vivo `live-button.tsx`, `live-panel.tsx`, `src/lib/live-now.ts`; demo `demo-clock-control.tsx`, `src/lib/demo-clock.ts`, transporte postMessage (`src/components/demo-clock.ts`); fondo `src/lib/wallpaper-layout.ts`, `src/components/wallpaper-canvas.ts`. E2E sensibles: `tests/e2e/demo.spec.ts` (label «Hora», `toHaveValue`), `tests/e2e/grid.spec.ts` (svg del choque, texto oculto).
- **L4**: contraste medido: texto `#e0def4` sobre pine da 3,96:1 y base sobre pine 3,38:1; ningún texto chico sobre el relleno pine de Perry's llega al 4,5:1 de AA (S6). Se aplica la decisión del brief (texto `#e0def4`, peso ≥ 600) y se avisa al usuario.
- **L5**: T1 en `dfb626b`. T2–T5 lanzadas en paralelo a 4 workers con superficies disjuntas, sin commits propios ni e2e; el padre commitea cada una y corre los e2e en T6.
- **L6**: T2–T5 commiteadas (`8e57ffe`, `a6c4a09`, `29b9e65`, `a9c457b`) + fix de tipos de T1 (`41a89c4`). Unit: 803/803 con cobertura; typecheck, lint y formato limpios. Pendiente: e2e en 4 proyectos. Notas de los workers: «Choque» puede recortarse en bloques de 44 px (el rayado y la descripción oculta quedan); `/demo` ahora lee la grilla de la base (`connection()`), sin base solo falta la mini línea de tiempo; el slider llega hasta 05:55.
