# Decisiones de FEAT-004 fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque. En `autonomy: minimal`, "orquestador" quiere
decir que se mostró al usuario sin pedirle aprobación previa; cualquier objeción suya la revierte.

## Block 1 — Layout puro de la imagen

- Todo texto del layout es `{ text, x, y, font, color }`, con (x, y) en la esquina superior
  izquierda: el Block 2 dibuja con `textAlign = "left"` y `textBaseline = "top"`. "Mi Grilla" se
  alinea a la derecha y los escenarios se centran calculándolo con `measureText`. — orquestador —
  2026-11-18 — Block 1
- El layout también exporta `AXIS_TOP` (849), `AXIS_BOTTOM` (2572), `GRID_LEFT` (120) y
  `GRID_RIGHT` (1266) para el dibujo. — orquestador — 2026-11-18 — Block 1
- Medidas internas del bloque: padding de 12 px a los costados y 6 px arriba y abajo; interlineado
  de 30 px para el artista y 22 px para el horario (una línea y el horario ocupan 64 px; el bloque
  real más chico, domingo Kidzapalooza 18:00 con el tope, mide ≈ 67.8 px). La ronda 1 usaba 8/30/24
  y dejaba sin horario a los dos shows de 20 min del domingo, contra FR-03 y NFR-05. — orquestador —
  2026-11-18 — Block 1
- Título en y = 723, escenarios en y = 803, y etiquetas de hora alineadas a la derecha en la
  canaleta (terminan en x = 108), justo arriba de su línea, para que la de 01:00 no salga de la
  banda. — orquestador — 2026-11-18 — Block 1
- El horario y las etiquetas de hora usan `600 22px`. El Block 2 solo carga los pesos 600 y 700.
  — orquestador — 2026-11-18 — Block 1
- El horario se reserva primero y las líneas del artista ocupan el alto restante. Así todo show
  tiene horario, que es lo que pide FR-03. — orquestador — 2026-11-18 — Block 1
- Una palabra más ancha que el bloque se corta con "…" y el texto termina ahí. Si ni "…" entra, la
  línea se omite (nunca se dibuja texto fuera del bloque). — orquestador — 2026-11-18 — Block 1
- `wallpaperLayout` descarta los shows de otro `dayId`, además de los de escenario desconocido, y el
  eje sale solo de los shows que se dibujan. — orquestador — 2026-11-18 — Block 1
- `wallpaperFileName` pasa a minúsculas, quita tildes y reemplaza lo que no sea `[a-z0-9]` por
  `-`. — orquestador — 2026-11-18 — Block 1
- `wallpaper-messages.ts` incluye ya `WALLPAPER_SHEET_TITLE`, `RETRY_LABEL` y
  `wallpaperPreviewAlt(dayName)`, que usa la hoja del Block 3. Los 4 pasos de la guía son redacción
  propia y se revisan contra iOS en español en VERIFY. — orquestador — 2026-11-18 — Block 1
- `nextStartByShow` ordena una copia con `sort` en vez de usar `Map.groupBy` o `toSorted`, para no
  exigir un Safari de iOS reciente. — orquestador — 2026-11-18 — Block 1
- `MIN_BLOCK_HEIGHT` conserva el nombre de la spec, con un comentario que lo distingue del de la
  grilla en pantalla (`schedule-layout.ts`, 44 px). `MINUTE_MS` se redefine localmente. —
  orquestador — 2026-11-18 — Block 1
