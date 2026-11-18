# Spec FEAT-005b: Reloj simulado de /demo

| Field | Value |
|-------|-------|
| Ticket | FEAT-005b |
| PRD | docs/daw/prd/prd-FEAT-005b.md |
| Tier | FEATURE |
| Date | 2026-11-18 |
| Spec loops | 0 |
| Loops since last human decision | 0 |

## Summary
El reloj simulado vive solo en la memoria de la página `/demo` y llega a la app del iPhone (el
iframe del mismo origen, `src="/"`) por `postMessage` (ADR-007). La app solo escucha si está en un
frame cuyo padre es del mismo origen y tiene la ruta `/demo`; fuera de ahí sigue con la hora real y
`useNow` no cambia (FR-14 y AC-15 de FEAT-005a). "En vivo" toma la hora de un hook que prefiere la
del reloj de `/demo`, y `ScheduleScreen` elige el día inicial con ella al montarse. Sin servidor, sin
cambios en la base y sin dependencias nuevas. Son 4 bloques: cálculo puro; canal del cliente; control y escena
de `/demo`; la app dentro del iPhone y los E2E. Incorpora R-01 a R-03 de
`docs/daw/security/threat-FEAT-005b.md`, los 7 gaps del Impact Check y los 5 WARN del arch-auditor.

### Decisiones aplicadas
- **Canal (ADR-007):** hijo → padre `{ type: "mi-grilla:demo-clock-hello" }`; padre → hijo
  `{ type: "mi-grilla:demo-clock", at: <ms desde epoch> }`. `targetOrigin` = `location.origin`,
  nunca `"*"` (R-03). El padre acepta el saludo solo de su propio `iframe.contentWindow` y del mismo
  origen, y reenvía la hora en cada cambio y en el `onLoad` del iframe (por si el saludo llegó antes
  que su listener).
- **Día inicial (FR-01):** `ScheduleScreen` toma el día del reloj de `/demo` al montarse, si el store
  ya tiene una hora, o con la primera que llegue, una sola vez y solo si el usuario todavía no tocó
  un día. Cambiar el reloj con la grilla ya abierta no mueve la pestaña: "día inicial" se lee
  literal. La grilla se vuelve a abrir al entrar desde otra pantalla del iPhone (menú, grupos, login)
  o al recargar el iframe; el store conserva la última hora entre pantallas.
- **Fechas del festival:** constantes en `src/lib/demo-clock.ts` (viernes 2026-03-13, sábado
  2026-03-14, domingo 2026-03-15), con un test que las compara con `data/schedule.json`, para que
  `/demo` no dependa de la base (WARN 2 del arch-auditor).
- **Selector de día:** `Tabs` de shadcn (`src/components/ui/tabs.tsx`), como `day-picker.tsx`, no
  botones con `aria-pressed` (WARN 1).
- **Hora real a propósito, aun dentro de la demo:** el vencimiento de invitaciones
  (`src/app/grupos/[groupId]/page.tsx:60`, servidor), el `savedAt` del dispositivo
  (`schedule-screen.tsx:261`), `src/app/page.tsx` y `src/components/offline-app.tsx` (que siguen
  pasando el día de la hora real como respaldo) y todo `src/server/`.
- **Tests de integración:** no aplican: no hay servidor ni base de datos en este ticket.

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 1, Block 2, Block 3, Block 4 |
| FR-02 | Block 1, Block 3 |
| NFR-01 | Strategy: el cambio viaja por `postMessage` dentro del mismo navegador y se aplica con un `setState`, sin red ni recarga; el E2E de AC-16 lo mide con un tope de 2000 ms (Block 4) |
| AC-16 | Block 4 |
| AC-17 | Block 1, Block 3, Block 4 |
| AC-18 | Block 4 |
| AC-19 | Block 3, Block 4 |

