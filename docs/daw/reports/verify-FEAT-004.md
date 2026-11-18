# Verification FEAT-004

## Ronda 1 — 2026-11-18 (HEAD bf5815a) — BLOCKED

| Field | Value |
|---|---|
| Module | src/lib/wallpaper-layout.ts, src/lib/wallpaper-messages.ts, src/lib/palette.ts, src/components/wallpaper-canvas.ts, src/components/wallpaper-delivery.ts, src/components/wallpaper-button.tsx, src/components/day-picker.tsx, src/components/schedule-screen.tsx, src/lib/selection-messages.ts |
| Line coverage | 99.3% |
| Branch coverage | 94.44% |
| Function coverage | 98.89% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing"); F-VER-03 pide 80% en los tres sobre el código nuevo |
| Lint | `pnpm lint` (oxlint --type-aware) — clean; `pnpm typecheck` — 0 errores; `pnpm format:check` — OK |

Cobertura medida sobre los 9 archivos de `src/` del ticket con `vitest run --project unit --coverage`.
La verificación cruzada la hizo `daw-module-verifier`, que no escribió el código.

### Acceptance criteria
- ✅ AC-01 — `test-wallpaper-button-share-flow`, `test-delivery-can-share`, `test-e2e-wallpaper-share`. Queda pendiente la prueba manual en un iPhone real (M-1).
- ✅ AC-02 — `test-wallpaper-file-name`, `test-delivery-download-name`, `test-wallpaper-button-download-flow`, `test-e2e-wallpaper-download`
- ✅ AC-03 — `test-wallpaper-size`, `test-render-wallpaper-png`, `test-e2e-wallpaper-share`
- ✅ AC-04 — `test-wallpaper-friday-complete`, `test-wallpaper-every-show-has-time`
- ✅ AC-05 — `test-wallpaper-lit-selected`, `test-render-wallpaper-dimmed`, `test-e2e-wallpaper-share`
- ✅ AC-06 — `test-wallpaper-none-selected-all-lit`, `test-e2e-wallpaper-download`
- ✅ AC-07 — `test-wallpaper-colors-contrast`, `test-render-wallpaper-dimmed`
- ✅ AC-08 — `test-wallpaper-safe-zones`, `test-render-wallpaper-png`
- ✅ AC-09 — `test-wallpaper-title-brand`, `test-e2e-wallpaper-download`
- ✅ AC-10 — `test-schedule-screen-wallpaper-unsaved`, `test-e2e-wallpaper-unsaved`
- ✅ AC-11 — `test-schedule-screen-wallpaper-pending`, `test-e2e-wallpaper-offline-pending`
- ✅ AC-12 — `test-wallpaper-button-offline`, `test-e2e-wallpaper-offline-pending`
- ✅ AC-13 — `test-wallpaper-button-share-flow`, `test-wallpaper-button-download-flow`, `test-e2e-wallpaper-share`
- ✅ AC-14 — `test-wallpaper-legibility`, `test-e2e-wallpaper-share` (≤ 5 MB)
- ✅ AC-15 — `test-e2e-wallpaper-time` (113 ms en iphone-webkit, como referencia). Queda pendiente la medición en un iPhone 12 real (M-2).

