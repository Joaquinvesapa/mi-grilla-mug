# Spec FEAT-007: Fondo de pantalla del grupo

| Field | Value |
|-------|-------|
| Ticket | FEAT-007 |
| PRD | docs/daw/prd/prd-FEAT-007.md |
| Tier | FEATURE |
| Date | 2026-11-18 |
| Spec loops | 1 |
| Loops since last human decision | 1 |

## Summary
El fondo del grupo es el fondo personal de FEAT-004 con las iniciales de los amigos encima. Se
dibuja en el navegador con Canvas 2D, como el personal (ADR-005), con los grupos que la grilla ya
recibe desde FEAT-006c (ADR-008): `listGroupPicks` con conexión y la copia del dispositivo sin ella.
Por eso funciona sin conexión sin trabajo extra. La regla de dibujo (iniciales, encabezado con el
grupo, nombre de archivo) se agrega a la función pura `wallpaperLayout`, el canvas pinta las
píldoras y la hoja de "Descargar fondo" suma la pregunta "Grilla sola / Con amigos" y el selector
de grupo. No hay cambios de base, server ni dependencias, ni migraciones. Son 4 bloques: layout
puro, dibujo, la hoja y E2E. Incorpora R-01 a R-06 de `docs/daw/security/threat-FEAT-007.md`, los
7 gaps del Impact Check y los 11 hallazgos de la auditoría de arquitectura de PLAN (vuelta 1).

### Decisiones aplicadas
- **Del usuario (2026-11-18, DEFINE):** los 20 AC en un solo ticket (W-PRD-06).
- **Del usuario (2026-11-18, PLAN):** en un bloque sin lugar para la fila de iniciales debajo del
  horario (los 2 shows de 20 min del domingo en Kidzapalooza, ≈ 60 px), el artista se acorta a una
  línea y las iniciales van a su derecha; el horario se mantiene (`decisions-FEAT-007.md`).
- **Técnica — sin ADR nuevo.** No hay elección entre enfoques: es la misma técnica de ADR-005 con
  los datos de ADR-008. Ninguna estructura de datos persistida cambia.
- **Técnica — dónde caben las iniciales.** La escala del eje es ≈ 2,16 px/min (1555 px útiles para
  720 min). Un show de 45 min (el más corto, salvo los 2 de 20 min) mide 97,2 px, y 93,2 px con
  otro show pegado después (`NEXT_SHOW_GAP` = 4). La fila de píldoras va debajo del horario cuando
  la caja mide al menos `2·4 + 30 + 22 + 2 + 24 = 86` px (padding, una línea de artista, horario,
  aire y fila). Con amigos en el bloque, el artista pierde líneas antes que el horario o las
  iniciales.
- **Técnica — las píldoras nunca se salen ni tapan al artista (auditoría, hallazgos 1 y 2).** La
  columna tiene 198,8 px útiles. En la fila, las píldoras ocupan a lo sumo ese ancho. En la línea
  del artista (bloques < 86 px, decisión del usuario), a lo sumo la mitad (99,4 px), y la otra
  mitad queda para el artista, que siempre muestra al menos el comienzo de su nombre con "…". Si
  las píldoras de `indicatorParts` no entran en el ancho disponible, se sacan iniciales desde la
  derecha y se suman a la píldora "+N", que siempre queda; nunca se dibuja una píldora cortada. Así
  el total de amigos que dice el bloque (iniciales + N) sigue siendo exacto (NFR-05).
- **Técnica — un dispositivo sin los grupos del server (`groups === null`).** Si la página no pudo
  cargar los grupos, la grilla no muestra selector ni iniciales (FEAT-006c) y la hoja hace lo
  mismo: genera el fondo personal sin pregunta. Es una degradación aceptada y coherente con la
  grilla. Sin conexión, en cambio, `/~offline` pasa los grupos de la copia (`offline-app.tsx:92`) y
  la hoja ofrece el fondo del grupo (FR-12) (auditoría, hallazgo 7).
- **Técnica — píldoras siempre a opacidad plena.** El bloque opaco se pinta a
  `DIMMED_OPACITY = 0.3`, pero sus píldoras se pintan después a alpha 1, con relleno `BASE` y
  texto `TEXT`: el contraste se mide contra la píldora y no depende de si el show está encendido
  (NFR-03).
- **Técnica — "+N" con `extraFriendsLabel`** de `src/lib/group-messages.ts`, y los 3 primeros con
  `indicatorParts` de `src/lib/group-picks.ts`, los mismos que usa la grilla (gap 4).
- **Técnica — el selector de la hoja es `GroupPicker`.** Suma dos props opcionales, `withNoGroup`
  (por defecto `true`) y `label` (por defecto `GROUP_PICKER_LABEL`). En la hoja va sin "Sin grupo"
  y con la etiqueta "Grupo del fondo", para no repetir el nombre accesible del selector de la
  grilla (gap 5).