## Dependencies between blocks
Block 2 depende de Block 1 (parsea con `parseDemoClockMessage`). Block 3 depende de 1 y 2 (usa
`demoInstant`, `shiftDemoClock` y `useDemoClockBroadcast`). Block 4 depende de 1, 2 y 3 (los E2E
manejan el control de `/demo`). Orden: 1 → 2 → 3 → 4.

## Block 1 — Cálculo puro del reloj de /demo

**Files**
- `src/lib/demo-clock.ts` (new) — constantes y funciones puras del reloj simulado, sin I/O
- `tests/unit/lib/demo-clock.test.ts` (new) — sus tests

**Logic**
Implementa la parte de FR-01 y FR-02 que no depende del navegador:
- `DEMO_FESTIVAL_DATES`: `{ fri: "2026-03-13", sat: "2026-03-14", sun: "2026-03-15" }`.
- `DEMO_CLOCK_START` = viernes 2026-03-13 22:30 -03:00 (FR-02). `DEMO_CLOCK_MIN` = viernes 06:00 y
  `DEMO_CLOCK_MAX` = lunes 2026-03-16 06:00 (exclusivo), coherentes con `festivalDayAt` de
  `src/lib/festival-time.ts`.
- `demoInstant(dayId, time)` → `Date | null`: la hora `HH:MM` del día de festival `dayId`; una hora
  anterior a las 06:00 cae en la fecha calendario siguiente (corte del día de festival). Usa
  `posterTimeToInstant`.
- `shiftDemoClock(instant, minutes)` → `Date`: suma o resta minutos, acotado a
  `[DEMO_CLOCK_MIN, DEMO_CLOCK_MAX − 15 min]` (Out of Scope: nada fuera de los 3 días).
- `parseDemoClockMessage(data: unknown)` → `Date | null` y `isDemoClockHello(data: unknown)` →
  `boolean`: validan la forma del mensaje (R-02).
- `DEMO_CLOCK_MESSAGE` y `DEMO_CLOCK_HELLO`: los dos `type` del canal.

**Input validation**
- `dayId`: uno de `fri`, `sat`, `sun`; cualquier otro → `null`.
- `time`: `TIME_PATTERN` de `src/lib/festival-time.ts` (`HH:MM`, 00:00–23:59); otro → `null`.
- `data` del mensaje: objeto plano con `type === DEMO_CLOCK_MESSAGE` y `at` número finito dentro de
  `[DEMO_CLOCK_MIN, DEMO_CLOCK_MAX)`; cualquier otra cosa (string, `null`, otro `type`, `at` no
  numérico o fuera de rango) → `null`.

**Error handling**
- Día u hora inválidos en `demoInstant` → devuelve `null`; quien llama no cambia el reloj.
- Mensaje con forma inválida o fuera de rango → `parseDemoClockMessage` devuelve `null`; el canal lo
  descarta (R-02).

**Required tests**
- [ ] `test-demo-clock-arranca-el-viernes-a-las-22-30` — `demo-clock: arranca el viernes 13 de marzo de 2026 a las 22:30` — validates AC-19
- [ ] `test-demo-clock-mas-15-min-de-22-30-a-22-45` — `demo-clock: +15 min pasa de 22:30 a 22:45` — validates AC-17
- [ ] `test-demo-clock-los-limites-del-festival-acotan-el-corrimiento` — `demo-clock: los límites del festival acotan el corrimiento de ±15 min` — validates AC-17
- [ ] `test-demo-clock-domingo-23-00-y-sabado-01-00-en-su-fecha` — `demo-clock: domingo 23:00 y sábado 01:00 caen en su fecha calendario` — validates AC-16, AC-18
- [ ] `test-demo-clock-las-fechas-coinciden-con-schedule-json` — `demo-clock: las fechas coinciden con data/schedule.json` — validates FR-01
- [ ] `test-demo-clock-dia-u-hora-invalido-devuelve-null` — `demo-clock: un día o una hora inválidos devuelven null` — sad path
- [ ] `test-demo-clock-mensaje-invalido-rechazado` — `demo-clock: un mensaje inválido o fuera de rango es rechazado` — sad path (R-02)