### Spec blocks
- ✅ Block 1 — sus 15 tests requeridos existen con su nombre y pasan: `test-wallpaper-size`, `test-wallpaper-friday-complete`, `test-wallpaper-lit-selected`, `test-wallpaper-none-selected-all-lit`, `test-wallpaper-colors-contrast`, `test-wallpaper-safe-zones`, `test-wallpaper-title-brand`, `test-wallpaper-legibility`, `test-wallpaper-long-name-ellipsis`, `test-wallpaper-unknown-id-ignored`, `test-wallpaper-unknown-stage-skipped`, `test-wallpaper-empty-day-error`, `test-wallpaper-file-name`, `test-wallpaper-messages-unknown-code`, `test-palette-sync`
- ✅ Block 2 — sus 10 tests requeridos existen con su nombre y pasan: `test-render-wallpaper-png`, `test-render-wallpaper-dimmed`, `test-render-wallpaper-font-family`, `test-render-wallpaper-context-unsupported-error`, `test-render-wallpaper-encode-failed-error`, `test-render-wallpaper-font-missing`, `test-delivery-can-share`, `test-delivery-download-name`, `test-delivery-share-cancelled`, `test-delivery-share-failed-error`
- ✅ Block 3 — sus 10 tests requeridos existen con su nombre y pasan: `test-wallpaper-button-share-flow`, `test-wallpaper-button-download-flow`, `test-wallpaper-button-share-cancelled`, `test-wallpaper-button-share-failed-error`, `test-wallpaper-button-render-failed-error`, `test-wallpaper-button-stale-result-rejected`, `test-wallpaper-button-offline`, `test-day-picker-action`, `test-schedule-screen-wallpaper-unsaved`, `test-schedule-screen-wallpaper-pending`
- ✅ Block 4 — sus 7 tests requeridos existen con su nombre y pasan: `test-e2e-wallpaper-share`, `test-e2e-wallpaper-download`, `test-e2e-wallpaper-unsaved`, `test-e2e-wallpaper-offline-pending`, `test-e2e-wallpaper-share-rejected-error`, `test-e2e-wallpaper-time`, `test-e2e-wallpaper-tap-target`

### Tests
- ❌ Sad-path tests (F-VER-04): `wallpaperFileName` (`src/lib/wallpaper-layout.ts:376`) solo tiene el caso feliz. Nada prueba la normalización a `[a-z0-9-]` ni un nombre sin alfanuméricos, que hoy da `mi-grilla-.png`. Las demás funciones con entrada tienen su camino triste (`wallpaperLayout`, `wallpaperMessageFor`, `renderWallpaper`, `canShareFile`, `shareWallpaper`, `downloadWallpaper`, `WallpaperButton`).

### Warnings (no bloquean)
- **W-1:** ningún test unitario verifica la `y` ni el alto proporcional de cada bloque. Solo las sondas E2E lo cubren, sobre unos pocos shows.
- **W-2:** el paso 1 de la guía ("Abrí Fotos…") también se muestra después de "Descargar imagen". En un iPhone, por ese camino, el PNG va a Archivos y no a Fotos. Además, el respaldo de mantener apretada la vista previa nunca se le dice a la persona.
- **W-3:** el paso que pide desactivar el zoom de perspectiva (riesgo del PRD) no tiene test y no dice dónde está el ajuste.
- **W-4:** `test-wallpaper-button-offline` es superficial: el componente no lee `navigator.onLine`. La evidencia real de AC-12 es el E2E.
- **W-5 (W-VER-01):** hay exports sin consumidores fuera de su archivo: `HEADER_HEIGHT`, `TIME_FONT_SIZE`, `AXIS_TOP`, `AXIS_BOTTOM`, y algunos tipos de layout y del botón.
- **W-6:** la descarga "desde una computadora" se prueba en E2E quitando Web Share en los proyectos mobile. La regla `pointer: fine` → descarga solo tiene test unitario.
- **W-7:** el peso del PNG se mide en E2E con viernes y sábado, no con el domingo. Además, "28 px de alto" se interpretó como tamaño de fuente.
- **W-8:** R-04 del threat model nombra el código `FONT_UNAVAILABLE`, que no existe (se reemplazó por `fontFallback`). Es un artefacto de PLAN y queda registrado en las decisiones.
- **W-9 (W-VER-03):** tests que dependen de detalles internos: el helper de Vaul depende de nombres internos de animación, el oráculo de píxeles depende de `schedule.json`, y el test de tiempo de su umbral.
- **W-10 (W-VER-02):** `wallpaper-layout.ts` tiene 88,57 % de ramas. Quedan sin cubrir `maxLines = 0` y el camino sin horario.
- **W-11:** la verificación cruzada no vio la evidencia TDD. Está en `.daw-work/review-block-1..4.md` y en los informes de cada bloque.

### Pending manual verification
- **M-1 (AC-01):** en un iPhone real, "Guardar en Fotos" deja la imagen en Fotos.
- **M-1, en el mismo iPhone, además:**
  - la guía se entiende con iOS en español;
  - VoiceOver no anuncia dos veces el error;
  - en modo avión, la imagen se genera igual.
- **M-1, en una computadora:** en Safari, la descarga no se cancela por el revoke a 0 ms.
- **M-2 (AC-15):** en un iPhone 12 o más nuevo, la imagen está lista en 3 segundos o menos.

