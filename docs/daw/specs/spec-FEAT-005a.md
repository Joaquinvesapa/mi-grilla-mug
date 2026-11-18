# Spec FEAT-005a: En vivo con la hora real

| Field | Value |
|-------|-------|
| Ticket | FEAT-005a |
| PRD | docs/daw/prd/prd-FEAT-005a.md |
| Tier | FEATURE |
| Date | 2026-11-18 |
| Spec loops | 3 |
| Loops since last human decision | 0 |

## Vuelta 3 (VERIFY → PLAN, decisión del usuario, 2026-11-18)

Corrección de forma: cada test de **Required tests** abre ahora con un identificador `test-…`,
porque F-VER-06 (`validate_verify.py`) solo reconoce nombres con esa forma y no leía ninguno de los
nombres descriptivos. El nombre descriptivo sigue a continuación y es el nombre real del test en el
código. No cambian bloques, archivos, lógica ni AC.

## Summary
"En vivo" se calcula todo en el navegador, sin servidor ni dependencias nuevas. Una función pura
(`src/lib/live-now.ts`) recibe la grilla que `ScheduleScreen` ya tiene (también en `/~offline`,
ADR-004), la selección en pantalla (`draft`, que incluye los cambios sin guardar y la selección
pendiente de sincronizar, como el fondo de FEAT-004) y un instante, y devuelve qué suena y qué
sigue en cada escenario. Un hook (`useNow`) da la hora real y la refresca en cada cambio de minuto
mientras el panel está abierto. El botón flotante abre el Drawer de shadcn/Vaul que ya usan
`AppMenu` y `WallpaperButton`. Son 4 bloques: cálculo puro; hora real; botón y panel; E2E.
Incorpora R-01 a R-06 de `docs/daw/security/threat-FEAT-005a.md` y los 15 gaps del Impact Check
(G1 a G15).

### Decisiones aplicadas
- **Del usuario (2026-11-18, DEFINE):** partición en FEAT-005a (este ticket, 20 AC) y FEAT-005b
  (reloj simulado de `/demo`).
- **Técnica — todo en el cliente.** Lo exige FR-15 (sin conexión) y ver el `draft` (FR-09): un
  cálculo en el servidor no tendría ninguna de las dos cosas. Sigue el criterio de ADR-005 y no
  necesita un ADR propio: no hubo una alternativa válida que descartar.
- **Técnica — instantes, no horas de reloj.** Todo se compara con `Date.parse(startsAt|endsAt)` y
  el instante actual; las horas se muestran con `formatClock` (zona
  `America/Argentina/Buenos_Aires`). Así la zona del dispositivo no cambia nada (FR-13).
- **Técnica — estados del panel (G5).** Con `now` en milisegundos y `day` = el día del festival que
  contiene `now` (corte de las 06:00, `festivalDayAt`):
  - `over`: `now >= ` el mayor `endsAt` de toda la grilla (FR-11: desde las 00:35 del lunes).
  - `live`: hay un `day` y `now` está en `[primer startsAt del día, mayor endsAt del día)`. Un hueco
    dentro de ese intervalo sigue siendo `live`, con "Nada ahora" en los escenarios sin show.
  - `idle`: cualquier otro caso (antes del primer show del festival, entre las 06:00 y el primer
    show de un día, y entre el fin del último show de un día y las 06:00 del siguiente). Lleva el
    próximo show del festival: el de menor `startsAt > now` (desempate por posición de escenario).
  - "hoy" (FR-10) = el próximo show es del mismo día del festival que `now`. Si no, el nombre del
    día: "Sigue el sábado a las 13:45 — …". Si `now` no cae en ningún día (antes del festival),
    nunca es "hoy".
- **Técnica — nombre del escenario en los textos (G6).** Se usa `stage.name` tal como lo muestra la
  app ("Samsung", glosario de `AGENTS.md` y `data/schedule.json`). AC-11 dice "Samsung Stage" para
  nombrar al escenario, como AC-05 de FEAT-003a, que se verificó con el nombre de la app: el texto
  queda "Sigue hoy a las 13:45 — Tobika en Samsung".
- **Técnica — "en N min" (FR-04).** `minutesUntil = ceil((startsAt − now) / 60 000)`. A las 22:30
  del viernes, Peggy Gou (23:30) da 60.