**Completion criterion**
Los 7 tests pasan y `src/lib/demo-clock.ts` no importa nada de fuera de `src/lib/`.

## Block 2 — Canal del reloj entre /demo y la app

**Files**
- `src/components/demo-clock.ts` (new) — store y hooks del cliente (sin `"use client"` propio, como
  `use-now.ts`: solo lo importan componentes cliente)
- `tests/unit/components/demo-clock.test.tsx` (new) — sus tests

**Logic**
- **Hijo (la app en el iframe):** `isInsideDemo()` devuelve `true` solo si `window.parent !==
  window` y `window.parent.location.pathname === "/demo"`. La lectura va en `try/catch`, con un
  comentario: desde un padre de otro origen lanza `SecurityError`, y eso significa que no es la
  demo (R-01). Un store de módulo (`subscribe` / `getSnapshot`) registra un único listener de
  `message` en `window` y manda el saludo al padre la primera vez que alguien se suscribe, solo si
  `isInsideDemo()`. Acepta un mensaje solo con `event.source === window.parent`, `event.origin ===
  location.origin` y `parseDemoClockMessage` distinto de `null`. Guarda la última hora. Cuando se va
  el último suscriptor, quita el listener.
- `useDemoNow()` → `Date | null` con `useSyncExternalStore`; `getServerSnapshot` devuelve `null`,
  así el HTML del servidor y la hidratación de la app normal no cambian.
- `useAppNow(active)` → `useDemoNow() ?? useNow(active)`. `useNow` queda como está (FR-14 de
  FEAT-005a).
- **Padre (`/demo`):** `useDemoClockBroadcast(iframeRef, instant)` escucha `message` y responde al
  saludo solo si `event.source === iframeRef.current?.contentWindow` y `event.origin ===
  location.origin`. Manda `{ type, at }` con `contentWindow.postMessage(msg, location.origin)` en
  cada cambio de `instant`, y devuelve `onIframeLoad`, que reenvía la hora al cargar el iframe.

**Input validation**
- `event.data`: pasa por `parseDemoClockMessage` (hijo) o `isDemoClockHello` (padre); `unknown`
  hasta validar, sin `any`.
- `event.source` y `event.origin`: exactamente el padre (o el iframe) y `location.origin`.

**Error handling**
- Mensaje de otra ventana o de otro origen → se ignora sin cambiar la hora (R-01).
- Mensaje con forma inválida → se ignora (R-02).
- Padre de otro origen (lectura de `location` que lanza) → `isInsideDemo()` es `false`, no hay
  listener ni saludo (R-01).

**Required tests**
- [ ] `test-demo-clock-channel-en-demo-recibe-la-hora-del-padre` — `demo-clock channel: dentro de /demo, useDemoNow devuelve la hora que manda el padre` — validates AC-16, AC-17
- [ ] `test-demo-clock-channel-fuera-de-un-frame-no-escucha` — `demo-clock channel: sin frame no registra listener ni manda saludo y useAppNow usa la hora real` — validates FR-01 (R-01, FR-14 de FEAT-005a)
- [ ] `test-demo-clock-channel-padre-que-no-es-demo-rechazado` — `demo-clock channel: un padre con otra ruta es rechazado` — sad path (R-01)
- [ ] `test-demo-clock-channel-padre-de-otro-origen-rechazado` — `demo-clock channel: un padre de otro origen (location que lanza) es rechazado` — sad path (R-01)
- [ ] `test-demo-clock-channel-mensaje-de-otra-ventana-rechazado` — `demo-clock channel: un mensaje de otra ventana o de otro origen es rechazado` — sad path (R-01)
- [ ] `test-demo-clock-channel-mensaje-invalido-rechazado` — `demo-clock channel: un mensaje con forma inválida es rechazado` — sad path (R-02)
- [ ] `test-demo-clock-broadcast-responde-solo-a-su-iframe` — `demo-clock broadcast: responde el saludo solo de su iframe y con targetOrigin propio` — validates FR-01 (R-03)
- [ ] `test-demo-clock-broadcast-reenvia-al-cambiar-y-al-cargar` — `demo-clock broadcast: reenvía la hora al cambiar y en el onLoad del iframe` — validates AC-17

