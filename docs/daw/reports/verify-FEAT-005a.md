# Verification FEAT-005a

## Ronda 1 — 2026-11-18 (sin el usuario: pendiente de 3 verificaciones humanas)

Verificación automatizada completa, con la verificación cruzada de `daw-module-verifier` (un agente
que no escribió el código). El código no cambió desde la corrida del cierre de CODE (`1cecf85`;
`git diff 1cecf85 HEAD -- src tests` vacío), así que esa corrida es la evidencia de los E2E
(regla de FIX-001 en `AGENTS.md`).

| Field | Value |
|---|---|
| Module | src/lib/live-now.ts, src/lib/live-messages.ts, src/lib/festival-time.ts, src/components/use-now.ts, src/components/live-button.tsx, src/components/live-panel.tsx, src/components/schedule-screen.tsx, src/components/schedule-grid.tsx, src/app/globals.css |
| Line coverage | 99.45% |
| Branch coverage | 97.73% |
| Function coverage | 99.33% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint --type-aware) — clean; `pnpm typecheck` — 0 errores; `pnpm format:check` — OK |

## Acceptance criteria
- ✅ AC-01 — `live-button: el botón está abajo a la derecha, fuera del scroll de la grilla`; E2E `live: el botón sigue visible con scroll en x e y` (src/components/live-button.tsx, schedule-screen.tsx)
- ✅ AC-02 — `live-button: tocar En vivo abre el diálogo "En vivo"`; E2E en el mismo step de AC-03
- ✅ AC-03 — `schedule-screen: abrir y cerrar el panel no cambia el día ni los cambios pendientes`; E2E `live: abrir y cerrar de las 3 formas sin perder scroll ni pendientes` (swipe con `page.mouse`; el táctil real de iOS queda en la prueba manual de abajo)
- ✅ AC-04 — `live-now: a las 22:30 del viernes, ahora y sigue de los 5 escenarios`; `live-panel: muestra ahora y sigue de los 5 escenarios a las 22:30`; E2E `live: 22:30 del viernes con Turf sin guardar`
- ✅ AC-05 — `live-now: a las 23:30 Tyler ya no suena y Peggy Gou sí`
- ✅ AC-06 — `live-now: el sábado 00:30 suena Peggy Gou, del viernes`; `festival-time: festivalDayAt devuelve el día o null fuera del festival`
- ✅ AC-07 — `live-now: con Turf elegido, Alternative primero y el resto en orden`; `live-panel: Alternative primero con Turf elegido`
- ✅ AC-08 — `live-now: sin elegidos sonando, orden de la app`
- ✅ AC-09 — `live-now: marca de elegido en el actual y en el siguiente`; `live-panel: ícono de elegido en ahora y en sigue`
- ✅ AC-10 — `schedule-screen: el panel usa el draft sin guardar`; E2E `live: 22:30 del viernes con Turf sin guardar`
- ⚠️ AC-11 — `live-now: sábado 10:00 es idle con Tobika hoy a las 13:45`, `live-messages: textos de idle hoy, otro día y minutos`, `live-panel: idle y over`. Los tests pasan con "Sigue hoy a las 13:45 — Tobika en Samsung"; el PRD escribe "Samsung Stage". Pendiente de que el usuario confirme el texto (decisions-FEAT-005a.md).
- ✅ AC-12 — `live-now: desde las 00:35 del lunes es over`; `live-panel: idle y over`
- ✅ AC-13 — `use-now: con el panel abierto, de 23:29:30 a 23:30 se actualiza en ≤ 60 s`; `live-button: con el panel abierto se actualiza al cambiar el minuto`; E2E `live: de 23:29 a 23:30 cambia solo`
- ✅ AC-14 — `live-now: con TZ=Europe/Madrid da lo mismo que en Argentina`; E2E `live: con zona de Madrid muestra hora de Argentina`
- ✅ AC-15 — `use-now: solo la hora real, sin forma de cambiarla`; E2E `live: en / no hay control de hora`
- ✅ AC-20 — `schedule-screen: en modo offline el botón también está`; E2E `live: sin conexión muestra lo mismo`
- ✅ AC-21 — `schedule-grid: las columnas suman el espacio libre del botón`; E2E `live: al final del scroll ningún show queda debajo del botón`
- ⚠️ AC-22 — E2E `live: el panel abre en ≤ 300 ms` (solo `iphone-webkit`) afirma la animación de 250 ms y su fin; el total se anota (255–356 ms en el WebKit headless del contenedor). Pendiente de la medición manual en un iPhone 12 o más nuevo.
- ✅ AC-23 — `live-now: cada minuto de viernes 13:00 a lunes 06:00 coincide con el oráculo` (3901 minutos, oráculo independiente)
- ✅ AC-24 — `live-button: el botón y Cerrar miden al menos 44 × 44`; E2E `live: a 360 px, tamaños y sin scroll horizontal`

