# Verification FEAT-005b

## Ronda 1 — 2026-11-18 — BLOCKED (evidencia desactualizada)

La verificación cruzada la hizo `daw-module-verifier`, un agente que no escribió el código. Empezó
sobre `f007219`. Mientras revisaba, `main` sumó FEAT-006b (PR #13) y la rama lo mergeó (`c1a9462`),
así que la corrida del cierre de CODE sobre `c33e325` dejó de describir el código que se iba a
mergear. Por eso el verificador marcó un FAIL (FAIL-01): `AGENTS.md` pide volver a correr la suite
completa cuando el código cambia después del cierre de CODE. La trazabilidad, los bloques, la
cobertura y los sad paths dieron PASS, con unit vuelto a correr sobre `c1a9462` (622/622).

Corrección: se volvió a CODE por el loop correctivo (`VERIFY → CODE`, que limpió `tests` y `sast`).
El merge de `main` quedó registrado en CODE y no en VERIFY. Después se repitió la suite completa:
unit, integración y E2E en los 4 proyectos, sobre `c1a9462`. Se repitió el SAST, se recuperaron los
dos gates (`24c4895`) y se volvió a VERIFY.

## Ronda 2 — 2026-11-18 — PASSED

Desde `c1a9462` el código no cambió: `24c4895` solo toca reportes. Por eso la corrida del re-cierre
de CODE (`docs/daw/reports/tests-FEAT-005b.md`) es la evidencia de los E2E, según la regla de
FIX-001 en `AGENTS.md`. El análisis del verificador de la ronda 1 se hizo sobre ese mismo código y
sigue valiendo. Su único FAIL quedó resuelto.

| Field | Value |
|---|---|
| Module | src/lib/demo-clock.ts, src/components/demo-clock.ts, src/components/demo-clock-control.tsx, src/components/demo-stage.tsx, src/components/iphone-frame.tsx, src/components/schedule-screen.tsx, src/components/live-button.tsx, src/components/use-now.ts, src/app/demo/page.tsx |
| Line coverage | 99.61% |
| Branch coverage | 97.1% |
| Function coverage | 99.54% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint --type-aware) — clean; `pnpm typecheck` — 0 errores; `pnpm format:check` — OK |

Cobertura por archivo (unit, v8, sobre `c1a9462`):

| Archivo | Líneas | Ramas | Funciones |
|---|---|---|---|
| `src/lib/demo-clock.ts` | 100 % | 100 % | 100 % |
| `src/components/demo-clock.ts` | 100 % | 100 % | 100 % |
| `src/components/demo-clock-control.tsx` | 100 % | 70 % | 100 % |
| `src/components/demo-stage.tsx` | 100 % | sin ramas | 100 % |
| `src/components/iphone-frame.tsx` | 100 % | 80 % | 100 % |
| `src/components/live-button.tsx` | 100 % | 100 % | 100 % |
| `src/components/schedule-screen.tsx` | 99,21 % | 95,38 % | 96,87 % |
| `src/components/use-now.ts` | 100 % | 100 % | 100 % |

`src/app/demo/page.tsx` queda fuera del coverage porque `vitest.config.ts` no lo incluye: lo cubren
los E2E AC-06 y AC-19 de `demo.spec.ts`.

## Acceptance criteria
- ✅ AC-16 — E2E `demo: domingo 23:00 muestra a Sabrina Carpenter en Flow en ≤ 2 s (AC-16)`. Unit:
  `live-button: dentro de /demo el panel usa la hora del reloj`,
  `demo-clock-control: elegir domingo y 23:00 avisa ese instante` y
  `demo-clock channel: dentro de /demo, useDemoNow devuelve la hora que manda el padre`. Código:
  `src/components/demo-clock-control.tsx` (`changeDay`, `changeTime`), `src/components/demo-clock.ts`
  (`useDemoClockBroadcast`, `onMessage`, `useAppNow`) y `src/components/live-button.tsx`
  (`useAppNow(open)`). Los 2 s de NFR-01 se miden en el mismo E2E.