**Completion criterion**
Los 8 tests pasan, `tests/unit/components/use-now.test.tsx` sigue verde sin cambios y no hay
ningún `postMessage` con `"*"` en `src/`.

## Block 3 — Control del reloj y escena de /demo

**Files**
- `src/components/demo-clock-control.tsx` (new) — el control: día, hora y ±15 min
- `src/components/demo-stage.tsx` (new, `"use client"`) — estado del reloj, el control y el iPhone
- `src/components/iphone-frame.tsx` (modified) — props opcionales `iframeRef` y `onIframeLoad`
- `src/app/demo/page.tsx` (modified) — renderiza `DemoStage` bajo el encabezado
- `tests/unit/components/demo-clock-control.test.tsx` (new)
- `tests/unit/components/demo-stage.test.tsx` (new)
- `tests/unit/components/iphone-frame.test.tsx` (modified) — casos de las props nuevas

**Logic**
Implementa la parte visible de FR-01 y FR-02:
- `DemoClockControl({ value, onChange })`: título "Reloj de la demo"; día con `Tabs` de shadcn
  (Viernes / Sábado / Domingo); hora con `Input` de shadcn `type="time"` y `step={900}`; botones
  `Button` de shadcn "−15 min" y "+15 min"; la hora elegida visible como texto (`formatClock`).
  Elegir otro día conserva la hora (`demoInstant`), y los botones usan `shiftDemoClock`. Tokens Rosé
  Pine, acento foam, sin iris.
- `DemoStage`: `useState(DEMO_CLOCK_START)` (FR-02, no se guarda en ningún lado); a 1280×800, el
  control en un panel lateral a la izquierda y el iPhone a la derecha, sin scroll de página (regresión de
  AC-06 y AC-07 de `tests/e2e/demo.spec.ts`); conecta `useDemoClockBroadcast` con el `iframeRef` y el
  `onIframeLoad` de `IphoneFrame`.
- `IphoneFrame`: las props nuevas son opcionales; sin ellas renderiza igual que hoy (5 renders
  existentes sin props).

**Input validation**
- Hora tipeada: debe matchear `TIME_PATTERN`; vacía o con otro formato no cambia el reloj.
- Día: solo los tres valores de los `Tabs`.

**Error handling**
- Hora vacía o con formato inválido en el `Input` → el reloj no cambia y el campo vuelve a mostrar la
  hora vigente al perder el foco.

**Required tests**
- [ ] `test-demo-clock-control-muestra-viernes-22-30-al-arrancar` — `demo-clock-control: muestra viernes 22:30 al arrancar` — validates AC-19
- [ ] `test-demo-clock-control-mas-15-min-avisa-22-45` — `demo-clock-control: +15 min avisa 22:45` — validates AC-17
- [ ] `test-demo-clock-control-elegir-domingo-y-23-00` — `demo-clock-control: elegir domingo y 23:00 avisa ese instante` — validates AC-16
- [ ] `test-demo-clock-control-hora-invalida-rechazada` — `demo-clock-control: una hora vacía o inválida es rechazada y el reloj no cambia` — sad path
- [ ] `test-demo-stage-conecta-el-control-con-el-iframe` — `demo-stage: el cambio del control llega al iframe por postMessage` — validates FR-01
- [ ] `test-iphone-frame-pasa-ref-y-onload-al-iframe` — `iphone-frame: pasa iframeRef y onIframeLoad al iframe` — validates FR-01

**Completion criterion**
Los 6 tests pasan, los tests existentes de `iphone-frame.test.tsx` siguen verdes y `/demo` muestra
el control al lado del iPhone sin scroll a 1280×800.