- **Técnica — dónde va el botón (G1, G7, G8).** `ScheduleScreen` envuelve `ScheduleGrid` en un
  `div` `relative flex min-h-0 flex-1 flex-col` dentro de `DayPicker`, y `LiveButton` es hermano de
  la grilla en ese wrapper, con `absolute`. No es hijo de `.schedule-scroll` (si no, se iría con el
  scroll) ni `fixed` (se saldría de la columna `max-w-md`). Como `PendingBar` va en flujo debajo de
  `DayPicker`, el wrapper termina donde empieza la barra y el botón queda arriba de ella solo.
  Cuando no hay barra, el wrapper llega hasta debajo del home indicator: el botón suma
  `env(safe-area-inset-bottom)` a su margen inferior por la prop `clearHomeIndicator` (`!hasPending`).
  A la derecha, `max(1rem, env(safe-area-inset-right))`.
- **Técnica — espacio libre al final de la grilla (FR-16, G4).** `ScheduleGrid` suma
  `LIVE_BUTTON_CLEARANCE_PX = 80` (botón de 56 px + 16 px de margen + 8 px) al alto de la columna de
  horas y de cada columna de escenario, además de `AXIS_TAIL_PX`. La geometría de los bloques no
  cambia. Con el scroll al final, el último show de cualquier columna queda arriba del botón.
- **Técnica — apertura en ≤ 300 ms (NFR-01, G2).** El `DrawerContent` del panel lleva el atributo
  `data-live-panel` y `src/app/globals.css` agrega, fuera de `@layer`, la regla
  `[data-live-panel] { animation-duration: 250ms !important; transition-duration: 250ms !important; }`.
  Tiene que ser `!important`: Vaul inyecta su CSS sin capa con 0,5 s y escribe
  `transition: transform .5s` en línea al soltar. NFR-01 mide el panel; el fade del overlay (0,5 s,
  `src/components/ui/drawer.tsx` no le pasa `className`) no cambia, porque no tapa el contenido ni
  demora la interacción. El guard de arrastre de 500 ms de Vaul queda como está.
- **Técnica — la hora real (FR-12, FR-14).** `useNow(active)` lee `Date.now()`; mientras `active`,
  agenda un `setTimeout` al próximo minuto exacto (`60 000 − now % 60 000` ms) y re-agenda, y vuelve a
  leer la hora en `visibilitychange` al volver visible. No acepta otra fuente: ni prop, ni URL, ni
  almacenamiento. El reloj simulado de `/demo` es FEAT-005b.

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 3, Block 4 |
| FR-02 | Block 3, Block 4 |
| FR-03 | Block 1, Block 3 |
| FR-04 | Block 1, Block 3 |
| FR-05 | Block 1 |
| FR-06 | Block 1 |
| FR-07 | Block 1, Block 3 |
| FR-08 | Block 1, Block 3 |
| FR-09 | Block 3, Block 4 |
| FR-10 | Block 1, Block 3 |
| FR-11 | Block 1, Block 3 |
| FR-12 | Block 2, Block 3, Block 4 |
| FR-13 | Block 1, Block 4 |
| FR-14 | Block 2, Block 4 |
| FR-15 | Block 3, Block 4 |
| FR-16 | Block 3, Block 4 |
| NFR-01 | Strategy: animación del panel bajada a 250 ms con la regla `[data-live-panel]` (Block 3), medida en E2E en `iphone-webkit` (Block 4); en un iPhone 12 real, evidencia manual en VERIFY |
| NFR-02 | Strategy: `useNow` refresca en cada cambio de minuto exacto, o sea ≤ 60 s (Block 2, AC-13) |
| NFR-03 | Strategy: test que recorre cada minuto de viernes 13:00 a lunes 06:00 contra un oráculo independiente (Block 1, AC-23) |
| NFR-04 | Strategy: botón `size-14` (56 px) y "Cerrar" `size-11` (44 px); textos con `min-w-0` y corte de línea; medido a 360 px en E2E (Block 3, Block 4) |

## Dependencies between blocks
Block 1 y Block 2 son independientes. Block 3 depende de los dos. Block 4 depende de Block 3.
Orden: 1 → 2 → 3 → 4.

## Mobile guides applied (AGENTS.md → Code conventions)
Para el botón "En vivo" y su panel:
- `mobile-native` fixes 1, 2 y 5: el botón usa el patrón de `src/components/pressable.ts`
  (`data-pressed` por `pointerdown`, sin `:hover` pegado ni tap highlight) y
  `touch-action: manipulation`.
