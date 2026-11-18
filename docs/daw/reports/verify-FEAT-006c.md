# Verification FEAT-006c

Verificación del módulo "El grupo en la grilla" contra `docs/daw/prd/prd-FEAT-006c.md` y
`docs/daw/specs/spec-FEAT-006c.md` (6 bloques, con la vuelta 1). Se hizo sobre HEAD `06ab276`. El
código no cambió desde la corrida del cierre de CODE (`0cef9f8`; después solo se sumaron reportes),
así que esa corrida E2E en los 4 proyectos es la evidencia de los E2E (`docs/daw/reports/tests-FEAT-006c.md`).
La verificación cruzada la hizo `daw-module-verifier`, que no escribió el código: volvió a correr
unit, integración, lint, formato y tipos, y no corrió E2E.

| Field | Value |
|---|---|
| Module | src/server/groups.ts, src/lib/group-picks.ts, src/lib/offline-selection.ts, src/lib/stored-value.ts, src/lib/schedule-layout.ts, src/lib/group-messages.ts, src/components/schedule-grid.tsx, src/components/group-picker.tsx, src/components/ui/native-select.tsx, src/components/schedule-screen.tsx, src/components/device-store.ts, src/components/offline-app.tsx, src/app/page.tsx |
| Line coverage | 99.59% |
| Branch coverage | 97.5% |
| Function coverage | 99.5% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint --type-aware) — clean, 0 findings; `pnpm format:check` OK; `pnpm typecheck` 0 errores |

Cobertura por archivo nuevo o modificado:
- 100 % en sentencias, ramas y funciones: `group-picks.ts`, `stored-value.ts`, `schedule-layout.ts`,
  `device-store.ts`, `group-picker.tsx`, `schedule-grid.tsx` y `offline-app.tsx`.
- `groups.ts`: 100 / 96,8 / 100. Las ramas sin cubrir son anteriores.
- `schedule-screen.tsx`: 98 / 97,3 / 94,7.
- `ui/` está excluido por la config.

Corridas:
- Unit 641/641, integración 86/86, en esta fase.
- E2E en el cierre de CODE: 313 pasan y 5 se saltean con motivo, en `iphone-webkit`,
  `mobile-chromium`, `mobile-360` y `desktop`.

## Acceptance criteria
- ✅ AC-20 — sin grupos no hay selector ni iniciales: `schedule-screen.tsx` (render condicionado) y `resolveGroupChoice` → `test-picker-hidden-without-groups`, `test-e2e-group-grid-no-groups`
- ✅ AC-21 — "Los del Lolla" muestra las iniciales de Ana y Bruno en Tyler, The Creator: `listGroupPicks`, `picksByShow`, `ShowBlock` → `test-groups-picks-friends`, `test-picks-by-show`, `test-grid-friend-initials`, `test-screen-friend-initials`, `test-e2e-group-grid-initials`
- ✅ AC-22 — 3 iniciales y "+2" sin las del usuario: `indicatorParts`, `m.user_id <> me.user_id` → `test-indicator-parts`, `test-grid-friend-extra`, `test-e2e-group-grid-extra`
- ✅ AC-23 — "Sin grupo" saca los indicadores: `resolveGroupChoice` → `null`, mapa vacío → `test-picks-none`, `test-grid-no-friends`, `test-picker-no-group`, `test-e2e-group-grid-no-group`
- ✅ AC-24 — el grupo elegido sigue al cerrar y volver a abrir: `readGroupChoice` / `writeGroupChoice` y la adopción después de hidratar → `test-picker-remembers`, `test-e2e-group-grid-remembers`
- ✅ AC-25 — la primera vez, el grupo al que se unió último: `ORDER BY me.joined_at DESC` y `resolveGroupChoice` → `test-groups-picks-order`, `test-resolve-choice`, `test-picker-default-latest`, `test-e2e-group-grid-latest`
- ✅ AC-26 — lo que un amigo no guardó no se ve: solo se lee `selected_shows` → `test-groups-picks-saved-only`, `test-e2e-group-grid-unsaved`
- ✅ AC-27 — sin conexión, los últimos datos cargados: `parseSnapshot` con `groups`, `offline-app.tsx`, `rememberConfirmed` → `test-snapshot-groups-roundtrip`, `test-offline-app-groups`, `test-e2e-group-grid-offline`
- ✅ AC-30 — con 4G y 20 integrantes, en 2 s o menos: una consulta con `array_agg` en el `Promise.all` de `page.tsx` → `test-e2e-group-grid-load` (195 ms; se mide en Chromium por CDP, como fija la spec)
- ✅ AC-32 — a 360 px, iniciales de 12 px o más y selector de 44 × 44 o más, y la fila entra en cada bloque: chips `text-[12px]`, select `h-11 text-base`, `heightWithFriends` y el Block 6 → `test-picker-options`, `test-grid-friend-height`, `test-grid-short-name-clamp`, `test-grid-time-line-height`, `test-name-two-lines-threshold`, `test-e2e-group-grid-size`, `test-e2e-group-grid-fit`