- **Técnica — el grupo por defecto de la hoja.** `ScheduleScreen` ya resuelve el grupo del selector
  con `resolveGroupChoice` (la elección guardada, o el último al que se unió). La hoja usa ese id, y
  si el selector está en "Sin grupo" (`null`), `groups[0]`: `listGroupPicks` ordena por el
  `joined_at` del usuario descendente (`src/server/groups.ts:343`). Lo hace
  `wallpaperGroupDefault(groups, shownGroupId)` en `group-picks.ts`, en función del valor que
  `resolveGroupChoice` ya calculó y sin repetir su lógica (gap 6).
- **Técnica — la copia que se dibuja se toma al abrir la hoja**, como en FEAT-004: el `draft`, los
  shows del día y ahora también los grupos y el grupo del selector. Un reintento o un cambio de
  grupo dibujan esa misma copia (FR-11).
- **Técnica — helpers E2E compartidos.** Los helpers de `tests/e2e/wallpaper.spec.ts` pasan a
  `tests/e2e/wallpaper.ts`, exportados, y los usan las dos specs (gap 1). Los amigos y sus
  selecciones se siembran con `insertGroup`, `insertFriends`, `insertSelection` y `userIdByEmail`
  de `tests/e2e/db.ts`, como en `group-grid.spec.ts` (gap 2).

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 3 (pregunta "Grilla sola / Con amigos"), Block 4 (E2E) |
| FR-02 | Block 1 (`wallpaperGroupDefault`), Block 3 (selector sin "Sin grupo", un solo grupo sin preguntar), Block 4 |
| FR-03 | Block 3 (sin grupos genera el personal al abrir), Block 4 |
| FR-04 | Block 1 (sin `group` el layout es el de FEAT-004), Block 3 |
| FR-05 | Block 1 (mismas constantes y zonas libres), Block 2 |
| FR-06 | Block 1 (píldoras en los shows elegidos), Block 2 |
| FR-07 | Block 1 (píldoras en shows opacos, `lit` sin cambios), Block 2 |
| FR-08 | Block 1 (`indicatorParts` y `extraFriendsLabel`; `friends` excluye al usuario) |
| FR-09 | Block 1 (día sin elegidos: todos encendidos y con iniciales) |
| FR-10 | Block 1 (nombre del grupo en el encabezado, "Mi Grilla", sin marcas ajenas) |
| FR-11 | Block 3 (el `draft` del usuario y los `showIds` guardados de los amigos, copiados al abrir) |
| FR-12 | Block 3 (los grupos de la copia del dispositivo), Block 4 (E2E sin conexión) |
| FR-13 | Block 1 (`wallpaperFileName(day, groupName)`), Block 3 (misma entrega), Block 4 |
| FR-14 | Block 3 (misma guía), Block 4 |
| NFR-01 | Strategy: el mismo canvas único de FEAT-004 con a lo sumo 31 bloques × 4 píldoras; el E2E siembra 19 amigos con selección en todos los shows del viernes y exige la vista previa en ≤ `PREVIEW_BUDGET_MS` (3000 ms, el de `wallpaper.spec.ts`) en `iphone-webkit`; la medición en un iPhone 12 queda para VERIFY, como AC-15 de FEAT-004 |
| NFR-02 | Block 1 (`INITIALS_FONT_SIZE = 20`, artista 28 px, show de 30 min ≥ 70 px) |
| NFR-03 | Block 1 (contraste `TEXT` sobre `BASE` calculado ≥ 4.5), Block 2 (píldoras a alpha 1) |
| NFR-04 | Block 4 (el PNG descargado pesa ≤ 5 MB) |
| NFR-05 | Block 1 (para los 3 días, las iniciales de cada bloque coinciden con `picksByShow`) |

| AC | Test |
|---|---|
| AC-01 | `test-wallpaper-sheet-asks-choice`, `test-e2e-wallpaper-group-asks` |
| AC-02 | `test-wallpaper-sheet-default-from-picker` |
| AC-03 | `test-wallpaper-sheet-single-group-no-picker`, `test-e2e-wallpaper-group-download` |
| AC-04 | `test-group-picks-wallpaper-default` , `test-wallpaper-sheet-no-group-uses-latest` |
| AC-05 | `test-wallpaper-sheet-no-groups-direct`, `test-e2e-wallpaper-group-no-groups` |
| AC-06 | `test-wallpaper-group-personal-unchanged`, `test-wallpaper-sheet-personal-option` |
| AC-07 | `test-wallpaper-group-safe-zones` |
| AC-08 | `test-wallpaper-group-badges-lit` |
| AC-09 | `test-wallpaper-group-badges-dimmed` |
| AC-10 | `test-wallpaper-group-no-friends-no-badges` |
| AC-11 | `test-wallpaper-group-extra-badge` |
| AC-12 | `test-wallpaper-group-none-selected` |
| AC-13 | `test-wallpaper-group-header` |
| AC-14 | `test-wallpaper-sheet-draft-and-saved-picks` |
| AC-15 | `test-e2e-wallpaper-group-offline` |
| AC-16 | `test-wallpaper-group-file-name`, `test-e2e-wallpaper-group-download` |
| AC-17 | `test-wallpaper-sheet-group-share`; guardar en Fotos en un iPhone real, a mano en VERIFY |
| AC-18 | `test-e2e-wallpaper-group-download` (guía) |
| AC-19 | `test-e2e-wallpaper-group-budget`; iPhone 12 a mano en VERIFY |
| AC-20 | `test-wallpaper-group-legibility` |