Result: BLOCKED — vuelve a CODE por F-VER-04, y en la misma vuelta se corrigen W-2, W-3, W-5 y W-10.

## Ronda 2 — 2026-11-18 (HEAD 5355679, código en 4b4cc2a) — PASSED (automatizado)

Vuelta después del ciclo de corrección en CODE (`4b4cc2a`) y del re-cierre (`5355679`: tests
719/0/3, SAST PASSED). La corrección la revisaron `daw-module-verifier` y `daw-arch-auditor`, y los
dos dieron PASS.

| Field | Value |
|---|---|
| Module | src/lib/wallpaper-layout.ts, src/lib/wallpaper-messages.ts, src/lib/palette.ts, src/components/wallpaper-canvas.ts, src/components/wallpaper-delivery.ts, src/components/wallpaper-button.tsx, src/components/day-picker.tsx, src/components/schedule-screen.tsx, src/lib/selection-messages.ts |
| Line coverage | 99.53% |
| Branch coverage | 96.15% |
| Function coverage | 98.89% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing"); F-VER-03 pide 80% en los tres sobre el código nuevo |
| Lint | `pnpm lint` (oxlint --type-aware) — clean; `pnpm typecheck` — 0 errores; `pnpm format:check` — OK |

### Acceptance criteria
- ✅ AC-01 — `test-wallpaper-button-share-flow`, `test-delivery-can-share`, `test-e2e-wallpaper-share`. Queda pendiente la prueba manual en un iPhone real (M-1).
- ✅ AC-02 — `test-wallpaper-file-name`, `test-wallpaper-file-name-invalid`, `test-delivery-download-name`, `test-wallpaper-button-download-flow`, `test-e2e-wallpaper-download`
- ✅ AC-03 — `test-wallpaper-size`, `test-render-wallpaper-png`, `test-e2e-wallpaper-share`
- ✅ AC-04 — `test-wallpaper-friday-complete`, `test-wallpaper-every-show-has-time`, `test-wallpaper-vertical-scale`
- ✅ AC-05 — `test-wallpaper-lit-selected`, `test-render-wallpaper-dimmed`, `test-e2e-wallpaper-share`
- ✅ AC-06 — `test-wallpaper-none-selected-all-lit`, `test-e2e-wallpaper-download`
- ✅ AC-07 — `test-wallpaper-colors-contrast`, `test-render-wallpaper-dimmed`
- ✅ AC-08 — `test-wallpaper-safe-zones`, `test-render-wallpaper-png`
- ✅ AC-09 — `test-wallpaper-title-brand`, `test-e2e-wallpaper-download`
- ✅ AC-10 — `test-schedule-screen-wallpaper-unsaved`, `test-e2e-wallpaper-unsaved`
- ✅ AC-11 — `test-schedule-screen-wallpaper-pending`, `test-e2e-wallpaper-offline-pending`
- ✅ AC-12 — `test-wallpaper-button-offline`, `test-e2e-wallpaper-offline-pending`
- ✅ AC-13 — `test-wallpaper-button-share-flow`, `test-wallpaper-button-download-flow`, `test-wallpaper-guide-delivery`, `test-e2e-wallpaper-share`
- ✅ AC-14 — `test-wallpaper-legibility`, `test-e2e-wallpaper-share` (≤ 5 MB)
- ✅ AC-15 — `test-e2e-wallpaper-time` (113 ms en iphone-webkit, como referencia). Queda pendiente la medición en un iPhone 12 real (M-2).