- `mobile-native` fix 8: `select-none` en el botón y en "Cerrar".
- `mobile-native` "Baseline": botón de 56 × 56 y "Cerrar" de 44 × 44 (NFR-04).
- `mobile-native` fixes 3, 6 y 7: el panel es el `DrawerContent` de `src/components/ui/drawer.tsx`
  (alto máximo `80dvh`, `safe-area-inset-bottom`). El cuerpo hace scroll vertical interno con
  `overflow-y-auto` y `overscroll-behavior: contain` (5 escenarios pueden pasar de `80dvh` a
  360 × 640, G10); el botón respeta las safe areas inferior y derecha (G8).
- `gestures`: el panel sigue al dedo 1:1 y se cierra deslizando hacia abajo, tocando el overlay o
  con "Cerrar". "Cerrar" lleva `data-vaul-no-drag`, como los botones de `AppMenu`, para que tocarlo
  no arranque un arrastre (G10). El scroll de la grilla no se toca: el panel es un portal encima.
- `design-taste-frontend`: un solo sistema. Acento foam (`--primary`) para el botón y para el ícono
  de elegido (`Check` de lucide, el mismo color que un show elegido en la grilla); el ícono del
  botón es `Radio` de lucide. Copy propio en español. Nada de iris.

## Block 1 — Cálculo puro de "En vivo"

**Files**
- `src/lib/live-now.ts` (new) — `liveNow(schedule, now, selectedIds): LiveView`.
- `src/lib/live-messages.ts` (new) — los textos del panel.
- `src/lib/festival-time.ts` (modified) — `festivalDayAt(now, days): string | null`;
  `festivalDayFor` la usa (misma firma y mismo resultado).
- `tests/unit/lib/live-now.test.ts` (new)
- `tests/unit/lib/live-messages.test.ts` (new)
- `tests/unit/lib/festival-time.test.ts` (modified)

**Logic**
Implementa FR-03 a FR-08, FR-10, FR-11 y FR-13 con las reglas de "Decisiones aplicadas".
- `LiveView` =
  - `{ kind: "live"; stages: LiveStage[] }`, con `LiveStage = { stage: Stage; current: Show | null;
    currentSelected: boolean; next: { show: Show; minutesUntil: number } | null;
    nextSelected: boolean }`;
  - `{ kind: "idle"; next: { show: Show; stage: Stage; day: FestivalDay; sameDay: boolean } }`;
  - `{ kind: "over" }`.
- Un show suena si `startsAt <= now < endsAt` (FR-05). `current` y `next` salen solo de los shows
  del día del festival que contiene `now`, así Peggy Gou (viernes, 23:30–01:00) suena el sábado a
  las 00:30 (FR-06). `next` es el de menor `startsAt > now` en ese escenario y ese día; `null` es
  "Terminó por hoy".
- Orden (FR-07): primero los escenarios cuyo `current` está en `selectedIds`, por `position`;
  después el resto, por `position`. `currentSelected`/`nextSelected` marcan el ícono (FR-08).
- `selectedIds` es un `ReadonlySet<string>` y solo se consulta con `has(show.id)` sobre shows de la
  grilla: un id que no existe no afecta nada (R-01). Un show con `startsAt` o `endsAt` ilegible
  (`Date.parse` = `NaN`) se ignora (R-02). Con una grilla sin shows válidos, `over`.
- `festivalDayAt` vive en `festival-time.ts`, que `prisma/seed.ts` corre con Node sin transpilar:
  solo sintaxis borrable y sin imports de valor (G15).
- `live-messages.ts`: `NOTHING_NOW = "Nada ahora"`, `DONE_FOR_TODAY = "Terminó por hoy"`,
  `NO_LIVE_SHOWS = "No hay shows en vivo"`, `FESTIVAL_OVER = "El festival terminó"`,
  `minutesUntilLabel(n)` ("en 1 min", "en 60 min"), y
  `nextShowLabel({ show, stage, day, sameDay })` → "Sigue hoy a las 13:45 — Tobika en Samsung" o
  "Sigue el sábado a las 13:45 — …" (día en minúscula, hora con `formatClock`).

