# Brief — color por escenario y día, línea de tiempo y «En vivo» (color-en-vivo)

Shared spec for every artboard in this folder. Read it whole, plus `docs/design/system.md`.

## User request (verbatim, 2026-11-18)

> - Me gustaria que hagamos que los escenarios y cada dia corerspondan a un color de la paleta, la app parece muy sobria con todo el mismo color o maso los mismo colores. tiene que ser tanto para cunado lo vemos en la app como para cuando descargamos la imagen que va a ir de fondo de pantalla
> - Por otro lado quiero cambiar en el panel que maneja la hora d ela demo, quiero cambiar el selecctor de horario por un slide, ademas de poder poner un horario tambien a mano
> - Me gustaria tener una linea de tiempo que vaya avanzando en la grilla con el horario ademas de tener la parte 'en vivo'
> - El 'en vivo' tiene que tener alguna animacion y tener mas color del rojo de la paleta porque no tiene forma de 'en vivo' con el foam
> - Otra cosa que quiero ahcer es que quiero que en el bottom sheet de 'en vivo' cuando en un escenario este tocando algun artista tambien tenga alguna animacion con un punto como el de 'en vivo' y tambien hay que identificar mejor los artistas por escenario con los colores que elijamos. Cuando un artista no este tocando tiene que estar mas opaco o al menos no tener el marcador de 'en vivo'

## Decisions already made

- Stage colors (fixed in every direction): Flow = foam `#9ccfd8`, Samsung = gold `#f6c177`,
  Alternative = rose `#ebbcba`, Perry's = pine `#31748f`, Kidzapalooza = iris `#c4a7e7`.
- Love `#eb6f92` is reserved for «En vivo»: the live button, the now-line, and the "playing now"
  dots. Never a stage or day color.
- Each day also gets a palette color (each direction proposes its own mapping, see its section).
- Only Rosé Pine values from `docs/design/system.md`. Dark theme. UI copy in Spanish (es-AR,
  voseo). Pine on base is 3.38:1: never small pine text on a dark background; on a pine fill use
  `#e0def4` text at weight ≥ 600.
- Gold is now Samsung's color, so the clash marker (today a gold warning triangle) must be
  redesigned so it is not confused with Samsung (e.g. text-colored triangle icon + "Choque" label,
  or a hatched edge). Status never by color alone.

## Artboard format

One self-contained HTML file, inline CSS/JS/SVG, system font stack
(`ui-sans-serif, system-ui, sans-serif`), no external URLs. Canvas size 1760 × 1000 CSS px,
background `#191724`, with a short title + one-line tradeoff at the top and four panels side by
side, each labeled:

1. **App · grilla** — a 390 × 844 phone screen (rounded frame, notch area/safe area respected) of
   the Sábado grid: header "Mi Grilla", day tabs Viernes / Sábado / Domingo, sticky stage header row
   (5 columns), sticky hour column, 2 px per minute (scale it down if needed to fit, keeping
   proportions), shows positioned by time, scrollable vertically inside the phone. A **now-line**
   (love) crossing all columns at the simulated time, with the time label on the hour column,
   that moves when the time changes. Shows playing now get a pulsing love dot. The «En vivo»
   trigger (bottom right) in love with a looping animation.
2. **App · En vivo abierto** — the same phone with the bottom sheet open (drag handle, title
   "En vivo", the simulated time). One row per stage identified by its color. A stage with a show
   playing: pulsing love dot + "Ahora:" artist + time range, full opacity. A stage with nothing
   playing: lower opacity and no live dot ("Nada ahora" / "Terminó por hoy"), still showing
   "Sigue: <artista> en N min" when there is one. Chosen shows keep a check + sr-only "Elegido".
   Stages playing a chosen show sort first.
3. **Fondo de pantalla** — the 1290 × 2796 lock-screen wallpaper drawn scaled to 390 × 845
   (keep the iOS clock area at the top free: the date/time of the lock screen covers ~the top 30 %).
   Personal wallpaper of Sábado: chosen shows lit in their stage color, the rest dimmed (today 30 %
   opacity), stage names and hours labeled, the day's color used as the direction defines. No
   now-line and no live markers on the wallpaper (it is a static image).