FR-01 a FR-06 y NFR-01 y NFR-02 quedan cubiertos por estos AC. No falta nada del PRD, y no se
implementó nada de lo que el PRD deja fuera de alcance.

## Spec blocks
- ✅ Block 1 — `listGroupPicks`: consulta parametrizada y anclada en la membresía de la sesión, sin ids de amigos; 7/7 tests: `test-groups-picks-friends`, `test-groups-picks-order`, `test-groups-picks-privacy`, `test-groups-picks-saved-only`, `test-groups-picks-alone`, `test-groups-picks-no-user-ids`, `test-groups-picks-unavailable`
- ✅ Block 2 — reglas puras y copia del dispositivo (`FORMAT_VERSION` sigue en 1); 9/9: `test-picks-by-show`, `test-picks-none`, `test-indicator-parts`, `test-resolve-choice`, `test-resolve-choice-stale`, `test-parse-choice-invalid`, `test-snapshot-groups-roundtrip`, `test-snapshot-groups-invalid`, `test-group-picks-messages`
- ✅ Block 3 — selector e iniciales en la grilla, horario siempre visible; 6/6: `test-grid-friend-initials`, `test-grid-friend-extra`, `test-grid-friend-height`, `test-grid-no-friends`, `test-picker-options`, `test-picker-unknown-value`
- ✅ Block 4 — pantalla, página y copia; 10/10: `test-picker-hidden-without-groups`, `test-screen-friend-initials`, `test-picker-no-group`, `test-picker-remembers`, `test-picker-default-latest`, `test-offline-app-groups`, `test-home-page-picks-unavailable`, `test-screen-keeps-copy-groups`, `test-store-choice-unavailable`, `test-logout-clears-groups`
- ✅ Block 5 — E2E; 12/12: `test-e2e-group-grid-no-groups`, `test-e2e-group-grid-initials`, `test-e2e-group-grid-extra`, `test-e2e-group-grid-no-group`, `test-e2e-group-grid-remembers`, `test-e2e-group-grid-latest`, `test-e2e-group-grid-unsaved`, `test-e2e-group-grid-offline`, `test-e2e-group-grid-size`, `test-e2e-group-grid-fit`, `test-e2e-group-grid-load`, `test-e2e-db-guard-rejected`
- ✅ Block 6 — bloques cortos con amigos (vuelta 1); 4/4: `test-grid-short-name-clamp`, `test-grid-tall-name-unclamped`, `test-grid-time-line-height`, `test-name-two-lines-threshold`

Los 48 ids de test de la spec están en el código.

Mitigaciones del modelo de amenazas, con su test:
- R-01: `test-groups-picks-privacy`
- R-02: `test-groups-picks-no-user-ids`
- R-03: `test-logout-clears-groups`
- R-04: `test-snapshot-groups-invalid`
- R-05: `test-parse-choice-invalid`, `test-resolve-choice-stale`
- R-06: `test-home-page-picks-unavailable`, `test-screen-keeps-copy-groups`
- R-07: `test-e2e-db-guard-rejected`
- R-08: aceptado en el PRD, sin test.

## Tests
- ✅ Sad-path tests: toda función que recibe entrada tiene un caso inválido o rechazado:
  - `parseGroupChoice` y `groupPicksOf`: `test-parse-choice-invalid`, `test-snapshot-groups-invalid`;
  - el valor del selector: `test-picker-unknown-value`;
  - el almacenamiento no disponible: `test-store-choice-unavailable`;
  - la base caída: `test-groups-picks-unavailable`, `test-home-page-picks-unavailable`;
  - una `DATABASE_URL` no local: `test-e2e-db-guard-rejected`.
- ✅ Evidencia TDD: cada bloque mostró sus tests en rojo antes de implementar. El revisor reprodujo
  el rojo del Block 6 contra `5e7e00c`, con 4 fallidos, y `test-e2e-group-grid-fit` falló en los 3
  proyectos mobile hasta el Block 6.

## Warnings
- ⚠️ W-VER-01: `src/components/ui/native-select.tsx` exporta `NativeSelectOptGroup` sin uso. Viene así de la copia de shadcn y `ui/` está excluido de la cobertura.
- ⚠️ W-VER-02: no aplica; la lógica nueva está por encima del 90 %.
- ⚠️ La rama de `chooseGroup` que rechaza un id ajeno (`schedule-screen.tsx:309`) no tiene test. Es defensa en profundidad: el selector ya filtra esos valores, con test. Está registrado en `decisions-FEAT-006c.md`.
- ⚠️ `test-grid-tall-name-unclamped` es un test de no regresión: ya pasaba antes del Block 6.
- ⚠️ Antes de adoptar la elección guardada, la pantalla puede mostrar 1 o 2 frames del grupo más reciente. No cambia el layout.
- ⚠️ Fuera de este ticket (FEAT-003a): sin amigos, el bloque de 44 px de "¡Qué Lío, Hugo!" no muestra su horario a 360 px.

Result: PASSED