## Dependencies between blocks
Block 2 depende de 1 (pinta las píldoras del layout). Block 3 depende de 1 y 2 (arma la entrada del
layout y llama al render). Block 4 depende de 3. Orden: 1 → 2 → 3 → 4.

## Mobile guides applied (AGENTS.md → Code conventions)
Para la pregunta y el selector dentro de la hoja de "Descargar fondo":
- `mobile-native` fixes 1, 2 y 5: "Grilla sola" y "Con amigos" son `Button` de shadcn con
  `touch-manipulation` y `select-none`, sin `:hover` pegado ni tap highlight, de 44 px de alto
  (`size="lg"`).
- `mobile-native` "Baseline" y fix de inputs: el selector es el `NativeSelect` de `GroupPicker`, de
  16 px (sin zoom al tocarlo en iOS) y 44 px de alto, con la rueda nativa del sistema.
- `mobile-native` fixes 3, 6 y 7: todo sigue dentro del cuerpo con scroll interno de la hoja
  (`overscroll-contain`), sin cambiar su alto máximo ni sus safe areas.
- `gestures`: la hoja sigue siendo la de Vaul de FEAT-004, que sigue al dedo y se cierra deslizando.
  Los botones y el selector van dentro del contenedor `data-vaul-no-drag`.
- `design-taste-frontend`: un solo sistema. Las dos opciones son botones del mismo ancho, "Con
  amigos" como primario (foam) y "Grilla sola" como `outline`. El copy es propio en español. Las
  píldoras de la imagen usan `BASE` y `TEXT` de Rosé Pine, sin iris.

## Block 1 — Layout del fondo con el grupo

**Files**
- `src/lib/wallpaper-layout.ts` (modified) — `WallpaperInput` suma
  `group?: WallpaperGroup`, con `WallpaperGroup = { name: string; friendsByShow:
  ReadonlyMap<string, readonly FriendPicks[]> }`. `WallpaperLayout` suma `groupLabel:
  WallpaperText | null`. Cada `WallpaperBlock` suma `badges: WallpaperBadge[]`, con
  `WallpaperBadge = { x, y, width, height, radius, fill, label: WallpaperText }`: `x, y, width,
  height` son la caja de la píldora y `label` es su texto con su propia posición top-left, ya
  centrada por el layout, para que el canvas siga sin medir nada (auditoría, hallazgo 3).
  Constantes nuevas:
  `INITIALS_FONT_SIZE = 20`, `BADGE_HEIGHT = 24`, `BADGE_PADDING_X = 6`, `BADGE_GAP = 4`,
  `BADGE_ROW_GAP = 2`, `GROUP_LABEL_FONT_SIZE = 32`. `wallpaperFileName(day, groupName?)` suma el
  nombre del grupo.
- `src/lib/group-picks.ts` (modified) — `wallpaperGroupDefault(groups, shownGroupId)`.
- `tests/unit/lib/wallpaper-layout.test.ts` (modified) — tests del grupo; `allTexts` incluye
  `groupLabel` y el texto de las píldoras (gap del impact scan).
- `tests/unit/lib/group-picks.test.ts` (modified).

**Logic**
Implementa FR-04 a FR-10, FR-13 y NFR-02, NFR-03 y NFR-05 como geometría verificable sin canvas:
- Sin `group`, el layout es exactamente el de FEAT-004: `groupLabel` es `null` y todos los
  `badges` están vacíos (FR-04).
- Encabezado (FR-10): con `group`, `groupLabel` es el nombre del grupo en `600 32px`, `SUBTLE`, en
  la fila del título, empezando 24 px después del nombre del día y acortado con "…" (la `ellipsize`
  existente) para terminar 24 px antes de "Mi Grilla". El título y la marca no cambian.
- Píldoras (FR-06 a FR-08): para cada bloque del día, `friends = group.friendsByShow.get(show.id)`
  (un id que no es del día no se consulta nunca, R-01). Si hay amigos, `indicatorParts(friends)` da
  hasta 3 iniciales y `extra`; si `extra > 0` se suma una píldora `extraFriendsLabel(extra)`. Cada
  píldora mide `BADGE_HEIGHT` de alto y su texto medido con `600 20px` más 2 × `BADGE_PADDING_X` de
  ancho, con `radius = BADGE_HEIGHT / 2`, `fill = BASE` y `label.color = TEXT`. Solo se usa
  `initials` de cada amigo, nunca su `name` (R-03).