### Spec blocks
- ✅ Block 1 — sus 15 tests requeridos existen con su nombre y pasan: `test-wallpaper-size`, `test-wallpaper-friday-complete`, `test-wallpaper-lit-selected`, `test-wallpaper-none-selected-all-lit`, `test-wallpaper-colors-contrast`, `test-wallpaper-safe-zones`, `test-wallpaper-title-brand`, `test-wallpaper-legibility`, `test-wallpaper-long-name-ellipsis`, `test-wallpaper-unknown-id-ignored`, `test-wallpaper-unknown-stage-skipped`, `test-wallpaper-empty-day-error`, `test-wallpaper-file-name`, `test-wallpaper-messages-unknown-code`, `test-palette-sync`
- ✅ Block 2 — sus 10 tests requeridos existen con su nombre y pasan: `test-render-wallpaper-png`, `test-render-wallpaper-dimmed`, `test-render-wallpaper-font-family`, `test-render-wallpaper-context-unsupported-error`, `test-render-wallpaper-encode-failed-error`, `test-render-wallpaper-font-missing`, `test-delivery-can-share`, `test-delivery-download-name`, `test-delivery-share-cancelled`, `test-delivery-share-failed-error`
- ✅ Block 3 — sus 10 tests requeridos existen con su nombre y pasan: `test-wallpaper-button-share-flow`, `test-wallpaper-button-download-flow`, `test-wallpaper-button-share-cancelled`, `test-wallpaper-button-share-failed-error`, `test-wallpaper-button-render-failed-error`, `test-wallpaper-button-stale-result-rejected`, `test-wallpaper-button-offline`, `test-day-picker-action`, `test-schedule-screen-wallpaper-unsaved`, `test-schedule-screen-wallpaper-pending`
- ✅ Block 4 — sus 7 tests requeridos existen con su nombre y pasan: `test-e2e-wallpaper-share`, `test-e2e-wallpaper-download`, `test-e2e-wallpaper-unsaved`, `test-e2e-wallpaper-offline-pending`, `test-e2e-wallpaper-share-rejected-error`, `test-e2e-wallpaper-time`, `test-e2e-wallpaper-tap-target`

### Tests
- ✅ Sad-path tests (F-VER-04): `test-wallpaper-file-name-invalid` cubre nombres con espacios, signos, tildes, `../` y sin alfanuméricos (dan `mi-grilla.png`). El resto de las funciones con entrada ya tenía su camino triste (ronda 1).

### Resuelto desde la ronda 1
- F-VER-04, en `4b4cc2a`.
- W-2: la guía tiene una variante por camino (`WALLPAPER_GUIDE_STEPS.share` / `.download`), y el error de compartir ofrece mantener apretada la vista previa.
- W-3: el paso del zoom dice dónde está el ajuste («⋯» y «Zoom de perspectiva»), con aserción.
- W-5: se sacaron los exports que nadie importaba.
- W-10: `wallpaper-layout.ts` pasa de 88,57 % a 97,29 % de ramas.
- W-1: `test-wallpaper-vertical-scale` comprueba la `y` y el alto de todos los shows de los 3 días.

### Warnings (no bloquean)
- W-4, W-6, W-7, W-8 y W-9 de la ronda 1 siguen igual. Están aceptados y registrados en `docs/daw/specs/decisions-FEAT-004.md`.
- **Desvío de forma:** `WALLPAPER_GUIDE_STEPS` ahora es un objeto con dos listas de 4, no una sola lista como dice la spec. Lo pidió W-2 y el contenido de la spec se sigue cumpliendo.
- **Texto:** el paso 1 de la descarga es largo (tres oraciones). Se revisa en el iPhone (M-1).

### Pending manual verification
- **M-1 (AC-01):** en un iPhone real, "Guardar en Fotos" deja la imagen en Fotos.
- **M-1, en el mismo iPhone, además:**
  - los textos de la guía coinciden con iOS en español («Usar como fondo de pantalla», «⋯», «Zoom de perspectiva», «Agregar»);
  - mantener apretada la vista previa ofrece guardar la imagen;
  - VoiceOver no anuncia dos veces el error;
  - en modo avión, la imagen se genera igual.
- **M-1, en una computadora:** en Safari, la descarga no se cancela.
- **M-2 (AC-15):** en un iPhone 12 o más nuevo, la imagen está lista en 3 segundos o menos.

Result: PASSED — la parte automatizada. M-1 y M-2 quedan a cargo del usuario antes de pasar a CLOSEOUT.

## Ronda 3 — 2026-11-18 — verificación manual

Ante el pedido de las pruebas manuales M-1 y M-2 (pasos 1 a 7), el usuario respondió «Bien» y pidió
pasar a commit, PR y merge. No detalló el resultado de cada paso, así que no quedan registrados por
separado: la aprobación para cerrar el ticket es del usuario, con esa respuesta.

Result: PASSED