**Input validation**
- `now`: un `Date`; con `getTime()` = `NaN`, `liveNow` lanza `RangeError` ("Hora inválida"): es un
  error de programación, no un dato de la persona.
- `schedule`: la forma de `Schedule` de `src/lib/schedule-types.ts`, ya validada por
  `readSnapshot()` sin conexión (ADR-004); shows con instantes ilegibles se ignoran.
- `selectedIds`: cualquier string; los que no son ids de la grilla se ignoran.

**Error handling**
- Instante del show ilegible en una grilla alterada (R-02): el show se ignora y el resto se calcula.
- `now` inválido: `RangeError`, sin resultado parcial.

**Required tests**
- [ ] `test-live-now-a-las-22-30-del-viernes-ahora-y-sigue-de-los-5` — `live-now: a las 22:30 del viernes, ahora y sigue de los 5 escenarios` — validates AC-04
- [ ] `test-live-now-a-las-23-30-tyler-ya-no-suena-y-peggy-gou-si` — `live-now: a las 23:30 Tyler ya no suena y Peggy Gou sí` — validates AC-05
- [ ] `test-live-now-el-sabado-00-30-suena-peggy-gou-del-viernes` — `live-now: el sábado 00:30 suena Peggy Gou, del viernes` — validates AC-06
- [ ] `test-live-now-con-turf-elegido-alternative-primero-y-el` — `live-now: con Turf elegido, Alternative primero y el resto en orden` — validates AC-07
- [ ] `test-live-now-sin-elegidos-sonando-orden-de-la-app` — `live-now: sin elegidos sonando, orden de la app` — validates AC-08
- [ ] `test-live-now-marca-de-elegido-en-el-actual-y-en-el` — `live-now: marca de elegido en el actual y en el siguiente` — validates AC-09
- [ ] `test-live-now-sabado-10-00-es-idle-con-tobika-hoy-a-las-13` — `live-now: sábado 10:00 es idle con Tobika hoy a las 13:45` — validates AC-11
- [ ] `test-live-now-sabado-02-00-es-idle-con-el-proximo-show-el` — `live-now: sábado 02:00 es idle con el próximo show el sábado, no hoy` — validates AC-11 (G5)
- [ ] `test-live-now-antes-del-festival-es-idle-con-el-primer-show` — `live-now: antes del festival es idle con el primer show del viernes` — validates AC-11
- [ ] `test-live-now-desde-las-00-35-del-lunes-es-over` — `live-now: desde las 00:35 del lunes es over` — validates AC-12
- [ ] `test-live-now-con-tz-europe-madrid-da-lo-mismo-que-en` — `live-now: con TZ=Europe/Madrid da lo mismo que en Argentina` — validates AC-14 (G11:
  `vi.stubEnv("TZ", …)` y restaurar)
- [ ] `test-live-now-cada-minuto-de-viernes-13-00-a-lunes-06-00` — `live-now: cada minuto de viernes 13:00 a lunes 06:00 coincide con el oráculo` — validates
  AC-23
- [ ] `test-live-now-un-id-invalido-en-la-seleccion-se-ignora` — `live-now: un id inválido en la selección se ignora` — sad path (R-01)
- [ ] `test-live-now-un-show-con-instante-invalido-se-ignora` — `live-now: un show con instante inválido se ignora` — sad path (R-02)
- [ ] `test-live-now-now-invalido-lanza-rangeerror` — `live-now: now inválido lanza RangeError` — sad path
- [ ] `test-festival-time-festivaldayat-devuelve-el-dia-o-null` — `festival-time: festivalDayAt devuelve el día o null fuera del festival` — validates AC-06
- [ ] `test-live-messages-textos-de-idle-hoy-otro-dia-y-minutos` — `live-messages: textos de idle hoy, otro día y minutos` — validates AC-11

**Completion criterion**
Los tests de Block 1 pasan con la grilla real de `data/schedule.json`, el oráculo de AC-23 no
comparte código con `live-now.ts`, y `pnpm typecheck` y `pnpm lint` pasan.

## Block 2 — Hora real que se actualiza sola

**Files**
- `src/components/use-now.ts` (new) — `useNow(active: boolean): Date`.
- `tests/unit/components/use-now.test.tsx` (new)

