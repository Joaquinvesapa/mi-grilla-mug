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

## Block 2 — Dibujo y entrega

- La tipografía se pide con `600 28px <familia>` y `700 64px <familia>`. Si
  `getComputedStyle(document.body).fontFamily` viene vacío, se usa `sans-serif`; si no existe
  `document.fonts`, o algún `load` rechaza o resuelve `[]`, `fontFallback` es `true` y se dibuja
  igual. — orquestador — 2026-11-18 — Block 2
- `fonts.load` tiene un plazo único de 1500 ms (`FONT_LOAD_TIMEOUT_MS`) para todos los pesos. Al
  vencer, se dibuja con el respaldo (`fontFallback: true`), así el fondo nunca se cuelga sin
  conexión (FR-10, NFR-01). La spec no lo pedía. — orquestador — 2026-11-18 — Block 2
- Si el contexto no tiene `roundRect` (WebKit viejo), los bloques se dibujan con un path de
  `arcTo` con el mismo radio. — orquestador — 2026-11-18 — Block 2
- Las líneas de hora son `fillRect` de 1 px en `Math.round(y)`, para que salgan nítidas. —
  orquestador — 2026-11-18 — Block 2
- Después de `toBlob`, salga bien o mal, el canvas pasa a 0 × 0 para que WebKit libere el bitmap
  (R-03). — orquestador — 2026-11-18 — Block 2
- `canShareFile` devuelve `false` si `navigator.canShare` lanza: si no se puede preguntar, se
  descarga. Sin `navigator.share`, `shareWallpaper` devuelve `SHARE_FAILED`. — orquestador —
  2026-11-18 — Block 2
- `downloadWallpaper` agrega un `<a download>` oculto, lo clickea y en un `finally` lo saca y
  programa el revoke (`setTimeout(…, 0)`, el "siguiente tick" de la spec). Si `append` o `click`
  lanzan, el error sube a quien llama, y el Block 3 lo muestra como falla. Revocar a 0 ms puede
  cancelar la descarga en algún Safari: se prueba a mano en VERIFY. — orquestador — 2026-11-18 —
  Block 2
- Para el Block 3: si `downloadWallpaper` lanza, la hoja muestra el mensaje genérico del catálogo
  (`wallpaperMessageFor` con un código desconocido) con `role="alert"` y se queda en `ready` para
  reintentar. Si `renderWallpaper` rechaza en vez de devolver un código, la hoja pasa a `failed`
  con `ENCODE_FAILED`. En ningún caso se muestra el `message` del navegador (R-04). — orquestador
  — 2026-11-18 — Block 2
- El threat model (R-04) nombra un código `FONT_UNAVAILABLE` que la spec reemplazó por
  `fontFallback: true`. La implementación sigue la spec. — orquestador — 2026-11-18 — Block 2

## Block 3 — La hoja del fondo en la pantalla de la grilla

- Mientras genera, la acción es el mismo botón principal, deshabilitado, con "Generando…" y un
  ícono que gira (`motion-reduce:animate-none`). La región `aria-live="polite"` está siempre
  montada y solo lleva el texto de estado: "Generando…" en `sr-only`, `WALLPAPER_DONE_LABEL` ("Listo.
  Así lo ponés de fondo:", sumado a `wallpaper-messages.ts`) en `done`, y la alerta. — orquestador
  — 2026-11-18 — Block 3
- En `done` no hay botón de acción (como dice la spec): para volver a guardar se cierra y se abre
  de nuevo. — orquestador — 2026-11-18 — Block 3
- Mientras la hoja de compartir del sistema está abierta, "Guardar en Fotos" está deshabilitado para
  no llamar dos veces a `share()`. — orquestador — 2026-11-18 — Block 3
- La vista previa es un `<img>` con el object URL (`oxlint-disable nextjs/no-img-element`, con el
  motivo en la misma línea: `next/image` no tiene nada que optimizar en un blob). La vista previa y
  su lugar vacío comparten el tope `max-h-[45dvh]`. — orquestador — 2026-11-18 — Block 3
- Al abrir se copian `shows` y `selectedIds`. `day` y `stages` se guardan por referencia porque no
  cambian. — orquestador — 2026-11-18 — Block 3
- Para VERIFY, con VoiceOver: hay un `role="alert"` dentro de la región `polite`, que algunos
  lectores pueden anunciar dos veces. Además, el primer "Generando…" puede no anunciarse porque la
  región se monta junto con la hoja. — orquestador — 2026-11-18 — Block 3

## Block 4 — E2E del fondo

- `tests/e2e/offline.ts` exporta, además de los 4 helpers de la spec, los que necesitan
  (`notice`, `expectChosen`, `readDeviceCopy`, `signUpControlled`). — orquestador — 2026-11-18 —
  Block 4
- En el camino de compartir, el E2E también fuerza `matchMedia("(pointer: coarse)")` (delegando
  los métodos a la lista real), porque `canShareFile` lo exige. — orquestador — 2026-11-18 —
  Block 4
- El E2E verifica lo dibujado leyendo píxeles con la geometría de la spec, que el test replica a
  propósito, como oráculo independiente, sin importar `src/`. Lo protege una guarda que corre o
  rechaza las sondas que caen sobre líneas de hora o bloques vecinos. AC-09 se comprueba con dos
  sondas que solo existen el sábado o el viernes. — orquestador — 2026-11-18 — Block 4
- En este host, WebKit corre con el mismo `docker run` de `scripts/test-e2e-docker.sh` pero sin
  `--user`, porque con Docker rootless falla el script. Arreglar el script queda para un ticket
  aparte. — orquestador — 2026-11-18 — Block 4

## Corrección desde VERIFY (ronda 1)

- `wallpaperFileName` devuelve `mi-grilla.png` si después de normalizar no queda nada (F-VER-04).
  — orquestador — 2026-11-18 — corrección VERIFY
- `WALLPAPER_GUIDE_STEPS` pasa a ser `{ share, download }`, con 4 pasos cada uno: solo cambia el
  paso 1 (con descarga, la imagen está en Descargas/Archivos y hay que pasarla a Fotos). El estado
  `done` guarda por qué camino se entregó. Es una desviación de forma de la spec, que nombraba una
  sola lista, y la pidió VERIFY (W-2). — orquestador — 2026-11-18 — corrección VERIFY
- El paso del zoom dice dónde está el ajuste («⋯» en el editor del fondo) y el mensaje de
  `SHARE_FAILED` ofrece mantener apretada la vista previa. Los textos de iOS («Zoom de
  perspectiva», «Guardar imagen», «Agregar») se confirman en el iPhone real en VERIFY. El paso 1 de
  descarga es largo: si no se entiende en el iPhone, se acorta. — orquestador — 2026-11-18 —
  corrección VERIFY
- Dejan de exportarse `HEADER_HEIGHT`, `TIME_FONT_SIZE`, `AXIS_TOP`, `AXIS_BOTTOM` y los tipos
  internos del layout, de la entrega y del botón: nadie los importaba. Las constantes siguen en el
  módulo con los valores de la spec. Esto reemplaza la decisión del Block 1 que exportaba
  `AXIS_TOP`/`AXIS_BOTTOM`. — orquestador — 2026-11-18 — corrección VERIFY