- Ajuste al ancho (hallazgos 1 y 2): `fitBadges(friends, maxWidth)` arma las píldoras con
  `BADGE_GAP` entre ellas y, mientras no entren en `maxWidth`, saca la última inicial y la suma a
  la píldora "+N" (que aparece si no estaba). La píldora "+N" siempre entra (≤ 4 dígitos con 20 px
  miden menos de 99 px).
- Dónde van (decisión del usuario): si la caja mide al menos 86 px
  (`2·BLOCK_PADDING_Y + ARTIST_LINE_HEIGHT + TIME_LINE_HEIGHT + BADGE_ROW_GAP + BADGE_HEIGHT`), las
  píldoras van en una fila debajo del horario, alineadas a la izquierda, con `maxWidth` = el ancho
  útil del bloque (198,8 px), y el artista usa las líneas que sobran (al menos una). Si mide menos,
  `maxWidth` es la mitad del ancho útil, el artista queda en una sola línea acortada al resto menos
  un `BADGE_GAP` (siempre con al menos su comienzo y "…"), y las píldoras van a su derecha,
  centradas verticalmente en esa línea; el horario se mantiene.
- `lit` no cambia: un show elegido solo por amigos sigue opaco (FR-07) y, sin elegidos en el día,
  todos están encendidos y llevan sus píldoras igual (FR-09).
- `wallpaperFileName(day, groupName)` (FR-13, R-06): el día y el grupo pasan por la misma
  normalización (NFD, sin marcas, minúsculas, `[^a-z0-9]+` → `-`, sin guiones en los bordes) y se
  unen con `-`: `mi-grilla-viernes-los-del-lolla.png`. Un segmento que queda vacío se omite: un
  grupo vacío da `mi-grilla-viernes.png`, un día vacío con grupo da `mi-grilla-los-del-lolla.png`,
  y los dos vacíos dan `mi-grilla.png` (hallazgo 10).
- `wallpaperGroupDefault(groups, shownGroupId)` (FR-02): `shownGroupId` si es el id de uno de
  `groups`; si no (incluido `null`, "Sin grupo"), `groups[0]?.id`; `undefined` sin grupos.

**Data model**
- Reuses `GroupPicks` and `FriendPicks` from FEAT-006c (`src/lib/group-picks.ts`) and the
  `Schedule` types from FEAT-003a — no schema change; constraints as declared there: `FriendPicks`
  carries `name`, `initials` (≤ 4 graphemes) and unique `showIds` of known shows; at most 19
  friends per group and `MAX_GROUPS_PER_USER` groups; `shows.id` text PK.
- Rollback: no hay migración ni datos nuevos. Revertir el ticket es revertir sus commits.

**Input validation**
- `group.name`: string de 1 a 40 code points, validado por `listGroupPicks` o por `groupPicksOf`;
  se dibuja con `fillText` y se acorta con "…" si no entra.
- `group.friendsByShow`: solo se consulta con `get(show.id)` de los shows del día.
- `FriendPicks.initials`: ≤ 4 grafemas (`isInitials` de `group-picks.ts`); se mide y se dibuja tal
  cual.
- `groupName` de `wallpaperFileName`: texto libre; solo sobreviven `[a-z0-9-]`.

**Error handling**
- Id de show desconocido en las selecciones de un amigo — no se consulta; no dibuja nada (R-01).
- Nombre de grupo que no entra en el encabezado — se acorta con "…", sin pisar "Mi Grilla".
- Nombre de grupo que no deja nada en el nombre de archivo — `mi-grilla-<día>.png` (R-06).
- Grupo sin amigos o amigos sin selecciones — ningún bloque lleva píldoras, sin lanzar.

**Required tests**
- [ ] `test-wallpaper-group-personal-unchanged` — sin `group`, el layout es igual al de FEAT-004
      (sin `groupLabel` ni píldoras) — validates AC-06.
- [ ] `test-wallpaper-group-safe-zones` — con grupo, para los 3 días, 1290 × 2796 y ningún bloque,
      marca de hora ni píldora en y < 699 ni pasa de 2796 − 392 — validates AC-07.
- [ ] `test-wallpaper-group-badges-lit` — el usuario eligió Tyler, The Creator y Ana y Bruno
      también: el bloque está `lit` y tiene las píldoras de Ana y de Bruno — validates AC-08.
- [ ] `test-wallpaper-group-badges-dimmed` — el usuario no eligió Peggy Gou y Ana sí: el bloque no
      está `lit` y tiene la píldora de Ana — validates AC-09.
- [ ] `test-wallpaper-group-no-friends-no-badges` — un show que nadie eligió queda opaco y sin
      píldoras — validates AC-10.