**Logic**
Implementa FR-12 y FR-14 (NFR-02). Devuelve `new Date(Date.now())` en el render. Mientras
`active`, un efecto agenda un `setTimeout` al próximo minuto exacto que actualiza el estado y
re-agenda, y escucha `visibilitychange` para actualizar al volver visible. El cleanup cancela el
temporizador y el listener (R-05). Con `active = false` no agenda nada. No recibe otra fuente de
hora (FR-14).

**Error handling**
- Sin condiciones de error propias: lee `Date.now()`, que no falla.

**Required tests**
- [ ] `test-use-now-con-el-panel-abierto-de-23-29-30-a-23-30-se` — `use-now: con el panel abierto, de 23:29:30 a 23:30 se actualiza en ≤ 60 s` — validates AC-13
- [ ] `test-use-now-inactivo-no-agenda-temporizadores` — `use-now: inactivo no agenda temporizadores` — validates AC-13
- [ ] `test-use-now-al-desactivar-o-desmontar-no-quedan` — `use-now: al desactivar o desmontar no quedan temporizadores` — validates AC-13 (R-05)
- [ ] `test-use-now-al-volver-visible-relee-la-hora` — `use-now: al volver visible relee la hora` — validates AC-13
- [ ] `test-use-now-solo-la-hora-real-sin-forma-de-cambiarla` — `use-now: solo la hora real, sin forma de cambiarla` — validates AC-15

**Completion criterion**
Los tests de Block 2 pasan con fake timers de Vitest y `vi.getTimerCount()` es 0 después de
desmontar.

## Block 3 — Botón y panel en la pantalla de la grilla

**Files**
- `src/components/live-panel.tsx` (new) — presentación de un `LiveView`.
- `src/components/live-button.tsx` (new) — botón flotante + Drawer con `LivePanel`.
- `src/components/schedule-screen.tsx` (modified) — wrapper `relative` de la grilla y
  `LiveButton` con `schedule`, `draft` y `clearHomeIndicator={!hasPending}`.
- `src/components/schedule-grid.tsx` (modified) — `LIVE_BUTTON_CLEARANCE_PX` exportada y sumada
  al alto de la columna de horas y de las columnas de escenario.
- `src/app/globals.css` (modified) — la regla sin capa `[data-live-panel]` de 250 ms.
- `tests/unit/components/live-panel.test.tsx` (new)
- `tests/unit/components/live-button.test.tsx` (new) — con `stubMatchMedia` y
  `endVaulCloseAnimation` de `tests/unit/components/vaul-env.ts`, como `app-menu.test.tsx` (G9).
- `tests/unit/components/schedule-screen.test.tsx` (modified)
- `tests/unit/components/schedule-grid.test.tsx` (modified)

**Logic**
Implementa FR-01, FR-02, FR-03, FR-04, FR-07 a FR-12, FR-15 y FR-16.
- `LiveButton({ schedule, selectedIds, clearHomeIndicator })`: un `Drawer` controlado (`open`).
  Trigger: `<button aria-label="En vivo">` de 56 × 56, `absolute` abajo a la derecha del wrapper,
  `z-20`, foam, con el ícono `Radio` y el texto "En vivo" para lectores de pantalla.
  `DrawerContent` con `data-live-panel`, `aria-describedby={undefined}`, `DrawerTitle`
  "En vivo" (nombre del diálogo, G9) y `DrawerClose` "Cerrar" (`size-11`, `data-vaul-no-drag`).
  Con el panel abierto llama `useNow(open)` y `liveNow(schedule, now, selectedIds)` (`useMemo`).
- `LivePanel({ view })`: lista vertical. `live`: una fila por escenario con el nombre, "Ahora:"
  artista y horario (`formatClock` de inicio – fin) o `NOTHING_NOW`, y "Sigue:" artista, hora de
  inicio y `minutesUntilLabel` o `DONE_FOR_TODAY`; el ícono `Check` con texto oculto "Elegido"
  junto a cada show elegido. `idle`: `NO_LIVE_SHOWS` y `nextShowLabel`. `over`: `FESTIVAL_OVER`.
  Textos como hijos de React, sin `dangerouslySetInnerHTML` (R-06); `min-w-0` y corte de línea,
  sin scroll horizontal (NFR-04).
- `ScheduleScreen`: el `draft` va como `selectedIds` (FR-09). Abrir y cerrar el panel no toca
  `dayId`, `draft` ni la grilla, que no se desmonta: la posición de scroll queda igual (AC-03).
  Funciona igual en `/~offline`, que monta la misma pantalla (FR-15).

