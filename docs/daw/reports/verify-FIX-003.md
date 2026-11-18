# Verification FIX-003

Verificación de FIX-003 sobre `bd0613b`, con el código sin cambios desde la corrida del cierre de
CODE (`docs/daw/reports/tests-FIX-003.md`), que es la evidencia de los E2E según `AGENTS.md`.
Revisión independiente de `daw-module-verifier`: corrió `tests/unit/lib/wallpaper-layout.test.ts`
(21/21) y dos mutaciones en copias fuera del repo (con `SAFE_BOTTOM = 224` el test de regresión
falla por comportamiento, `fri-samsung-2330: expected 2572 to be less than or equal to 2404`; con
`BLOCK_PADDING_Y = 6` `test-wallpaper-every-show-has-time` falla en `sun-kidzapalooza-1800`).

| Field | Value |
|---|---|
| Module | src/lib/wallpaper-layout.ts |
| Line coverage | 99.5% |
| Branch coverage | 97.64% |
| Function coverage | 99.23% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm format:check` — OK; `pnpm typecheck` — 0 errores |

## Acceptance criteria
- ✅ AC-01 (RCA, FR-01, NFR-01) — `test-wallpaper-clear-of-lock-screen-buttons` (tests/unit/lib/wallpaper-layout.test.ts:303): bloques y marcas ≤ 2404 en los 3 días y ≥ 40 px de aire hasta los botones (da 45)
- ✅ AC-02 (RCA, FR-02) — `test-wallpaper-clear-of-lock-screen-buttons` (:320-326): Peggy Gou y la marca de las 01:00 terminan en 2404; `test-wallpaper-friday-complete` (:234) con los 30 shows del viernes
- ✅ AC-03 (RCA, NFR-02) — `test-wallpaper-legibility` (:348) y `test-wallpaper-every-show-has-time` (:441) sobre los 3 días (ver W-1)
- ✅ AC-04 (RCA, FR-01) — `test-wallpaper-clear-of-lock-screen-buttons` (:323): el bloque que termina al final del eje termina en 2404
- ✅ AC-08 (FEAT-004, FR-07) — `test-wallpaper-safe-zones` (:282) con `BAND_BOTTOM` derivado de `SAFE_BOTTOM` y el test de regresión con 2404 fijo

## Fix-plan steps
- ✅ Step 1 — `SAFE_BOTTOM = 392` con su comentario del 14 % (src/lib/wallpaper-layout.ts:22); el eje termina en 2404
- ✅ Step 2 — `BLOCK_PADDING_Y = 4` (src/lib/wallpaper-layout.ts:48) y los comentarios de 60 / 60,8 px (:46-47, :254)
- ✅ Step 3 — los números de `tests/unit/lib/wallpaper-layout.test.ts` pasan a 2404 y `block.y + 4`; los comentarios coinciden con el eje de 1555 px
- ✅ Step 4 — `AXIS_BOTTOM = 2404` en `tests/e2e/wallpaper.spec.ts:81`, con el comentario que cita el fix-plan

## Fix-plan tests
- ✅ Test 1 — regresión `test-wallpaper-clear-of-lock-screen-buttons`: rojo antes del fix (`expected 224 to be 392`, y por comportamiento sin esa aserción), verde después
- ✅ Test 2 — `test-wallpaper-safe-zones`, renombrado a y = 2404, pasa
- ✅ Test 3 — `test-wallpaper-legibility` y `test-wallpaper-every-show-has-time` pasan con la escala nueva
- ✅ Test 4 — `test-wallpaper-cramped-block-no-time`: el bloque recortado se dibuja sin horario (sad path, primera condición del fix-plan), pasa
- ✅ Test 5 — el test del día sin shows (`RangeError`, sad path, segunda condición del fix-plan), sin cambios, pasa
- ✅ Test 6 — `test-wallpaper-vertical-scale` y `test-wallpaper-ellipsis-wider-than-block` pasan con 2404 y 4 px
- ✅ Test 7 — E2E `tests/e2e/wallpaper.spec.ts` en los 4 proyectos dentro de la corrida del cierre de CODE: 251 pasan, 3 salteados con motivo
- ✅ Test 8 — lint, formato, tipos y `pnpm test` con los pisos de cobertura

## Tests
- ✅ Sad-path tests: `test-wallpaper-cramped-block-no-time` (bloque sin lugar para el horario) y el del día sin shows (Test 5), más los de entrada no confiable de FEAT-004 (`test-wallpaper-unknown-id-ignored`, `test-wallpaper-unknown-stage-skipped`)

## Warnings (no bloquean)
- W-1: no hay shows reales de 30 min; el piso de 70 px se prueba con bloques armados en `test-wallpaper-long-name-ellipsis` y con la fórmula de `test-wallpaper-vertical-scale`. Los shows reales de 45 min o más miden ≥ 97,2 px.
- W-2: `sun-kidzapalooza-1800` y `sun-kidzapalooza-1830` miden 60,79 px contra un mínimo de 60 para tener horario. Es aritmética fija sobre una grilla congelada, y `test-wallpaper-every-show-has-time` lo controla.
- W-3: el caso de 20 min de `test-wallpaper-cramped-block-no-time` queda a 1,19 px de su umbral; hay que retocarlo si cambia la escala.
- W-4: la rama sale de `a387f98`, antes del merge de FIX-002 a `main`; `git merge-tree` no da conflictos y la CI del PR corre sobre el merge.
- W-5: `tests/e2e/wallpaper.spec.ts:76` es un comentario de 114 caracteres; `format:check` pasa.

Result: PASSED