## Block 4 — La app del iPhone usa el reloj de /demo, y los E2E

**Files**
- `src/components/live-button.tsx` (modified) — `useAppNow(open)` en lugar de `useNow(open)`
- `src/components/schedule-screen.tsx` (modified) — día inicial con el reloj de `/demo`
- `src/components/use-now.ts` (modified) — solo el comentario de FR-14 (apunta a `demo-clock.ts`)
- `tests/unit/components/live-button.test.tsx` (modified)
- `tests/unit/components/schedule-screen.test.tsx` (modified)
- `tests/e2e/demo.spec.ts` (modified) — AC-16 a AC-19

**Logic**
- `LiveButton`: el panel usa `useAppNow(open)`; fuera de `/demo` es `useNow(open)`, como hoy.
- `ScheduleScreen`: monta `useDemoNow()`. Con la primera hora de `/demo` que tenga (la del store al
  montarse, o la primera que llegue) fija `dayId = festivalDayAt(...)` una sola vez, y solo si el
  usuario no eligió un día antes; si da `null`, queda el día que vino por props. Los cambios
  posteriores del reloj no mueven la pestaña.
- `src/app/page.tsx` y `src/components/offline-app.tsx` no cambian: siguen calculando el día con la
  hora real como respaldo.

**Error handling**
- Sin conexión con el padre (fuera de `/demo`, o `/demo` todavía sin responder) → `useDemoNow()` es
  `null` y la app usa la hora real y el día de las props, como hoy.

**Required tests**
- [ ] `test-live-button-en-demo-usa-la-hora-del-reloj` — `live-button: dentro de /demo el panel usa la hora del reloj` — validates AC-16
- [ ] `test-schedule-screen-dia-inicial-con-el-reloj-de-demo` — `schedule-screen: el día inicial sale del reloj de /demo` — validates AC-18
- [ ] `test-schedule-screen-sin-reloj-de-demo-dia-de-las-props` — `schedule-screen: sin reloj de /demo, el padre faltante deja el día de las props` — sad path
- [ ] `test-e2e-demo-domingo-23-00-sabrina-carpenter-en-flow` — `demo: domingo 23:00 muestra a Sabrina Carpenter en Flow en ≤ 2 s (AC-16)` — validates AC-16
- [ ] `test-e2e-demo-mas-15-min-pasa-a-22-45` — `demo: +15 min pasa de 22:30 a 22:45 y la app la usa (AC-17)` — validates AC-17
- [ ] `test-e2e-demo-sabado-18-00-la-grilla-abre-en-sabado` — `demo: sábado 18:00 y la grilla abre en sábado (AC-18)` — validates AC-18
- [ ] `test-e2e-demo-arranca-el-viernes-22-30` — `demo: el reloj arranca el viernes 13 de marzo de 2026 a las 22:30 (AC-19)` — validates AC-19

Los E2E corren en el proyecto `desktop` (`DESKTOP_ONLY` de `playwright.config.ts`):
`pnpm test:e2e tests/e2e/demo.spec.ts --project=desktop`. Inician sesión dentro del iframe con una
cuenta nueva (`tests/e2e/auth.ts`). AC-18 recarga el iframe después de elegir la hora. AC-15 (fuera
de `/demo`, la hora real) ya lo cubre `tests/e2e/live.spec.ts` y no cambia.

**Completion criterion**
Los 7 tests pasan, siguen verdes los existentes de `live-button`, `schedule-screen` (incluido el
respaldo al primer día) y `offline-app`, y AC-06/AC-07 de `demo.spec.ts` siguen pasando.

## Final verification
`pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` verdes con los pisos de cobertura;
la suite E2E completa en los 4 proyectos al cerrar CODE; `/demo` arranca en viernes 22:30 y, al
elegir domingo 23:00, "En vivo" del iPhone muestra a Sabrina Carpenter en Flow; fuera de `/demo` la
app no tiene ningún control ni canal del reloj activo.