**Data model**
- Reuses `Show` and `Stage` from `src/lib/schedule-types.ts` (tablas `shows` y `stages` de
  FEAT-003a) — no schema change; constraints as declared there: `id` unique, `startsAt` y
  `endsAt` NOT NULL, `stageId` FK a `stages`, `position` unique. Las "columnas" de este bloque son
  las de la grilla en pantalla. La copia del dispositivo de ADR-004 no cambia de versión, y revertir
  el ticket no requiere migración inversa.

**Input validation**
- Las props llegan de `ScheduleScreen`: `schedule` ya validado (o leído por `readSnapshot()` sin
  conexión) y `draft` como `ReadonlySet<string>`; ids desconocidos se ignoran en `liveNow` (R-01).

**Error handling**
- Una grilla alterada con un show ilegible: el panel muestra el resto (lo resuelve `liveNow`,
  R-02) y no se rompe la pantalla.

**Required tests**
- [ ] `test-live-button-el-boton-esta-abajo-a-la-derecha-fuera-del` — `live-button: el botón está abajo a la derecha, fuera del scroll de la grilla` — validates
  AC-01
- [ ] `test-live-button-tocar-en-vivo-abre-el-dialogo-en-vivo` — `live-button: tocar En vivo abre el diálogo "En vivo"` — validates AC-02
- [ ] `test-live-button-cerrar-cierra-el-panel-y-la-seleccion-queda` — `live-button: Cerrar cierra el panel y la selección queda igual` — validates AC-03
- [ ] `test-schedule-screen-abrir-y-cerrar-el-panel-no-cambia-el` — `schedule-screen: abrir y cerrar el panel no cambia el día ni los cambios pendientes` —
  validates AC-03
- [ ] `test-live-panel-muestra-ahora-y-sigue-de-los-5-escenarios-a` — `live-panel: muestra ahora y sigue de los 5 escenarios a las 22:30` — validates AC-04
- [ ] `test-live-panel-alternative-primero-con-turf-elegido` — `live-panel: Alternative primero con Turf elegido` — validates AC-07, AC-08
- [ ] `test-live-panel-icono-de-elegido-en-ahora-y-en-sigue` — `live-panel: ícono de elegido en ahora y en sigue` — validates AC-09
- [ ] `test-schedule-screen-el-panel-usa-el-draft-sin-guardar` — `schedule-screen: el panel usa el draft sin guardar` — validates AC-10
- [ ] `test-live-panel-idle-y-over` — `live-panel: idle y over` — validates AC-11, AC-12
- [ ] `test-live-button-con-el-panel-abierto-se-actualiza-al` — `live-button: con el panel abierto se actualiza al cambiar el minuto` — validates AC-13
- [ ] `test-schedule-screen-en-modo-offline-el-boton-tambien-esta` — `schedule-screen: en modo offline el botón también está` — validates AC-20
- [ ] `test-schedule-grid-las-columnas-suman-el-espacio-libre-del` — `schedule-grid: las columnas suman el espacio libre del botón` — validates AC-21
- [ ] `test-live-button-el-boton-y-cerrar-miden-al-menos-44-44` — `live-button: el botón y Cerrar miden al menos 44 × 44` — validates AC-24
- [ ] `test-live-panel-un-show-con-instante-invalido-en-la-grilla` — `live-panel: un show con instante inválido en la grilla se ignora sin romper el panel` — sad
  path (R-02)

**Completion criterion**
Los tests de Block 3 pasan, la cobertura sigue sobre los pisos de `vitest.config.ts`, y
`pnpm typecheck`, `pnpm lint` y `pnpm format:check` pasan.

## Block 4 — E2E de "En vivo"

**Files**
- `tests/e2e/live.spec.ts` (new)
- `tests/e2e/live.ts` (new) — helpers: instalar la hora con `page.clock`, abrir y cerrar el panel,
  leer las filas.
- `tests/e2e/grid.ts`, `tests/e2e/offline.ts` (modified only if a helper needs to be exported) —
  login, marcar shows y sin conexión.

