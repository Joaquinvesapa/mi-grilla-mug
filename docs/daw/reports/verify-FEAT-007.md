# Verification FEAT-007

Verificación del fondo de pantalla del grupo sobre `10be5a0` (rama `feat/FEAT-007-fondo-grupo`).
Entre `67d0e5e`, donde corrió la suite completa del cierre de CODE, y `10be5a0` solo cambiaron
documentos, así que esa corrida es la evidencia de los E2E (AGENTS.md, "Testing", FIX-001). La
verificación cruzada la hizo un `daw-module-verifier` que no escribió el código, con `pnpm test`
corrido de nuevo (766/766).

| Field | Value |
|---|---|
| Module | src/lib/wallpaper-layout.ts, src/lib/group-picks.ts, src/components/wallpaper-canvas.ts, src/components/wallpaper-button.tsx, src/components/group-picker.tsx, src/components/schedule-screen.tsx, src/lib/wallpaper-messages.ts |
| Line coverage | 99.55% |
| Branch coverage | 97.18% |
| Function coverage | 99.59% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint con tipos) — clean; `pnpm format:check` — OK; `pnpm typecheck` — 0 errores (docs/daw/reports/tests-FEAT-007.md) |

Cobertura de los archivos nuevos o modificados: `wallpaper-layout.ts` 100 % líneas, 95,08 % ramas,
100 % funciones; `group-picks.ts`, `group-picker.tsx` y `wallpaper-messages.ts` 100 %;
`wallpaper-canvas.ts` 100 / 93,75 / 100; `wallpaper-button.tsx` 96,87 / 95,65 / 100;
`schedule-screen.tsx` 99,29 / 95,06 / 97,36 (lo no cubierto es anterior a FEAT-007).

## Acceptance criteria
- ✅ AC-01 — `test-wallpaper-sheet-asks-choice`, `test-e2e-wallpaper-group-asks` (src/components/wallpaper-button.tsx, onOpenChange)
- ✅ AC-02 — `test-wallpaper-sheet-default-from-picker`, `test-schedule-screen-wallpaper-groups` (src/lib/group-picks.ts, wallpaperGroupDefault; wallpaper-button.tsx, pickGroup)
- ✅ AC-03 — `test-wallpaper-sheet-single-group-no-picker`, `test-e2e-wallpaper-group-download`
- ✅ AC-04 — `test-group-picks-wallpaper-default`, `test-wallpaper-sheet-no-group-uses-latest`; el orden por último en unirse, `test-groups-picks-order` (tests/integration/groups.test.ts)
- ✅ AC-05 — `test-wallpaper-sheet-no-groups-direct`, `test-e2e-wallpaper-group-no-groups`
- ✅ AC-06 — `test-wallpaper-group-personal-unchanged`, `test-wallpaper-canvas-no-group-unchanged`, `test-wallpaper-sheet-personal-option`
- ✅ AC-07 — `test-wallpaper-group-safe-zones` (src/lib/wallpaper-layout.ts, wallpaperLayout)
- ✅ AC-08 — `test-wallpaper-group-badges-lit` (wallpaper-layout.ts, blockWithBadges/fitBadges/placeBadges)
- ✅ AC-09 — `test-wallpaper-group-badges-dimmed`, `test-wallpaper-canvas-badges-full-alpha`
- ✅ AC-10 — `test-wallpaper-group-no-friends-no-badges`
- ✅ AC-11 — `test-wallpaper-group-extra-badge`; que el usuario no está entre los amigos lo garantiza `test-groups-picks-friends` (tests/integration/groups.test.ts)
- ✅ AC-12 — `test-wallpaper-group-none-selected`
- ✅ AC-13 — `test-wallpaper-group-header`, `test-wallpaper-canvas-group-label` (wallpaper-layout.ts, groupLabelText)
- ✅ AC-14 — `test-wallpaper-sheet-draft-and-saved-picks`
- ✅ AC-15 — `test-e2e-wallpaper-group-offline`, `test-schedule-screen-wallpaper-groups` (caso offline)
- ✅ AC-16 — `test-wallpaper-group-file-name`, `test-e2e-wallpaper-group-download` (wallpaper-layout.ts, wallpaperFileName)
- ✅ AC-17 — `test-wallpaper-sheet-group-share`; a mano en el iPhone del usuario el 2026-11-18: "Descargar fondo" → "Con amigos" → "Guardar en Fotos", verificado por el usuario
- ✅ AC-19 — `test-e2e-wallpaper-group-budget` (19 amigos con todo el viernes, vista previa en 365 ms ≤ 3000 ms en iphone-webkit); el recorrido en el iPhone del usuario, verificado el 2026-11-18 (ver W4)
- ✅ AC-18 — `test-e2e-wallpaper-group-download` y `test-e2e-wallpaper-group-offline` (guía de la pantalla de bloqueo)
- ✅ AC-20 — `test-wallpaper-group-legibility`, `test-wallpaper-canvas-badges-full-alpha`

## Spec blocks
- ✅ Block 1 — layout del fondo con el grupo: 21/21 tests requeridos presentes y en verde (bd6e85c)
- ✅ Block 2 — dibujo de las píldoras: 3/3 (8e60df6)
- ✅ Block 3 — la pregunta y el grupo en la hoja: 16/16 (02e40ec; acción principal fija por decisión del usuario en a27119f)
- ✅ Block 4 — E2E del fondo del grupo: 5/5 (67d0e5e)