- [ ] `test-wallpaper-group-extra-badge` — 5 amigos en el mismo show: 3 iniciales y "+2", y ninguna
      píldora con las iniciales del usuario — validates AC-11.
- [ ] `test-wallpaper-group-none-selected` — sábado sin elegidos del usuario y Ana con Chappell
      Roan: todos `lit` y la píldora de Ana en Chappell Roan — validates AC-12.
- [ ] `test-wallpaper-group-header` — viernes para "Los del Lolla": los textos incluyen "Viernes",
      "Los del Lolla" y "Mi Grilla", ninguno contiene "Lollapalooza", y el nombre del grupo termina
      antes de la marca — validates AC-13.
- [ ] `test-wallpaper-group-file-name` — viernes y "Los del Lolla" dan
      `mi-grilla-viernes-los-del-lolla.png`, y "Ñandú & Cía" da `mi-grilla-viernes-nandu-cia.png` —
      validates AC-16.
- [ ] `test-wallpaper-group-legibility` — para los 3 días con amigos en todos los shows: las
      iniciales usan 20 px, el artista 28 px, todo show de 30 min mide ≥ 70 px, ninguna píldora sale
      de su bloque, y las constantes de color de la píldora (`TEXT` sobre `BASE`) dan un contraste
      WCAG ≥ 4.5; que se dibujen así lo valida `test-wallpaper-canvas-badges-full-alpha` — validates
      AC-20.
- [ ] `test-wallpaper-group-short-block-inline` — domingo, Kidzapalooza 18:00 con un amigo: el
      horario se mantiene, el artista queda en una línea y la píldora va a su derecha, dentro del
      bloque.
- [ ] `test-wallpaper-group-short-block-crowded` — los 2 bloques de 20 min con 19 amigos: el
      artista tiene texto no vacío, las píldoras ocupan como mucho la mitad del ancho útil, y
      iniciales + N suman 19 (hallazgo 1).
- [ ] `test-wallpaper-group-wide-initials-folded` — iniciales de 4 grafemas anchos que no entran en
      la fila: las que no caben pasan al "+N", ninguna píldora sale del bloque y el total sigue
      siendo exacto (hallazgo 2).
- [ ] `test-wallpaper-group-row-threshold` — una caja de 86 px lleva la fila debajo del horario y
      una de 85 px lleva las píldoras en la línea del artista (hallazgo 4).
- [ ] `test-wallpaper-group-matches-picks` — para los 3 días, las iniciales de cada bloque son
      exactamente las de `picksByShow(group)` para ese show (NFR-05).
- [ ] `test-wallpaper-group-no-full-names` — ningún texto del layout contiene el `name` completo de
      un amigo (R-03).
- [ ] `test-wallpaper-group-unknown-show-ignored` — un id de show inválido en las selecciones de un
      amigo no dibuja ninguna píldora (R-01).
- [ ] `test-wallpaper-group-long-name-ellipsis` — un nombre de grupo inválido por largo para el
      encabezado (40 caracteres anchos) se acorta con "…" y su texto no termina más allá de
      `brand.x - 24`.
- [ ] `test-wallpaper-group-friends-missing-picks` — un grupo con amigos faltantes de selección
      (`showIds` vacíos) o sin amigos no pone píldoras en ningún bloque y no lanza.
- [ ] `test-wallpaper-group-file-name-empty-slug` — un nombre de grupo inválido para archivo ("🎉🎉")
      da `mi-grilla-viernes.png`, y un día inválido para archivo con "Los del Lolla" da
      `mi-grilla-los-del-lolla.png` (R-06).
- [ ] `test-group-picks-wallpaper-default` — el grupo del selector si es uno de `groups`; con `null`
      o un id inválido, `groups[0]`; sin grupos, `undefined` — validates AC-04.

**Completion criterion**
Los tests de arriba y los de FEAT-004 de `wallpaper-layout.test.ts` pasan sin cambios en sus
aserciones, y `wallpaper-layout.ts` y `group-picks.ts` siguen sin importar nada con I/O.

## Block 2 — Dibujo de las píldoras

**Files**
- `src/components/wallpaper-canvas.ts` (modified) — `draw` pinta las píldoras de cada bloque;
  `roundedRect` recibe el radio como parámetro (los bloques siguen con `BLOCK_RADIUS = 12`, las
  píldoras usan `badge.radius`); `RenderWallpaperInput` hereda `group` de `WallpaperInput`.
- `tests/unit/components/wallpaper-canvas.test.ts` (modified) — con grupo, los bloques se cuentan
  filtrando por `fillStyle === FOAM`, porque las píldoras también usan `roundRect` a alpha 1 (gap 7).

