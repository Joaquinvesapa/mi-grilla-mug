# Spec FEAT-004: Fondo de pantalla personal

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| PRD | docs/daw/prd/prd-FEAT-004.md |
| Tier | FEATURE |
| Date | 2026-11-18 |
| Spec loops | 1 |
| Loops since last human decision | 1 |

## Summary
La imagen se dibuja en el navegador con Canvas 2D (ADR-005): sin servidor, sin dependencias nuevas,
con la selección que se ve en pantalla (el `draft` de `ScheduleScreen`, que ya incluye los cambios
sin guardar y la selección pendiente de sincronizar) y también sin conexión, porque `ScheduleScreen`
es la misma pantalla en `/` y en `/~offline` (ADR-004). La geometría es una función pura en
`src/lib/wallpaper-layout.ts`. El dibujo, la tipografía y la entrega (hoja de compartir o descarga)
viven en `src/components/`. Un botón "Descargar fondo" en la fila de los días abre una hoja (Vaul)
con la vista previa, la acción de guardar y, al terminar, la guía para la pantalla de bloqueo.
Son 4 bloques: layout puro; dibujo y entrega; la hoja en la pantalla; E2E. Incorpora R-01 a R-05 de
`docs/daw/security/threat-FEAT-004.md`, los 13 gaps del Impact Check y los 12 hallazgos de la
auditoría de arquitectura de PLAN.

### Decisiones aplicadas
- **Del usuario (2026-11-18, DEFINE):** un solo ticket con los 15 AC (W-PRD-06).
- **Técnica — ADR-005:** Canvas 2D en el cliente. No `next/og` (no anda sin conexión ni ve el
  `draft`) ni capturas del DOM (dependencia nueva, frágil en WebKit).
- **Técnica — geometría propia de la imagen.** De `src/lib/schedule-layout.ts` se reusan solo
  `dayAxis` y `hourMarks`. `blockGeometry` no sirve: usa `PX_PER_MINUTE = 2` y
  `MIN_BLOCK_HEIGHT = 44`, que son de la grilla en pantalla y quedan sin cambios. La imagen calcula
  su escala con el alto disponible: los 3 días tienen un eje de 720 min (13:00 a 01:00), así que la
  escala queda en 1723 / 720 ≈ 2.39 px/min, y un show de 30 min mide ≈ 71.8 px (NFR-02).
- **Técnica — zonas libres:** `SAFE_TOP = 699` (25 % de 2796, redondeado hacia arriba) y
  `SAFE_BOTTOM = 224` (8 %, redondeado hacia arriba). La banda útil va de y = 699 a y = 2572. Arriba
  de la banda hay solo fondo liso. El encabezado (día, "Mi Grilla", escenarios) ocupa los primeros
  150 px de la banda, y el eje, de y = 849 a y = 2572.
- **Técnica — dónde va el botón:** dentro de `ScheduleScreen`, a la derecha de los días, por una
  prop opcional `action` de `DayPicker`. `AppBar` y sus 3 usos no cambian (gap 9 del impact scan).
  Así el botón aparece también en `/~offline`, y no se deshabilita sin conexión (FR-10).
- **Técnica — dos toques en todos los dispositivos.** "Descargar fondo" abre la hoja y genera la
  imagen. Con la imagen lista, un segundo botón hace la entrega. WebKit exige un gesto reciente para
  `navigator.share`, y generar la imagen puede consumirlo (R-05). Un solo flujo, el mismo en iPhone y
  en computadora, es más simple de probar.
- **Técnica — cuál entrega:** "Guardar en Fotos" (`navigator.share({ files })`) si
  `navigator.canShare({ files: [file] })` da `true` con el archivo real y
  `matchMedia("(pointer: coarse)")` coincide. Si no, "Descargar imagen" (`<a download>` con object
  URL). Una computadora con share de archivos (Safari de macOS) descarga igual, que es lo que pide
  AC-02.
- **Técnica — cuándo "terminó la descarga" (FR-12):** con share, cuando `share()` resuelve. Con
  `<a download>`, cuando se dispara el click, porque el navegador no avisa cuándo terminó de
  escribir el archivo.
- **Técnica — tipografía:** la familia se lee de `getComputedStyle(document.body).fontFamily` (el
  nombre que registra `next/font`), no de la variable CSS, que `ctx.font` no entiende. Se pide con
  `document.fonts.load`. Si no carga, se dibuja con la familia de respaldo de esa misma cadena y la
  imagen sale igual (FR-10). El archivo `woff2` ya está en el precache del service worker
  (`src/app/serwist/[path]/route.ts`, `globPatterns`).