## Spec blocks
- ✅ Block 1 — 6/6 archivos, 17/17 tests de la spec (más 1 extra)
- ✅ Block 2 — 2/2 archivos, 5/5 tests de la spec (más 3 extra justificados)
- ✅ Block 3 — 9/9 archivos, 14/14 tests de la spec (más 1 extra)
- ✅ Block 4 — 2/2 archivos, 10/10 tests de la spec como `test` o `test.step` (G14)

## Tests
- ✅ Sad-path tests: `live-now: now inválido lanza RangeError`, `live-now: un id inválido en la selección se ignora`, `live-now: un show con instante inválido se ignora`, `live-panel: un show con instante inválido en la grilla se ignora sin romper el panel`
- ✅ Corrida del cierre de CODE: 783 tests, 778 pasan, 5 salteados con motivo (`docs/daw/reports/tests-FEAT-005a.md`); unit re-corrida en VERIFY: 463/463.
- Evidencia TDD por bloque en `.daw-work/review-block-{1..4}.md` (fuera de git): Blocks 1–3 en rojo antes de implementar; Block 4 por mutantes, porque es un bloque solo de tests sobre código ya hecho.

## Warnings
- W1 — AC-11: "Samsung Stage" en el PRD contra "Samsung" en la app. Decisión del usuario pendiente.
- W2 — AC-22: el umbral de ≤ 300 ms en un iPhone 12 no se puede afirmar en el contenedor. Medición manual pendiente.
- W3 — AC-03: el swipe del E2E usa el mouse; el arrastre táctil real de iOS queda para la misma prueba manual.
- W4 — Block 4 sin test-first (evidencia por mutantes).
- W5 — la evidencia TDD vive en `.daw-work/`, fuera de git.
- W6 — W-VER-01: rama defensiva inalcanzable en `src/lib/live-now.ts:108-112` (única línea sin cubrir).
- W7 — W-VER-01: `scrollGrid` duplicado en `tests/e2e/live.ts`.
- W8 — W-VER-03: el swipe usa tiempo real (guard de 500 ms de Vaul) y 2 px de tolerancia.
- W9 — W-VER-03: AC-13 en E2E necesita abrir el panel en menos de 55 s de reloj antes de `pauseAt` (con guarda y mensaje).
- W10 — W-VER-03: el unit de AC-14 cambia `TZ` del proceso y lo restaura en `afterEach`.

## Pendiente para cerrar VERIFY
1. Que el usuario confirme "Tobika en Samsung" (o pida "Samsung Stage": vuelve a CODE, un cambio de
   copy en `nextShowLabel` y sus tests).
2. Medición en un iPhone 12 o más nuevo, con la app instalada: tocar "En vivo" y medir hasta que el
   panel termina de subir (Web Inspector de Safari o video a 240 fps), varias veces; el máximo tiene
   que ser ≤ 300 ms. Si da más, vuelve a CODE (por ejemplo, bajar la animación).
3. En el mismo iPhone: el panel sigue al dedo al deslizar y se cierra al soltar.

Result: PENDING — ronda 1 sin FAIL automatizado; el gate `verify` no se reclama hasta los 3 puntos de
arriba.