**Logic**
Implementa la parte de dibujo de FR-05 a FR-08 y NFR-03: después de pintar cada bloque y su texto
con su alpha, `draw` pone `globalAlpha = 1` y pinta cada píldora: un rectángulo redondeado con
`badge.radius` y `badge.fill`, y su `label` con `drawText`, en la posición top-left que calculó el
layout (el canvas no mide ni centra nada). Después pinta el
`groupLabel` si existe, como el resto de los textos. Sin grupo no se pinta nada nuevo: la imagen es
la de FEAT-004 (FR-04).

**Data model**
- Reuses `WallpaperLayout` from Block 1 — no schema change; constraints as declared there: `showId`
  unique per block and not null, badges inside their block, `groupLabel` default `null` without a
  group.

**Error handling**
- Sin condiciones de error propias: el canvas, la codificación y sus códigos
  (`CANVAS_UNSUPPORTED`, `ENCODE_FAILED`) son los de FEAT-004 y no cambian.

**Required tests**
- [ ] `test-wallpaper-canvas-badges-full-alpha` — con un grupo, cada píldora se pinta con
      `globalAlpha` 1, relleno `BASE` y texto `TEXT`, también en un bloque opaco — validates AC-09.
- [ ] `test-wallpaper-canvas-group-label` — el nombre del grupo se dibuja con `fillText` y nunca
      como HTML (R-02).
- [ ] `test-wallpaper-canvas-no-group-unchanged` — sin grupo, las operaciones de dibujo son las de
      FEAT-004 (mismos bloques, ninguna píldora) — validates AC-06.

**Completion criterion**
Los tests de arriba y los de FEAT-004 de `wallpaper-canvas.test.ts` pasan.

## Block 3 — La pregunta y el grupo en la hoja del fondo

**Files**
- `src/components/wallpaper-button.tsx` (modified) — props nuevas `groups: readonly GroupPicks[] |
  null` y `groupId: string | null | undefined` (el grupo del selector de la grilla); la pregunta,
  el selector de grupo y el grupo en el snapshot, el render y el nombre de archivo.
- `src/components/schedule-screen.tsx` (modified) — pasa `groups` y `shownGroupId` al botón (su
  único render, `schedule-screen.tsx:410`).
- `src/components/group-picker.tsx` (modified) — props opcionales `withNoGroup` (por defecto
  `true`) y `label` (por defecto `GROUP_PICKER_LABEL`). Con `withNoGroup={false}` no renderiza la
  opción vacía e ignora un valor `""`: `onChange(null)` deja de ser alcanzable (hallazgo 8).