**Logic**
Corre con el build de producción. La hora se fija con `page.clock.install({ time })` antes del
`goto` y sin pausar (G3): con `setFixedTime` o `pauseAt`, `Date` queda congelado y el guard de
arrastre de Vaul bloquea el swipe. Para AC-13, `pauseAt` después de cargar y `runFor(60_000)`. El
servidor sigue con la hora real (el día inicial puede no ser el viernes; los casos que lo necesitan
eligen el día con las pestañas). Cada test agrupa varios AC sobre una misma cuenta para no pasar el
presupuesto de 10 min del job `e2e` (G14). El swipe para cerrar espera ≥ 500 ms después de abrir
(G2).
- AC-01: scroll en x y en y, el botón sigue en la esquina.
- AC-02 y AC-03: abrir; cerrar con swipe, con el overlay y con "Cerrar"; después, el `scrollTop` y
  `scrollLeft` de la grilla y la barra de pendientes son los mismos.
- AC-04 y AC-10: 22:30 del viernes, con Turf marcado sin guardar: Alternative primero y con el ícono.
- AC-13: de 23:29 a 23:30, Peggy Gou pasa a ser la actual en Samsung sin cerrar el panel.
- AC-14: `test.use({ timezoneId: "Europe/Madrid" })` en su `describe` (G11).
- AC-15: en `/` no hay ningún control de hora.
- AC-20: sin conexión (`goOffline`/`reopenOffline` de `tests/e2e/offline.ts`), el panel muestra lo
  mismo.
- AC-21: con el scroll al final, ningún bloque de show se superpone con el botón, para los 3 días
  (G4: Samsung toca el final del eje).
- AC-22: tiempo desde el toque hasta que termina la animación del panel ≤ 300 ms, solo en
  `iphone-webkit` (`test.skip` con el motivo en la misma línea en los demás proyectos, G13).
- AC-24: a 360 px, el botón y "Cerrar" miden ≥ 44 × 44 y el panel no tiene scroll horizontal.

**Error handling**
- Sin condiciones de error propias: los tests usan la app; el caso sin conexión es AC-20.

**Required tests**
- [ ] `test-live-el-boton-sigue-visible-con-scroll-en-x-e-y` — `live: el botón sigue visible con scroll en x e y` — validates AC-01
- [ ] `test-live-abrir-y-cerrar-de-las-3-formas-sin-perder-scroll` — `live: abrir y cerrar de las 3 formas sin perder scroll ni pendientes` — validates AC-02, AC-03
- [ ] `test-live-22-30-del-viernes-con-turf-sin-guardar` — `live: 22:30 del viernes con Turf sin guardar` — validates AC-04, AC-10
- [ ] `test-live-de-23-29-a-23-30-cambia-solo` — `live: de 23:29 a 23:30 cambia solo` — validates AC-13
- [ ] `test-live-con-zona-de-madrid-muestra-hora-de-argentina` — `live: con zona de Madrid muestra hora de Argentina` — validates AC-14
- [ ] `test-live-en-no-hay-control-de-hora` — `live: en / no hay control de hora` — validates AC-15
- [ ] `test-live-sin-conexion-muestra-lo-mismo` — `live: sin conexión muestra lo mismo` — validates AC-20
- [ ] `test-live-al-final-del-scroll-ningun-show-queda-debajo-del` — `live: al final del scroll ningún show queda debajo del botón` — validates AC-21
- [ ] `test-live-el-panel-abre-en-300-ms` — `live: el panel abre en ≤ 300 ms` — validates AC-22
- [ ] `test-live-a-360-px-tamanos-y-sin-scroll-horizontal` — `live: a 360 px, tamaños y sin scroll horizontal` — validates AC-24

**Completion criterion**
`pnpm test:e2e tests/e2e/live.spec.ts --project=iphone-webkit` pasa en el bloque; en el cierre de
CODE, la suite E2E completa pasa en los 4 proyectos, incluidas `grid.spec.ts`, `wallpaper.spec.ts`,
`offline.spec.ts` y `demo.spec.ts` (G12: el botón no puede interceptar los clics de sus tests; si
alguno falla por eso, se ajusta el helper que hace scroll al bloque).

## Final verification
- `validate_spec.py --tier FEATURE` y `validate_threat.py` pasan sobre esta spec y su modelo.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (con los pisos de cobertura),
  `pnpm test:integration` y la suite E2E completa en los 4 proyectos pasan.
- Los 20 AC del PRD tienen al menos un test; AC-22 suma evidencia manual en un iPhone real en VERIFY.