4. **Demo · reloj** — the `/demo` desktop control panel (~420 px wide) that drives the simulated
   time: day tabs (Viernes / Sábado / Domingo), the current simulated time shown large, a **slider**
   over the festival day 06:00 → 06:00 of the next day (5-minute steps; hour ticks labeled at least
   every 3 h; 00:00–05:59 belongs to the previous festival day), a **manual entry** field (text,
   `inputmode="numeric"`, HH:MM, 16 px font, validates and shows an inline error in Spanish such as
   "Escribí una hora entre 06:00 y 05:59 del día siguiente" when invalid; Enter or an "Ir" button
   applies it), and the existing "−15 min" / "+15 min" buttons.

**Interactive:** the artboard's JS must wire panel 4 to panels 1 and 2: moving the slider, typing
a time, or the ±15 buttons update the now-line position, the playing dots in the grid, and the
sheet rows (playing / not playing / sorting / "en N min") live. Changing the day tab switches
between the three days' data where you have it (Sábado is required; Viernes/Domingo may reuse
the layout with their own data below or show only the day color change).

Initial simulated time: **Sábado 22:40**. At that moment: Flow plays Chappell Roan (22:15–23:45),
Alternative plays Riize (22:30–23:30), Perry's plays Brutalismus 3000 (22:30–23:45), Samsung has
nothing now (Sigue: Skrillex 23:45), Kidzapalooza "Terminó por hoy".

Chosen shows (selection) on Sábado: Angela Torres, Paulo Londra, Addison Rae, Chappell Roan,
Brutalismus 3000, Skrillex. Chappell Roan and Brutalismus 3000 overlap → both show the clash marker.

## Sábado data (from `data/schedule.json`; show ids are `sat-<stage>-<HHMM>`)

- Flow: Joaquina 14:30–15:15 · Lany 16:00–17:00 · Marina 18:00–19:00 · Addison Rae 20:15–21:15 ·
  Chappell Roan 22:15–23:45
- Samsung: Tobika 13:45–14:30 · Nasa Histoires 15:15–16:00 · Angela Torres 17:00–18:00 ·
  Paulo Londra 19:00–20:15 · Lewis Capaldi 21:15–22:15 · Skrillex 23:45–01:00
- Alternative: Marttein 14:30–15:15 · Timø 16:00–17:00 · Soledad 18:00–19:00 ·
  Tv Girl 20:15–21:15 · Riize 22:30–23:30
- Perry's: Paula Os 13:45–14:30 · Terra 14:45–15:30 · Imbermind 16:00–17:00 ·
  Amigo de Artistas 17:15–18:00 · Six Sex 18:30–19:30 · Hamdi 19:45–20:45 ·
  2Hollis + Rommulas 21:00–22:00 · Brutalismus 3000 22:30–23:45
- Kidzapalooza: Arjaus Crew 15:00–15:45 · Latin Duo 16:00–16:45 · School Of Rock 17:00–17:45 ·
  Kiseki 18:00–18:45 · Panam Y Circo 19:00–19:45 · Kidza Boom 20:00–20:45

Grid axis for Sábado: 13:00 → 01:00 (whole hours around the first start and last end).

## Quality bar

- Follow `.agents/skills/mobile-native/SKILL.md` (safe areas, 44 px targets, no ungated hover,
  16 px inputs) and `.agents/skills/gestures/SKILL.md` for the sheet's look (handle, snap).
- Every animation (live button, dots) under `@media (prefers-reduced-motion: no-preference)`;
  with reduced motion the dot stays solid and the "EN VIVO"/live meaning is still readable as text.
- Status never by color alone: playing = dot + "Ahora" text; chosen = check icon; clash = icon + text.
- WCAG AA for text (4.5:1 normal, 3:1 large); visible focus rings (foam) on every control.
- Real copy only, no lorem ipsum. Identify shows by id in data attributes, never by artist name.