- `src/lib/wallpaper-messages.ts` (modified) — `WALLPAPER_CHOICE_LABEL` ("¿Qué fondo querés?"),
  `PERSONAL_OPTION_LABEL` ("Grilla sola"), `WITH_FRIENDS_OPTION_LABEL` ("Con amigos"),
  `WALLPAPER_GROUP_LABEL` ("Grupo del fondo") y `wallpaperPreviewAlt(dayName, groupName?)` ("Vista
  previa del fondo del Viernes con Los del Lolla").
- `src/components/wallpaper-delivery.ts` (modified) — solo el comentario de `wallpaperFile`: el
  nombre ya no es siempre `wallpaperFileName(day)` (gap 3).
- `tests/unit/components/wallpaper-button.test.tsx` (modified) — los renders existentes pasan
  `groups={null}` y `groupId={undefined}`, y los tests nuevos.
- `tests/unit/components/schedule-screen.test.tsx` (modified).
- `tests/unit/components/group-picker.test.tsx` (modified).
- `tests/unit/lib/wallpaper-messages.test.ts` (modified).

**Logic**
Implementa FR-01 a FR-04, FR-11 a FR-14:
- Al abrir la hoja se toma la copia de siempre (día, escenarios, shows, `draft`) más `groups` y
  `groupId` (FR-11). El `draft` incluye los cambios sin guardar del usuario; los `showIds` de cada
  amigo son su selección guardada, que es lo único que traen `GroupPicks`.
- Sin grupos (`groups` nulo o vacío), la hoja genera el fondo personal al abrir, como hoy (FR-03).
- Con grupos, la hoja abre sin generar nada: la pregunta "¿Qué fondo querés?" y debajo las dos
  opciones como un par de botones con `aria-pressed`, ninguno apretado, y el placeholder de la
  vista previa sin `aria-busy` (FR-01). Las dos opciones quedan visibles todo el tiempo arriba de la
  vista previa, así que se puede pasar de un fondo al otro sin cerrar la hoja, y el foco no se
  pierde porque los botones no se desmontan (hallazgo 6). "Grilla sola" genera el personal (FR-04).
  "Con amigos" genera con el grupo `wallpaperGroupDefault(groups, groupId)` (FR-02); el render
  recibe `group = { name, friendsByShow: picksByShow(grupo) }`.
- Estados de la hoja (hallazgo 6): `SheetState` suma `{ status: "choosing" }`, y la hoja guarda
  aparte `option: "personal" | "group" | null` y `sheetGroupId` (el grupo elegido en la hoja,
  inicializado con `wallpaperGroupDefault` y distinto del `groupId` de la copia). `Preview` suma
  `groupName: string | null` para el `alt`. Las opciones y el selector quedan deshabilitados
  mientras `generating`.
- Con 2 o más grupos y "Con amigos", entre las opciones y la vista previa va `GroupPicker` con
  `withNoGroup={false}` y `label={WALLPAPER_GROUP_LABEL}`. Cambiarlo redibuja con la misma copia y
  el nuevo grupo. Solo acepta ids de la copia de `groups` (R-05). Con un solo grupo no hay selector
  (AC-03).
- `groups === null` (la página no pudo cargarlos): la hoja genera el personal sin pregunta, como la
  grilla que tampoco muestra el selector (degradación aceptada, ver Decisiones).
- El archivo se llama `wallpaperFileName(day, grupo.name)` con el grupo, y `wallpaperFileName(day)`
  sin él (FR-13). La entrega ("Guardar en Fotos" o "Descargar imagen"), el estado "done" y la guía
  son los de FEAT-004, sin cambios (FR-13, FR-14).
- Sin conexión, `groups` llega desde la copia del dispositivo que `ScheduleScreen` ya usa
  (`offline-app.tsx`, ADR-008), así que la hoja funciona igual (FR-12).
- Una generación a la vez con el contador `generation` de FEAT-004; cada redibujo revoca el object
  URL anterior (R-04). Cerrar la hoja vuelve a `idle`.

**Data model**
- Reuses `GroupPicks` from FEAT-006c and the device copy of ADR-008 — no schema change; constraints
  as declared there: group `id` unique and not null (UUID), `name` not null of 1 to 40 code points,
  `showIds` unique per friend, groups validated by `listGroupPicks` or `groupPicksOf`, most
  recently joined first.

**Input validation**
- `groupId` del selector de la hoja: solo un id presente en la copia de `groups`; cualquier otro
  valor se ignora y queda el grupo anterior (R-05).
- `groups`: ya validados por el server o por `groupPicksOf` (todo o nada).

**Error handling**
- Valor inválido en el selector de la hoja — se ignora; el fondo no cambia (R-05).
- Fallo al dibujar o codificar — el mismo estado `failed` de FEAT-004 con su mensaje por código y
  "Reintentar", que redibuja la misma opción y el mismo grupo.
- Cierre de la hoja durante un redibujo — el resultado tardío se descarta por `generation`.

**Required tests**
- [ ] `test-wallpaper-sheet-asks-choice` — con un grupo, abrir la hoja muestra "¿Qué fondo
      querés?", "Grilla sola" y "Con amigos" con `aria-pressed="false"`, y no genera nada todavía —
      validates AC-01.
- [ ] `test-wallpaper-sheet-switch-option` — después de "Con amigos", "Grilla sola" sigue en
      pantalla con el foco intacto, queda `aria-pressed="true"` y redibuja el personal sin cerrar la
      hoja; durante `generating` las opciones y el selector están deshabilitados.
- [ ] `test-wallpaper-sheet-null-groups-personal` — con `groups={null}` la hoja genera el personal
      sin pregunta.
- [ ] `test-wallpaper-sheet-default-from-picker` — en "Los del Lolla" y "Facu y cía", con "Facu y
      cía" en el selector de la grilla, "Con amigos" dibuja "Facu y cía" y el selector de la hoja lo
      muestra y permite cambiarlo — validates AC-02.
- [ ] `test-wallpaper-sheet-single-group-no-picker` — con un solo grupo, "Con amigos" dibuja ese
      grupo y no hay selector — validates AC-03.
- [ ] `test-wallpaper-sheet-no-group-uses-latest` — con "Sin grupo" en la grilla y dos grupos, "Con
      amigos" dibuja `groups[0]` — validates AC-04.
- [ ] `test-wallpaper-sheet-no-groups-direct` — sin grupos, la hoja genera el personal al abrir,
      sin pregunta — validates AC-05.
- [ ] `test-wallpaper-sheet-personal-option` — "Grilla sola" llama al render sin `group` y con el
      nombre de archivo personal — validates AC-06.
- [ ] `test-wallpaper-sheet-draft-and-saved-picks` — un show marcado sin guardar está en
      `selectedIds` y las iniciales de Bruno salen de sus `showIds` guardados — validates AC-14.
- [ ] `test-wallpaper-sheet-group-share` — en un dispositivo que puede compartir, el archivo del
      grupo se llama `mi-grilla-viernes-los-del-lolla.png` y se entrega con "Guardar en Fotos" —
      validates AC-17.
- [ ] `test-wallpaper-sheet-picker-rejects-invalid` — un valor inválido en el selector de la hoja es
      rechazado y no redibuja (R-05).
- [ ] `test-wallpaper-sheet-retry-keeps-group` — después de un fallo al codificar (`ENCODE_FAILED`),
      "Reintentar" redibuja con el mismo grupo.
- [ ] `test-wallpaper-sheet-late-result-dropped` — un redibujo que termina después de cerrar la hoja
      no se muestra y su URL queda revocada (R-04).
- [ ] `test-schedule-screen-wallpaper-groups` — `ScheduleScreen` pasa sus grupos y el grupo del
      selector al botón, también en modo `offline` con la copia del dispositivo — validates AC-15.
- [ ] `test-group-picker-without-no-group` — con `withNoGroup={false}` no hay opción "Sin grupo", la
      etiqueta es la que se pasa y un valor `""` inválido es rechazado sin llamar a `onChange`; sin
      las props, igual que antes.
- [ ] `test-wallpaper-messages-group` — los textos nuevos y el `alt` con y sin grupo.

**Completion criterion**
Los tests de arriba y los existentes de `wallpaper-button`, `schedule-screen` y `group-picker`
pasan, y `ScheduleScreen` sigue sin importar nada de `src/server/`.

## Block 4 — E2E del fondo del grupo

**Files**
- `tests/e2e/wallpaper.ts` (new) — los helpers de `wallpaper.spec.ts` (`useShareSpy`,
  `withoutShare`, `readShareSpy`, `readPng`, `expectWallpaperPng`, `openWallpaper`, `downloadFrom`,
  `expectGuide`, `probesFor`, `stageBlocks`), exportados.
- `tests/e2e/wallpaper.spec.ts` (modified) — importa los helpers de `wallpaper.ts`; sus tests no
  cambian.
- `tests/e2e/wallpaper-group.spec.ts` (new) — el fondo del grupo de punta a punta, con amigos y
  selecciones sembrados con `insertGroup`, `insertFriends`, `insertSelection` y `userIdByEmail` de
  `tests/e2e/db.ts`, y sin conexión con `goOffline` y `reopenOffline` de `tests/e2e/offline.ts`.

**Logic**
Verifica FR-01, FR-03, FR-12 a FR-14 y NFR-01 y NFR-04 contra el build de producción, en los
proyectos mobile (`iphone-webkit`, `mobile-chromium`, `mobile-360`; `desktop` solo corre `/demo`).
La descarga se fuerza con `withoutShare`, como en `wallpaper.spec.ts`, para poder leer el archivo.

**Data model**
- Reuses `groups`, `group_members` and `selections` from FEAT-006a and FEAT-003a through
  `tests/e2e/db.ts` — no schema change; constraints as declared there: `group_members` unique
  (`group_id`, `user_id`), at most 20 members per group, `selections` keyed by user and show.

**Error handling**
- Sin condiciones de error propias: los casos de falla del dibujo y de la entrega ya los cubren los
  E2E de FEAT-004 y los unitarios de los bloques 1 a 3.

**Required tests**
- [ ] `test-e2e-wallpaper-group-asks` — un usuario en un grupo toca "Descargar fondo" y ve "Grilla
      sola" y "Con amigos" — validates AC-01.
- [ ] `test-e2e-wallpaper-group-download` — con un solo grupo "Los del Lolla" y un amigo que eligió
      Tyler, The Creator: "Con amigos" descarga `mi-grilla-viernes-los-del-lolla.png`, un PNG de
      1290 × 2796 de ≤ 5 MB, y muestra la guía — validates AC-03, AC-16 y AC-18.
- [ ] `test-e2e-wallpaper-group-budget` — un grupo con 19 amigos que eligieron todos los shows del
      viernes: la vista previa de "Con amigos" está lista en ≤ `PREVIEW_BUDGET_MS` (3000 ms) en
      `iphone-webkit` — validates AC-19 (el iPhone 12 real, a mano en VERIFY).
- [ ] `test-e2e-wallpaper-group-no-groups` — un usuario sin grupos toca "Descargar fondo" y la hoja
      genera directamente el fondo personal, sin pregunta — validates AC-05.
- [ ] `test-e2e-wallpaper-group-offline` — con los datos del grupo cargados, sin conexión, "Con
      amigos" genera y descarga el fondo del grupo — validates AC-15.

**Completion criterion**
`pnpm test:e2e tests/e2e/wallpaper-group.spec.ts --project=iphone-webkit` pasa, y
`tests/e2e/wallpaper.spec.ts` sigue pasando con los helpers movidos.

## Final verification
`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (con los pisos 80/70/80),
`pnpm test:integration` (sin tests nuevos: este ticket no toca el server ni la base) y
`pnpm test:e2e` en los 4 proyectos pasan. Los 20 AC tienen al menos un test. A mano, en un iPhone 12
o más nuevo con la app instalada y un grupo de 20 integrantes: "Descargar fondo" → "Con amigos" →
"Guardar en Fotos", y la imagen queda en Fotos (AC-17) en ≤ 3 s (AC-19); puesta como fondo de
bloqueo, las iniciales se leen y la hora y los botones de abajo no tapan ningún show.