## Tests
Tests requeridos por la spec, por id → archivo:
- ✅ `test-wallpaper-group-personal-unchanged` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-safe-zones` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-badges-lit` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-badges-dimmed` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-no-friends-no-badges` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-extra-badge` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-none-selected` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-header` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-file-name` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-legibility` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-short-block-inline` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-short-block-crowded` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-wide-initials-folded` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-row-threshold` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-matches-picks` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-no-full-names` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-unknown-show-ignored` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-long-name-ellipsis` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-friends-missing-picks` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-wallpaper-group-file-name-empty-slug` → tests/unit/lib/wallpaper-layout.test.ts
- ✅ `test-group-picks-wallpaper-default` → tests/unit/lib/group-picks.test.ts
- ✅ `test-wallpaper-canvas-badges-full-alpha` → tests/unit/components/wallpaper-canvas.test.ts
- ✅ `test-wallpaper-canvas-group-label` → tests/unit/components/wallpaper-canvas.test.ts
- ✅ `test-wallpaper-canvas-no-group-unchanged` → tests/unit/components/wallpaper-canvas.test.ts
- ✅ `test-wallpaper-sheet-asks-choice` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-switch-option` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-null-groups-personal` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-default-from-picker` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-single-group-no-picker` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-no-group-uses-latest` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-no-groups-direct` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-personal-option` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-draft-and-saved-picks` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-group-share` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-picker-rejects-invalid` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-retry-keeps-group` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-wallpaper-sheet-late-result-dropped` → tests/unit/components/wallpaper-button.test.tsx
- ✅ `test-schedule-screen-wallpaper-groups` → tests/unit/components/schedule-screen.test.tsx
- ✅ `test-group-picker-without-no-group` → tests/unit/components/group-picker.test.tsx
- ✅ `test-wallpaper-messages-group` → tests/unit/lib/wallpaper-messages.test.ts
- ✅ `test-e2e-wallpaper-group-asks` → tests/e2e/wallpaper-group.spec.ts
- ✅ `test-e2e-wallpaper-group-download` → tests/e2e/wallpaper-group.spec.ts
- ✅ `test-e2e-wallpaper-group-budget` → tests/e2e/wallpaper-group.spec.ts (solo iphone-webkit; salteado con motivo en los proyectos Chromium)
- ✅ `test-e2e-wallpaper-group-no-groups` → tests/e2e/wallpaper-group.spec.ts
- ✅ `test-e2e-wallpaper-group-offline` → tests/e2e/wallpaper-group.spec.ts

Extras que no pide la spec y también pasan: `test-wallpaper-group-short-block-long-artist`, los
tres `test-wallpaper-group-defensive-*`, `test-wallpaper-sheet-retap-option`,
`test-wallpaper-sheet-action-sticky`, `test-group-picker-long-name` y
`test-e2e-wallpaper-group-long-name-fits`.

- ✅ Sad-path tests: entradas inválidas o rechazadas en cada función con entrada —
  `test-wallpaper-group-unknown-show-ignored` (ids inválidos), `test-wallpaper-group-long-name-ellipsis`,
  `test-wallpaper-group-file-name-empty-slug` (nombres inválidos para archivo),
  `test-group-picks-wallpaper-default` (ids que ya no están, `""`, `null`),
  `test-group-picker-without-no-group` (valor `""` rechazado),
  `test-wallpaper-sheet-picker-rejects-invalid` (ids ajenos rechazados),
  `test-wallpaper-sheet-null-groups-personal`, `test-wallpaper-canvas-group-label` (HTML en el nombre).
- ✅ Evidencia TDD por bloque en `.daw-work/review-block-{1..4}.md`: bloques 1 a 3 vistos en rojo
  contra HEAD antes de implementar; el Block 4 son E2E sobre código ya escrito, con el unit de la
  acción fija y el E2E sin scroll vistos en rojo antes del cambio.

## Warnings
- W1 — las guardas propias de `pickGroup` (`wallpaper-button.tsx:272` y `:275`) no se ejecutan en los tests: el rechazo de R-05 lo hace `GroupPicker` antes; probado de punta a punta.
- W2 — ramas defensivas sin cubrir en `blockWithBadges` (`wallpaper-layout.ts:468`, `:472`), inalcanzables con la grilla real.
- W3 — ramas defensivas inalcanzables en `wallpaper-button.tsx` (`retry` sin opción, `drawingOf` sin el grupo).
- W4 — la verificación manual de AC-17 y AC-19 quedó registrada como "verificado" por el usuario, sin el modelo de iPhone, el tamaño del grupo ni el tiempo medido. AC-19 se apoya además en `test-e2e-wallpaper-group-budget` (19 amigos, 365 ms en WebKit).
- W5 — `stageBlocks` exportado en `tests/e2e/wallpaper.ts` sin uso externo (lo nombra la spec).
- W6 — tests que pueden romperse de más: comparación con la secuencia exacta de `draw`, clases CSS en jsdom, presupuesto de tiempo y la ventana negativa de 1,5 s.
- W7 — la franja vacía de ~32 px de la acción fija en los estados sin botón queda anotada para la revisión visual.

Result: PASSED