- ✅ AC-17 — E2E `demo: +15 min pasa de 22:30 a 22:45 y la app la usa (AC-17)`. Unit:
  `demo-clock: +15 min pasa de 22:30 a 22:45`, `demo-clock-control: +15 min avisa 22:45`,
  `demo-stage: el cambio del control llega al iframe por postMessage` y
  `demo-clock broadcast: reenvía la hora al cambiar y en el onLoad del iframe`. Código:
  `src/lib/demo-clock.ts:shiftDemoClock`.
- ✅ AC-18 — E2E `demo: sábado 18:00 y la grilla abre en sábado (AC-18)`. Unit:
  `schedule-screen: el día inicial sale del reloj de /demo`. Código:
  `src/components/schedule-screen.tsx` (el día inicial sale de
  `festivalDayAt(demoNow, schedule.days)` y queda trabado con `dayLocked`).
- ✅ AC-19 — E2E `demo: el reloj arranca el viernes 13 de marzo de 2026 a las 22:30 (AC-19)`. Unit:
  `demo-clock: arranca el viernes 13 de marzo de 2026 a las 22:30` y
  `demo-clock-control: muestra viernes 22:30 al arrancar`. Código:
  `src/lib/demo-clock.ts:DEMO_CLOCK_START` y `src/components/demo-stage.tsx`. El año lo afirma el
  unit, y el E2E lo cubre de forma indirecta con Tyler en vivo; la decisión está registrada en
  `decisions-FEAT-005b.md`.

## Spec blocks
- ✅ Block 1 — 7/7 tests de la spec en `tests/unit/lib/demo-clock.test.ts`.
  `src/lib/demo-clock.ts` solo importa `@/lib/festival-time`.
- ✅ Block 2 — 8/8 tests de la spec en `tests/unit/components/demo-clock.test.tsx`, más 1 extra
  (`getServerSnapshot` con `renderToString`). Las dos llamadas a `postMessage` usan
  `window.location.origin` y ninguna usa `"*"`. La lógica de `use-now.ts` no cambió.
- ✅ Block 3 — 6/6 tests de la spec en `demo-clock-control.test.tsx`, `demo-stage.test.tsx` e
  `iphone-frame.test.tsx`, más 2 extra. Usa `Tabs`, `Input` y `Button` de shadcn.
- ✅ Block 4 — 7/7 tests de la spec: `live-button: dentro de /demo el panel usa la hora del reloj`,
  `schedule-screen: el día inicial sale del reloj de /demo`,
  `schedule-screen: sin reloj de /demo, el padre faltante deja el día de las props` y los 4 E2E de
  `tests/e2e/demo.spec.ts`.
- Evidencia TDD de los 4 bloques en `.daw-work/review-block-1.md` a `review-block-4.md`, reproducida
  por el verificador de cada bloque.

## Tests de la spec

Los 28 que la spec promete existen con su nombre exacto y pasan en la corrida sobre `c1a9462`:

- ✅ `test-demo-clock-arranca-el-viernes-a-las-22-30` — `demo-clock: arranca el viernes 13 de marzo de 2026 a las 22:30` (tests/unit/lib/demo-clock.test.ts)
- ✅ `test-demo-clock-mas-15-min-de-22-30-a-22-45` — `demo-clock: +15 min pasa de 22:30 a 22:45` (tests/unit/lib/demo-clock.test.ts)
- ✅ `test-demo-clock-los-limites-del-festival-acotan-el-corrimiento` — `demo-clock: los límites del festival acotan el corrimiento de ±15 min` (tests/unit/lib/demo-clock.test.ts)
- ✅ `test-demo-clock-domingo-23-00-y-sabado-01-00-en-su-fecha` — `demo-clock: domingo 23:00 y sábado 01:00 caen en su fecha calendario` (tests/unit/lib/demo-clock.test.ts)
- ✅ `test-demo-clock-las-fechas-coinciden-con-schedule-json` — `demo-clock: las fechas coinciden con data/schedule.json` (tests/unit/lib/demo-clock.test.ts)
- ✅ `test-demo-clock-dia-u-hora-invalido-devuelve-null` — `demo-clock: un día o una hora inválidos devuelven null` (tests/unit/lib/demo-clock.test.ts)
- ✅ `test-demo-clock-mensaje-invalido-rechazado` — `demo-clock: un mensaje inválido o fuera de rango es rechazado` (tests/unit/lib/demo-clock.test.ts)
- ✅ `test-demo-clock-channel-en-demo-recibe-la-hora-del-padre` — `demo-clock channel: dentro de /demo, useDemoNow devuelve la hora que manda el padre` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-channel-fuera-de-un-frame-no-escucha` — `demo-clock channel: sin frame no registra listener ni manda saludo y useAppNow usa la hora real` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-channel-padre-que-no-es-demo-rechazado` — `demo-clock channel: un padre con otra ruta es rechazado` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-channel-padre-de-otro-origen-rechazado` — `demo-clock channel: un padre de otro origen (location que lanza) es rechazado` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-channel-mensaje-de-otra-ventana-rechazado` — `demo-clock channel: un mensaje de otra ventana o de otro origen es rechazado` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-channel-mensaje-invalido-rechazado` — `demo-clock channel: un mensaje con forma inválida es rechazado` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-broadcast-responde-solo-a-su-iframe` — `demo-clock broadcast: responde el saludo solo de su iframe y con targetOrigin propio` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-broadcast-reenvia-al-cambiar-y-al-cargar` — `demo-clock broadcast: reenvía la hora al cambiar y en el onLoad del iframe` (tests/unit/components/demo-clock.test.tsx)
- ✅ `test-demo-clock-control-muestra-viernes-22-30-al-arrancar` — `demo-clock-control: muestra viernes 22:30 al arrancar` (tests/unit/components/demo-clock-control.test.tsx)
- ✅ `test-demo-clock-control-mas-15-min-avisa-22-45` — `demo-clock-control: +15 min avisa 22:45` (tests/unit/components/demo-clock-control.test.tsx)
- ✅ `test-demo-clock-control-elegir-domingo-y-23-00` — `demo-clock-control: elegir domingo y 23:00 avisa ese instante` (tests/unit/components/demo-clock-control.test.tsx)
- ✅ `test-demo-clock-control-hora-invalida-rechazada` — `demo-clock-control: una hora vacía o inválida es rechazada y el reloj no cambia` (tests/unit/components/demo-clock-control.test.tsx)
- ✅ `test-demo-stage-conecta-el-control-con-el-iframe` — `demo-stage: el cambio del control llega al iframe por postMessage` (tests/unit/components/demo-stage.test.tsx)
- ✅ `test-iphone-frame-pasa-ref-y-onload-al-iframe` — `iphone-frame: pasa iframeRef y onIframeLoad al iframe` (tests/unit/components/iphone-frame.test.tsx)
- ✅ `test-live-button-en-demo-usa-la-hora-del-reloj` — `live-button: dentro de /demo el panel usa la hora del reloj` (tests/unit/components/live-button.test.tsx)
- ✅ `test-schedule-screen-dia-inicial-con-el-reloj-de-demo` — `schedule-screen: el día inicial sale del reloj de /demo` (tests/unit/components/schedule-screen.test.tsx)
- ✅ `test-schedule-screen-sin-reloj-de-demo-dia-de-las-props` — `schedule-screen: sin reloj de /demo, el padre faltante deja el día de las props` (tests/unit/components/schedule-screen.test.tsx)
- ✅ `test-e2e-demo-domingo-23-00-sabrina-carpenter-en-flow` — `demo: domingo 23:00 muestra a Sabrina Carpenter en Flow en ≤ 2 s (AC-16)` (tests/e2e/demo.spec.ts)
- ✅ `test-e2e-demo-mas-15-min-pasa-a-22-45` — `demo: +15 min pasa de 22:30 a 22:45 y la app la usa (AC-17)` (tests/e2e/demo.spec.ts)
- ✅ `test-e2e-demo-sabado-18-00-la-grilla-abre-en-sabado` — `demo: sábado 18:00 y la grilla abre en sábado (AC-18)` (tests/e2e/demo.spec.ts)
- ✅ `test-e2e-demo-arranca-el-viernes-22-30` — `demo: el reloj arranca el viernes 13 de marzo de 2026 a las 22:30 (AC-19)` (tests/e2e/demo.spec.ts)

## Tests
- ✅ Sad-path tests: `demo-clock: un mensaje inválido o fuera de rango es rechazado`,
  `demo-clock: un día o una hora inválidos devuelven null`,
  `demo-clock: los límites del festival acotan el corrimiento de ±15 min`,
  `demo-clock channel: un padre con otra ruta es rechazado`,
  `demo-clock channel: un padre de otro origen (location que lanza) es rechazado`,
  `demo-clock channel: un mensaje de otra ventana o de otro origen es rechazado`,
  `demo-clock channel: un mensaje con forma inválida es rechazado`,
  `demo-clock broadcast: responde el saludo solo de su iframe y con targetOrigin propio` y
  `demo-clock-control: una hora vacía o inválida es rechazada y el reloj no cambia`. Cada caso de
  rechazo tiene un control positivo en el mismo test.
- ✅ Corrida del re-cierre de CODE sobre `c1a9462`: 1041 tests, 1036 pasan y 5 se saltean con su
  motivo. Los E2E corrieron en los 4 proyectos.
- ✅ El reloj simulado no sale de `/demo`: el control solo vive en `DemoStage`, y a `DemoStage` solo
  lo importa `src/app/demo/page.tsx`. El canal solo se abre si el padre es `/demo` del mismo origen.
  `getServerSnapshot` devuelve `null`. FR-14 de FEAT-005a sigue cumpliéndose: `use-now.test.tsx` y
  el E2E AC-15 de `live.spec.ts` no cambiaron y pasan.

## Warnings
- W1 (W-VER-03) — El E2E de AC-16 mide la latencia con `Date.now()` desde el runner. La medida
  incluye la ida y vuelta del clic y los reintentos de `expect`, así que sobreestima la latencia. No
  da falsos positivos, pero en una CI lenta puede fallar aunque la app cumpla los 2 s.
- W2 — En `demo-clock-control: una hora vacía o inválida…`, jsdom convierte "25:00" y "7:5" en "".
  Por eso a nivel componente solo se prueba el valor vacío. `TIME_PATTERN` está cubierto en el test
  de lib.
- W3 — `demo-clock-control.tsx` tiene 70 % de ramas, justo en el piso global. Las 3 ramas sin cubrir
  son respaldos defensivos a los que la UI no llega: `?? ""` en la línea 37, `?? "fri"` en la 55 y la
  rama falsa de `if (instant)` en la 62.
- W4 (W-VER-01) — `isInsideDemo` se exporta, pero solo se usa dentro de su módulo.
- W5 (W-VER-01) — `resetDemoClockForTests` es un export de producción que solo usan los tests. Está
  decidido y registrado en `decisions-FEAT-005b.md` (Block 2).
- W6 — Faltan sad paths que la spec no exige: `shiftDemoClock` con un `Date` inválido o minutos
  `NaN`, e `isDemoClockHello` con `{}` o `undefined`.
- W7 — `docs/adr/adr-007-reloj-de-demo-por-postmessage.md` dice que todo toma la hora de "un único
  hook". En realidad `LiveButton` usa `useAppNow` y `ScheduleScreen` usa `useDemoNow`, como dice la
  spec, que es la que manda. La redacción del ADR es imprecisa.
- W8 — El helper `setDemoParent` está duplicado en `live-button.test.tsx` y en
  `schedule-screen.test.tsx`. Un test extra de Block 3 no lleva el prefijo `demo-clock-control:`.
- W9 — La evidencia TDD está en `.daw-work/`, fuera de git.

Result: PASSED