- **Técnica — colores:** fondo `BASE` (#191724). Show encendido: bloque `FOAM` (#9ccfd8) con texto
  `BASE`, contraste 10.37:1. Show opaco: el mismo bloque con `globalAlpha = 0.3`
  (`DIMMED_OPACITY`, ≤ 0.35). Día y nombres en `TEXT`, escenarios y horas en `SUBTLE`, líneas de hora
  en `HIGHLIGHT_MED`, y "Mi Grilla" en `FOAM`. Iris no se usa.
- **Técnica — textos:** los textos de la hoja, los mensajes por código y los pasos de la guía van en
  `src/lib/wallpaper-messages.ts`, igual que `selection-messages.ts`.
- **Técnica — helpers de cliente sin `"use client"`:** `wallpaper-canvas.ts` y
  `wallpaper-delivery.ts`, como `device-store.ts`. Los importa solo `wallpaper-button.tsx`.
- **Técnica — E2E sin conexión:** los helpers de `tests/e2e/offline.spec.ts` (`goOffline`,
  `saveOffline`, `reopenOffline`, `readPendingIds`) pasan a `tests/e2e/offline.ts`, exportados, y
  los usan las dos specs.
- **Técnica — AC-01 y AC-15 en un iPhone real.** En CI, WebKit no tiene hoja de compartir. El E2E
  espía `navigator.share` y mide el tiempo de generación como referencia. Guardar en Fotos y el
  tiempo en un iPhone 12 se verifican a mano y quedan en la verificación (riesgo del PRD).

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 3 (botón "Descargar fondo" con el día en pantalla), Block 4 (E2E) |
| FR-02 | Block 1 (`WALLPAPER_WIDTH`/`WALLPAPER_HEIGHT`), Block 2 (canvas de ese tamaño), Block 4 (E2E lee el PNG) |
| FR-03 | Block 1 (columnas por `position`, eje y marcas por hora, bloques proporcionales con artista y horario), Block 2 (dibujo) |
| FR-04 | Block 1 (`lit` por `selectedIds`), Block 2 (`globalAlpha` de los opacos) |
| FR-05 | Block 1 (sin elegidos en el día → todos `lit`) |
| FR-06 | Block 1 (colores fijos de `palette.ts`), Block 2 |
| FR-07 | Block 1 (`SAFE_TOP`/`SAFE_BOTTOM`; nada por fuera de la banda) |
| FR-08 | Block 1 (título del día y marca "Mi Grilla"), Block 2 |
| FR-09 | Block 3 (`ScheduleScreen` pasa el `draft`), Block 4 (E2E con cambios sin guardar) |
| FR-10 | Block 2 (sin red; fuente con respaldo), Block 3 (el botón también en `/~offline`), Block 4 (E2E sin conexión) |
| FR-11 | Block 1 (`wallpaperFileName`), Block 2 (`shareWallpaper`, `downloadWallpaper`), Block 3 (elige la entrega), Block 4 |
| FR-12 | Block 3 (guía en la hoja al terminar), Block 4 |
| NFR-01 | Strategy: dibujo de una sola pasada sobre ≤ 31 shows, sin red; Block 4 mide desde el toque hasta la vista previa (≤ 3000 ms en `iphone-webkit` como referencia) y el iPhone 12 real se verifica a mano en VERIFY |
| NFR-02 | Block 1 (`ARTIST_FONT_SIZE = 28`; escala con 30 min ≥ 70 px; `MIN_BLOCK_HEIGHT = 70` sin pisar al siguiente) |
| NFR-03 | Block 1 (contraste `BASE` sobre `FOAM` calculado ≥ 4.5; `DIMMED_OPACITY` ≤ 0.35) |
| NFR-04 | Block 4 (el PNG generado pesa ≤ 5 MB) |
| NFR-05 | Block 1 (todos los shows del día con su columna y su horario), Block 4 |

## Dependencies between blocks
Block 2 depende de 1 (dibuja el layout). Block 3 depende de 2 (llama al render y a la entrega).
Block 4 depende de 3. Orden: 1 → 2 → 3 → 4.

## Mobile guides applied (AGENTS.md → Code conventions)
Para el botón "Descargar fondo" y su hoja:
- `mobile-native` fixes 1, 2 y 5: el botón es el `Button` de shadcn con el patrón de
  `src/components/pressable.ts` (`data-pressed` por `pointerdown`, sin `:hover` pegado ni tap
  highlight) y `touch-action: manipulation`. Un `:hover` solo bajo
  `(hover: hover) and (pointer: fine)`.
- `mobile-native` fix 8: `select-none` en los botones (son controles). La `<img>` de la vista previa
  queda sin `-webkit-touch-callout: none` ni `user-select: none`, porque mantenerla apretada para
  "Agregar a Fotos" es el respaldo en iPhone.
- `mobile-native` "Baseline": el botón mide 44 × 44 (`size-11`), igual que los botones que revisa
  `expectTapTargetsAtLeast44` en `tests/e2e/home.spec.ts` a 360 y 430 px.
- `mobile-native` fixes 3, 6 y 7: la hoja es el `DrawerContent` de `src/components/ui/drawer.tsx`
  (alto máximo `80dvh`, `safe-area-inset-bottom`). La vista previa escala con `max-h` y
  `object-contain`. El cuerpo de la hoja hace scroll interno con `overscroll-behavior: contain`,
  para que el scroll no arrastre la hoja ni dispare el pull-to-refresh.
- `gestures`: la hoja sigue al dedo 1:1 y se cierra deslizando hacia abajo, con la curva de Vaul
  (sin animación propia). Los botones y la vista previa llevan `data-vaul-no-drag`, como en
  `AppMenu`. Con `prefers-reduced-motion` aplica lo que ya resuelve Vaul.
- `design-taste-frontend`: un solo sistema. El acento es foam (`--primary`), el ícono es
  `ImageDown` de lucide y el copy es propio en español ("Descargar fondo", "Guardar en Fotos").
  Nada de iris ni de estética de plantilla. Mientras se genera, un estado accesible
  (`aria-live="polite"`, `aria-busy`).

## Block 1 — Layout puro de la imagen

**Files**
- `src/lib/wallpaper-layout.ts` (new) — puro, sin I/O. Constantes `WALLPAPER_WIDTH = 1290`,
  `WALLPAPER_HEIGHT = 2796`, `SAFE_TOP = 699`, `SAFE_BOTTOM = 224`, `HEADER_HEIGHT = 150`,
  `ARTIST_FONT_SIZE = 28`, `TIME_FONT_SIZE = 22`, `MIN_BLOCK_HEIGHT = 70` y `DIMMED_OPACITY = 0.3`.
  Tipo `MeasureText = (text: string, font: string) => number`. Función
  `wallpaperLayout({ day, stages, shows, selectedIds, fontFamily, measureText })`, que devuelve
  `WallpaperLayout`: `title` y `brand` (texto, x, y, font, color), `stageLabels[]`, `hourMarks[]`
  (label `formatClock`, y), y `blocks[]` (`showId`, x, y, width, height, `lit`, `lines[]` del
  artista, `time` o `null`). También `wallpaperFileName(day)`, que devuelve `mi-grilla-viernes.png`,
  `mi-grilla-sabado.png` o `mi-grilla-domingo.png` (nombre del día en minúsculas y sin tildes).
- `src/lib/wallpaper-messages.ts` (new) — textos de la UI: `WALLPAPER_BUTTON_LABEL`
  ("Descargar fondo"), `SAVE_TO_PHOTOS_LABEL`, `DOWNLOAD_IMAGE_LABEL`, `GENERATING_LABEL`, los pasos
  `WALLPAPER_GUIDE_STEPS` (4) y `wallpaperMessageFor(code)` para `CANVAS_UNSUPPORTED`,
  `ENCODE_FAILED` y `SHARE_FAILED`, con un mensaje genérico para cualquier otro código.
- `src/lib/palette.ts` (modified) — suma `TEXT` (#e0def4), `SUBTLE` (#908caa) y `HIGHLIGHT_MED`
  (#403d52). Su comentario de cabecera nombra también el fondo de pantalla.
- `tests/unit/lib/palette.test.ts` (modified) — la sincronía con `globals.css` cubre los tres
  nuevos.
- `tests/unit/lib/wallpaper-layout.test.ts` (new) — arma el `Schedule` real desde
  `data/schedule.json` con `posterTimeToInstant` (como `schedule-fixture.ts`), con un
  `measureText` falso y determinístico (`text.length * size * 0.6`).
- `tests/unit/lib/wallpaper-messages.test.ts` (new).

**Logic**
Implementa FR-02 a FR-08 y NFR-02, NFR-03 y NFR-05 como geometría verificable sin canvas:
- Eje: `dayAxis(shows)` y `hourMarks(axis)`. La escala es `(2572 - 849) / minutos del eje`. Cada
  marca de hora va en `849 + minutos × escala`, dentro de la banda.
- Columnas: canaleta de horas de 96 px desde x = 24, y 5 columnas iguales entre x = 120 y x = 1266,
  en el orden de `stage.position`, con 8 px entre columnas.
- Bloques: `y = 849 + minutos desde el inicio × escala`, y
  `height = max(duración × escala, MIN_BLOCK_HEIGHT)`, con un tope: no puede pasar del inicio del
  siguiente show del mismo escenario menos 4 px (domingo, Kidzapalooza: 18:00–18:20 y 18:30–18:50).
- Texto: el nombre del artista se parte por palabras en líneas que entren en el ancho del bloque
  menos 24 px de padding, medidas con `measureText` y con `600 28px <fontFamily>`. Entran tantas
  líneas como permita el alto. Si sobra texto, la última línea termina en "…". El horario
  (`formatClock` de inicio y fin, "23:30 – 01:00") va debajo si queda lugar. Un show de 30 min
  siempre tiene lugar para una línea y el horario.
- `lit`: si alguno de los shows del día está en `selectedIds`, se encienden solo esos. Si ninguno
  está, se encienden todos (FR-05). Un id de `selectedIds` que no es de este día se ignora (R-01).
- Encabezado: el nombre del día (`700 64px`, `TEXT`) a la izquierda y "Mi Grilla" (`600 32px`,
  `FOAM`) a la derecha, en la primera fila de la banda. Los nombres de escenario (`600 24px`,
  `SUBTLE`), centrados en su columna, en la segunda.

**Data model**
- Reuses `festival_days`, `stages` and `shows` from FEAT-003a (Block 1 de su spec) through the
  `Schedule` types of `src/lib/schedule-types.ts` — no schema change; constraints as declared there:
  `shows.id` text PK, `day_id` y `stage_id` not null con FK restrict, `starts_at`/`ends_at`
  `TIMESTAMPTZ(3)` not null, `stages.position` not null unique.
- Rollback: no hay migración ni datos nuevos. Revertir el ticket es revertir sus commits.

**Input validation**
- `shows`: los del día, al menos uno (`dayAxis` lanza `RangeError` con un día vacío; la pantalla
  nunca lo pide así).
- `selectedIds`: `ReadonlySet<string>` no confiable (puede venir de `localStorage`): solo se consulta
  con `has(show.id)` sobre los shows del día.
- `stages`: los 5, con `position` distinto. Un show cuyo `stageId` no esté en `stages` no se dibuja,
  y el caso se prueba.
- `fontFamily`: string no vacío. Va tal cual dentro del `font` de canvas.

**Error handling**
- Día sin shows — `wallpaperLayout` deja propagar el `RangeError` de `dayAxis`. Es un error de
  programación, y `WallpaperButton` solo se renderiza con un día que tiene shows.
- Show con `stageId` desconocido — se omite del layout, sin lanzar.
- Id elegido inexistente o de otro día — se ignora (R-01).

**Required tests**
- [ ] `test-wallpaper-size` — el layout declara 1290 × 2796 — validates AC-03.
- [ ] `test-wallpaper-friday-complete` — viernes: 5 columnas en el orden Flow, Samsung, Alternative,
      Perry's, Kidzapalooza; los 30 shows del viernes, cada uno en la columna de su escenario y con
      su horario; Peggy Gou con "23:30 – 01:00"; marcas de hora de 13:00 a 01:00 — validates AC-04.
- [ ] `test-wallpaper-lit-selected` — con Tyler, The Creator y Lorde elegidos el viernes, solo esos
      dos quedan `lit` — validates AC-05.
- [ ] `test-wallpaper-none-selected-all-lit` — sin elegidos ese día (y con elegidos de otro día),
      todos los del día quedan `lit` — validates AC-06.
- [ ] `test-wallpaper-colors-contrast` — el contraste WCAG calculado de `BASE` sobre `FOAM` es
      ≥ 4.5 y `DIMMED_OPACITY` ≤ 0.35 — validates AC-07.
- [ ] `test-wallpaper-safe-zones` — para los 3 días, ningún bloque ni marca de hora tiene y < 699 ni
      y + alto > 2572 — validates AC-08.
- [ ] `test-wallpaper-title-brand` — el sábado tiene el título "Sábado" y la marca "Mi Grilla", y
      ningún texto del layout contiene "Lollapalooza" — validates AC-09.
- [ ] `test-wallpaper-legibility` — para los 3 días, el artista usa 28 px, todo show de 30 min mide
      ≥ 70 px y ningún bloque pisa al siguiente de su escenario (domingo, Kidzapalooza) — validates
      AC-14.
- [ ] `test-wallpaper-long-name-ellipsis` — "Desenchufados en Banda" en un bloque de 70 px termina
      en "…" y no sale del bloque.
- [ ] `test-wallpaper-unknown-id-ignored` — un id inexistente en `selectedIds` se ignora (inválido)
      y no enciende nada.
- [ ] `test-wallpaper-unknown-stage-skipped` — un show con `stageId` desconocido queda fuera del
      layout (inválido) sin error.
- [ ] `test-wallpaper-empty-day-error` — un día sin shows lanza `RangeError` (error).
- [ ] `test-wallpaper-file-name` — viernes, sábado y domingo dan `mi-grilla-viernes.png`,
      `mi-grilla-sabado.png` y `mi-grilla-domingo.png` — validates AC-02.
- [ ] `test-wallpaper-messages-unknown-code` — `wallpaperMessageFor` con un código desconocido
      (inválido) devuelve el mensaje genérico, y la guía tiene 4 pasos.
- [ ] `test-palette-sync` — `TEXT`, `SUBTLE` y `HIGHLIGHT_MED` coinciden con `--color-rp-*` de
      `globals.css`.

**Completion criterion**
Los tests de arriba pasan y `src/lib/wallpaper-layout.ts` y `src/lib/wallpaper-messages.ts` no
importan nada con I/O.

## Block 2 — Dibujo y entrega

**Files**
- `src/components/wallpaper-canvas.ts` (new) — sin `"use client"`. Exporta
  `renderWallpaper(input)`, que devuelve
  `Promise<{ ok: true; blob: Blob; fontFallback: boolean } | { ok: false; code: "CANVAS_UNSUPPORTED" | "ENCODE_FAILED" }>`.
  Lee la familia (`getComputedStyle(document.body).fontFamily`), espera
  `document.fonts.load` de los pesos 600 y 700, crea un canvas de 1290 × 2796, arma el layout con
  `ctx.measureText`, lo dibuja y lo codifica con `canvas.toBlob(cb, "image/png")`.
- `src/components/wallpaper-delivery.ts` (new) — sin `"use client"`. Exporta
  `wallpaperFile(blob, name)` (`File` PNG), `canShareFile(file)` (que exige `navigator.canShare`
  con el archivo real y `matchMedia("(pointer: coarse)")`), `shareWallpaper(file)`, que devuelve
  `{ ok: true } | { ok: false; code: "SHARE_CANCELLED" | "SHARE_FAILED" }`, y
  `downloadWallpaper(blob, name)` (crea el object URL, hace click en un `<a download>` y lo revoca
  en el siguiente tick).
- `tests/unit/components/wallpaper-canvas.test.ts` (new) — `HTMLCanvasElement.prototype.getContext`
  y `toBlob` stubbeados (jsdom no tiene canvas), igual que `document.fonts`.
- `tests/unit/components/wallpaper-delivery.test.ts` (new) — `navigator.canShare`,
  `navigator.share` y `matchMedia` stubbeados.

**Logic**
Implementa FR-02 a FR-08 en píxeles, y la parte de FR-10 y FR-11 que depende del navegador. Se
dibuja así: fondo `BASE` en todo el lienzo. Encabezado y escenarios. Líneas de hora de 1 px en
`HIGHLIGHT_MED`, de x = 120 a x = 1266, y su etiqueta en la canaleta. Cada bloque es un rectángulo
redondeado de 12 px de radio en `FOAM`, con `globalAlpha = 1` si está encendido y `DIMMED_OPACITY`
si no. El texto va en `BASE` con la misma alfa. No hay red en ningún paso: funciona igual sin
conexión. `shareWallpaper` distingue `AbortError` (la persona cerró la hoja del sistema →
`SHARE_CANCELLED`) de cualquier otro rechazo (`NotAllowedError`, `TypeError` y otros →
`SHARE_FAILED`). El mensaje del error del navegador nunca sale de esta función (R-04).

**Input validation**
- `renderWallpaper` recibe los mismos datos que `wallpaperLayout` (Block 1) y los pasa tal cual: la
  validación es la de ese bloque.
- `wallpaperFile`/`downloadWallpaper`: `name` es el que da `wallpaperFileName`, nunca texto de la
  persona.

**Error handling**
- `getContext("2d")` devuelve `null` (navegador sin canvas, o WebKit sin memoria para el lienzo) —
  `{ ok: false, code: "CANVAS_UNSUPPORTED" }`.
- `toBlob` llama al callback con `null`, o lanza (`SecurityError`) — `{ ok: false, code:
  "ENCODE_FAILED" }`.
- `document.fonts.load` rechaza, o resuelve sin ninguna fuente — se dibuja con el respaldo de la
  cadena de familia y se devuelve `fontFallback: true`. No es una falla: la imagen sale igual.
- `share()` rechaza con `AbortError` — `SHARE_CANCELLED`. Otro rechazo — `SHARE_FAILED`.

**Required tests**
- [ ] `test-render-wallpaper-png` — con el canvas stubbeado, crea un lienzo de 1290 × 2796, dibuja
      un rectángulo por show y devuelve el Blob `image/png` — validates AC-03.
- [ ] `test-render-wallpaper-dimmed` — los bloques no elegidos se dibujan con `globalAlpha` 0.3 y
      los elegidos con 1 — validates AC-05, AC-07.
- [ ] `test-render-wallpaper-font-family` — `ctx.font` usa la familia computada del `body`, no
      `var(--font-public-sans)`.
- [ ] `test-render-wallpaper-context-unsupported-error` — `getContext` da `null` →
      `CANVAS_UNSUPPORTED` (error).
- [ ] `test-render-wallpaper-encode-failed-error` — `toBlob` con `null` → `ENCODE_FAILED` (error),
      y `toBlob` que lanza → `ENCODE_FAILED` (error).
- [ ] `test-render-wallpaper-font-missing` — `document.fonts.load` rechazado (faltante) → igual
      devuelve `ok: true` con `fontFallback: true`.
- [ ] `test-delivery-can-share` — `canShareFile` es `true` solo con `canShare` del archivo real y
      `pointer: coarse` — validates AC-01.
- [ ] `test-delivery-download-name` — `downloadWallpaper` hace click en un `<a>` con
      `download="mi-grilla-viernes.png"` y revoca el object URL — validates AC-02.
- [ ] `test-delivery-share-cancelled` — `share` rechazado con `AbortError` → `SHARE_CANCELLED`
      (cancelado, rechazado).
- [ ] `test-delivery-share-failed-error` — `share` rechazado con `NotAllowedError` o `TypeError` →
      `SHARE_FAILED` (error).

**Completion criterion**
Los tests de arriba pasan, `pnpm test` mantiene los pisos 80/70/80 con los dos archivos nuevos
dentro de la cobertura, y ninguno de los dos importa `@/server/*` ni `@prisma/*`.

## Block 3 — La hoja del fondo en la pantalla de la grilla

**Files**
- `src/components/wallpaper-button.tsx` (new) — `"use client"`. `WallpaperButton({ day, stages,
  shows, selectedIds })`: un `DrawerTrigger` con el `Button` de shadcn (ícono `ImageDown`,
  `aria-label="Descargar fondo"`, 44 × 44). La hoja (`Drawer`, `DrawerContent` con
  `aria-describedby={undefined}`, `DrawerTitle` "Fondo de pantalla") tiene los estados `generating`,
  `ready`, `done` y `failed`.
- `src/components/day-picker.tsx` (modified) — prop opcional `action?: ReactNode`, en la misma fila
  que la `TabsList` (`flex gap-2`, la lista con `flex-1`). Sin `action`, la fila queda igual que hoy.
- `src/components/schedule-screen.tsx` (modified) — pasa
  `action={<WallpaperButton day={day} stages={schedule.stages} shows={dayShows} selectedIds={draft} />}`
  a `DayPicker` cuando hay `day`.
- `src/lib/selection-messages.ts` (modified) — solo el comentario de la línea 47 ("until it exists,
  the notice only suggests it"), que deja de ser cierto. `OFFLINE_PENDING_BODY` no cambia.
- `tests/unit/components/wallpaper-button.test.tsx` (new) — usa `stubMatchMedia` de
  `tests/unit/components/vaul-env.ts` y mockea `wallpaper-canvas` y `wallpaper-delivery` con
  `vi.mock`.
- `tests/unit/components/day-picker.test.tsx` (modified) — la `action` se renderiza en la fila de
  los días.
- `tests/unit/components/schedule-screen.test.tsx` (modified) — el botón recibe el `draft`.

**Logic**
Implementa FR-01, FR-09, FR-11 y FR-12, y la parte de FR-10 que depende de la pantalla.
- Al abrir la hoja, el componente guarda una copia de `day`, `shows` y `selectedIds` (la hoja es
  modal, así que no cambian mientras está abierta) y llama a `renderWallpaper`. Una generación a la
  vez: si llega un resultado de una generación ya cerrada (token en un `ref`), se descarta (R-03).
  Mientras dura, la hoja muestra `GENERATING_LABEL` con `aria-live="polite"` y la acción
  deshabilitada.
- `ready`: vista previa `<img>` con el object URL del Blob (`alt` "Vista previa del fondo del
  <día>") y un único botón principal. Si `canShareFile(file)` da `true`, el botón es "Guardar en
  Fotos". Si no, "Descargar imagen".
- "Guardar en Fotos": con `{ ok: true }` pasa a `done`. Con `SHARE_CANCELLED` se queda en `ready`,
  sin alerta. Con `SHARE_FAILED` muestra el mensaje con `role="alert"` y cambia el botón a
  "Descargar imagen". La vista previa sigue disponible para mantenerla apretada.
- "Descargar imagen": `downloadWallpaper(blob, wallpaperFileName(day))` y pasa a `done`.
- `done`: la guía (`<ol>` con `WALLPAPER_GUIDE_STEPS`, como `install-guide.tsx`) y la vista previa.
  Vaul desmonta el contenido con la hoja cerrada, así que la lista no existe con la hoja cerrada
  (el conteo de `listitem` de `tests/e2e/home.spec.ts` no cambia).
- `failed`: el mensaje de `wallpaperMessageFor(code)` con `role="alert"` y un botón "Reintentar"
  que vuelve a generar.
- Al cerrar la hoja o desmontar: `URL.revokeObjectURL` de la vista previa y vuelta al estado
  inicial (R-03).
- El botón no mira `useOnlineStatus`: anda igual sin conexión (FR-10).

**Input validation**
- Entradas de la persona: solo toques (abrir, guardar, descargar, reintentar, cerrar). No hay texto.
- Props: las de `ScheduleScreen`. `selectedIds` es el `draft`, que puede venir de la pendiente de
  `localStorage` y se trata como no confiable en Block 1 (R-01).

**Error handling**
- `renderWallpaper` da `CANVAS_UNSUPPORTED` o `ENCODE_FAILED` — estado `failed` con su mensaje y
  "Reintentar". Nunca se muestra el `message` del navegador (R-04).
- `shareWallpaper` da `SHARE_FAILED` — alerta y se cambia a "Descargar imagen".
- `shareWallpaper` da `SHARE_CANCELLED` — sin alerta ni guía. Se queda en `ready`.
- Se cierra la hoja mientras se genera — el resultado tardío se descarta y su Blob no se muestra.

**Required tests**
- [ ] `test-wallpaper-button-share-flow` — con `canShareFile` en `true`: tocar "Descargar fondo"
      muestra "Generando…", después la vista previa y "Guardar en Fotos"; tocarlo llama a
      `shareWallpaper` con `mi-grilla-viernes.png` y muestra los 4 pasos de la guía — validates
      AC-01, AC-13.
- [ ] `test-wallpaper-button-download-flow` — con `canShareFile` en `false`: "Descargar imagen"
      llama a `downloadWallpaper` con `mi-grilla-viernes.png` y muestra la guía — validates AC-02,
      AC-13.
- [ ] `test-wallpaper-button-share-cancelled` — `SHARE_CANCELLED` (share rechazado por la persona,
      que cerró la hoja): sin alerta y sin guía, sigue "Guardar en Fotos".
- [ ] `test-wallpaper-button-share-failed-error` — `SHARE_FAILED` (error): alerta y botón
      "Descargar imagen".
- [ ] `test-wallpaper-button-render-failed-error` — `ENCODE_FAILED` (error): alerta con el mensaje
      del catálogo y "Reintentar" vuelve a generar.
- [ ] `test-wallpaper-button-stale-result-rejected` — cerrar la hoja antes de que termine la
      generación descarta el resultado (rechazado) y revoca el object URL.
- [ ] `test-wallpaper-button-offline` — con `navigator.onLine` en `false`, el botón está habilitado
      y genera igual — validates AC-12.
- [ ] `test-day-picker-action` — `DayPicker` con `action` la muestra en la fila de los días, y sin
      `action` la fila no cambia.
- [ ] `test-schedule-screen-wallpaper-unsaved` — marcar un show sin "Guardar" y abrir el fondo pasa
      ese id en `selectedIds` — validates AC-10.
- [ ] `test-schedule-screen-wallpaper-pending` — con una selección pendiente de ese usuario en
      `localStorage`, el fondo recibe esa selección — validates AC-11.

**Completion criterion**
Los tests de arriba pasan, `ScheduleScreen` en `/` y en `/~offline` muestra el botón, y
`app-menu.tsx`, `src/app/page.tsx` y `offline-app.tsx` no cambian.

## Block 4 — E2E del fondo

**Files**
- `tests/e2e/offline.ts` (new) — `goOffline`, `saveOffline`, `reopenOffline` y `readPendingIds`,
  exportados (antes eran internos de `offline.spec.ts`).
- `tests/e2e/offline.spec.ts` (modified) — importa esos helpers de `./offline`, sin cambiar sus
  casos.
- `tests/e2e/wallpaper.spec.ts` (new) — corre en `iphone-webkit`, `mobile-chromium` y `mobile-360`
  (`playwright.config.ts` no lo excluye, y `desktop` solo corre `demo.spec.ts`). Con
  `page.addInitScript` fija `navigator.canShare`/`navigator.share`: los espía en el camino de
  compartir y los quita en el de descarga, para que la entrega no dependa del navegador de
  emulación. Usa `signUp` de `tests/e2e/auth.ts`, los helpers de `tests/e2e/grid.ts` y
  `waitForServiceWorker` de `tests/e2e/pwa.ts`.

**Logic**
Prueba de punta a punta, contra el build de producción con el service worker, que la imagen sale del
tamaño correcto, con lo que se ve en pantalla, con y sin conexión, por las dos entregas. El PNG se
lee en el navegador (`createImageBitmap` sobre el `File` espiado, o sobre el archivo descargado) para
medir ancho, alto y peso.

**Input validation**
- Sin entradas nuevas: solo la UI del Block 3.

**Error handling**
- `share` espiado que rechaza con `NotAllowedError` — la hoja ofrece "Descargar imagen" y la
  descarga funciona.

**Required tests**
- [ ] `test-e2e-wallpaper-share` — viernes, con Tyler, The Creator y Lorde guardados: "Descargar
      fondo", "Guardar en Fotos"; `share` recibe un PNG de 1290 × 2796, de ≤ 5 MB, llamado
      `mi-grilla-viernes.png`, y se ve la guía — validates AC-01, AC-03, AC-13, NFR-04.
- [ ] `test-e2e-wallpaper-download` — sin `canShare`: "Descargar imagen" dispara una descarga
      llamada `mi-grilla-sabado.png` estando en el sábado — validates AC-02, AC-09.
- [ ] `test-e2e-wallpaper-unsaved` — marcar un show sin "Guardar" y descargar: la vista previa se
      genera con el `draft` (el cambio pendiente sigue en la barra) — validates AC-10.
- [ ] `test-e2e-wallpaper-offline-pending` — sin conexión, guardar un show (queda pendiente, con el
      aviso), recargar `/` sin conexión y descargar el fondo: se genera y se descarga — validates
      AC-11, AC-12.
- [ ] `test-e2e-wallpaper-share-rejected-error` — `share` rechazado con `NotAllowedError` (error):
      alerta y la descarga funciona.
- [ ] `test-e2e-wallpaper-time` — desde el toque hasta la vista previa pasan ≤ 3000 ms en
      `iphone-webkit` (referencia de AC-15; el iPhone 12 real se mide a mano en VERIFY) — validates
      AC-15.
- [ ] `test-e2e-wallpaper-tap-target` — en 360 y 430 px el botón mide ≥ 44 × 44 y no hay scroll
      horizontal en la fila de los días.

**Completion criterion**
`pnpm test:e2e` (o `pnpm test:e2e:docker` en hosts sin las bibliotecas de WebKit) pasa en los tres
proyectos mobile, y `offline.spec.ts`, `home.spec.ts` y `pwa.spec.ts` siguen verdes.

## Final verification
`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (con los pisos 80/70/80),
`pnpm test:integration` y `pnpm test:e2e` pasan. Los 15 AC tienen al menos un test. A mano, en un
iPhone 12 o más nuevo con la app instalada: "Descargar fondo", "Guardar en Fotos" y la imagen queda
en Fotos (AC-01). La imagen está lista en ≤ 3 s (AC-15). Puesta como fondo de bloqueo siguiendo la
guía, la hora y los botones de abajo no tapan ningún show. Y en modo avión se genera igual.
