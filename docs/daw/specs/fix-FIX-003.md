# Fix-plan FIX-003: Despejar la linterna y la cámara en el fondo de pantalla

| Field | Value |
|-------|-------|
| Ticket | FIX-003 |
| Tier | FIX |
| RCA | docs/daw/specs/rca-FIX-003.md |
| PRD | docs/daw/prd/prd-FEAT-004.md (FR-07, AC-08, actualizados en DEFINE) |
| Date | 2026-11-18 |
| Spec loops | 0 |
| Loops since last human decision | 0 |

## Problem

En la pantalla de bloqueo del iPhone, la linterna y la cámara tapan la última hora de la grilla
del fondo de pantalla (en el viernes, de 00:00 a 01:00, con Peggy Gou). Los botones empiezan a
≈ 347 px del borde inferior del PNG de 1290 × 2796, y la grilla llega hasta 224 px del borde.

## Root cause

`SAFE_BOTTOM = 224` en `src/lib/wallpaper-layout.ts` implementa el 8 % inferior que pedía FR-07 de
FEAT-004, y ese 8 % no salió de medir una pantalla de bloqueo real. El eje de horas termina en
`WALLPAPER_HEIGHT - SAFE_BOTTOM` = 2572, ≈ 123 px por debajo del borde superior de los botones
(detalle y medición en el RCA).

## Solution — steps

1. `src/lib/wallpaper-layout.ts:17-19` — `SAFE_BOTTOM` pasa de 224 a 392 (el 14 % de 2796, 391,4,
   redondeado hacia arriba), y su comentario dice "14 %". El eje pasa a ir de y = 849 a y = 2404
   (1555 px): 2,16 px/min. `AXIS_TOP`, `HEADER_HEIGHT`, `MIN_BLOCK_HEIGHT` (70) y el resto del
   layout no cambian. Un show de 30 min mide ≈ 64,8 px de alto natural y el piso de 70 px lo sigue
   llevando a 70 (NFR-02 de FEAT-004): en los 3 días, ningún show de 30 min o más queda bajo 70 px.
2. `src/lib/wallpaper-layout.ts:43-45` — `BLOCK_PADDING_Y` pasa de 6 a 4. Motivo: el bloque real
   más corto, domingo en Kidzapalooza de 18:00 a 18:20 (recortado por el show de 18:30), baja de
   ≈ 67,8 a ≈ 60,8 px, y una línea de artista y el horario necesitan 2 × padding + 30 + 22: con 6
   son 64 px y pierde el horario; con 4 son 60 px y entra. Se actualizan los comentarios que citan
   64 / 67,8 / 52 px (líneas 41-44 y la de `blockTexts`, ≈ 251).
3. `tests/unit/lib/wallpaper-layout.test.ts` — los 2572 fijos pasan a 2404 (líneas 234, 503, 510 y
   517, y el nombre del test de la línea 282); `toBe(block.y + 6)` de la línea 411 pasa a
   `block.y + 4`; los comentarios con medidas derivadas se corrigen: línea 384 (45 min ≈ 97,2 px),
   501 (≈ 43,2 − 4 ≈ 39,2 px) y 508 (≈ 6,5 − 4 ≈ 2,5 px). Se agrega el test de regresión de abajo.
4. `tests/e2e/wallpaper.spec.ts:73-80` — `AXIS_BOTTOM` pasa de 2572 a 2404, y el comentario cita
   como fuente este fix-plan además de `spec-FEAT-004.md`.

Fuera del código, ya hecho en esta fase: `docs/daw/specs/decisions-FEAT-004.md` suma una
corrección con fecha que reemplaza las cifras de `spec-FEAT-004.md` (líneas 32, 34, 36, 124, 147 y
199). `spec-FEAT-004.md` queda como registro histórico de FEAT-004 y no se reescribe.

Quedan como están: `prd-DISC-001-04.md`, el PRD de origen ya convertido en `prd-FEAT-004.md`, y el
informe `docs/daw/reports/verify-FEAT-004.md`, que es histórico. `prd-DISC-001-07.md` (AC-07, fondo
del grupo) todavía dice 224 px: se corrige en el DEFINE de su propio ticket, porque PLAN no puede
tocar un PRD y ese PRD todavía no se implementó.

## Dependencies between steps

Los pasos 1 y 2 van juntos: con el paso 1 solo, el bloque de domingo 18:00 pierde su horario y
`test-wallpaper-every-show-has-time` falla. El paso 3 depende de los dos y el paso 4, del 1.

## Error handling

El fix no agrega condiciones de error; solo cambia dos constantes. Las dos que ya tiene el layout
siguen igual y sus tests se ajustan a la escala nueva:
- Un bloque recortado por el show siguiente sin lugar para el horario — se dibuja sin el horario y,
  si no entra ni una línea, sin el nombre (`time: null`, `lines: []`); nunca se dibuja texto fuera
  del bloque.
- Un día sin shows — `dayAxis` lanza `RangeError` y el botón muestra su mensaje de error genérico.

## Tests

- [ ] **Regression test** — `test-wallpaper-clear-of-lock-screen-buttons`: `SAFE_BOTTOM` es 392 y,
      en los 3 días, ningún bloque ni marca de hora termina debajo de y = 2404; en el viernes, Peggy
      Gou (23:30–01:00) y la marca de las 01:00 terminan en y ≤ 2404. Falla ANTES del fix (con 224,
      el eje llega a 2572) y pasa DESPUÉS. Valida AC-01, AC-02 y AC-04 del RCA.
- [ ] `test-wallpaper-safe-zones`, renombrado a "… ends below y = 2404", sigue pasando con
      `BAND_BOTTOM` derivado de `SAFE_BOTTOM`.
- [ ] `test-wallpaper-legibility` y `test-wallpaper-every-show-has-time` pasan con la escala nueva:
      el domingo, el artista mide 28 px, todo show de 30 min o más mide ≥ 70 px y cada bloque real
      tiene su horario adentro (AC-03 del RCA).
- [ ] `test-wallpaper-cramped-block-no-time` sigue rechazando el horario de un bloque recortado
      (sad path, error 1), con 2404 en su cuenta.
- [ ] `test-wallpaper-empty-day-error`: un día sin shows lanza `RangeError` (sad path, error 2),
      sin cambios.
- [ ] `test-wallpaper-vertical-scale` y `test-wallpaper-ellipsis-wider-than-block` pasan con
      2404 y con el padding de 4 px.
- [ ] El E2E `tests/e2e/wallpaper.spec.ts` pasa con `AXIS_BOTTOM = 2404` (las sondas leen el
      color del bloque en su nueva posición).
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` pasan, con los pisos de
      cobertura.

## Regression risk

Bajo. Cambian dos constantes de un módulo puro, sin cambios de firma ni de exports. Lo que se puede
romper:
- Que con otro dato de la grilla un bloque recortado quede entre 60 y 64 px y pierda el horario: el
  bloque real más corto queda a 0,8 px del mínimo. Lo cubre `test-wallpaper-every-show-has-time`,
  que corre sobre los datos reales.
- Que el texto del artista quede 2 px más cerca del borde de arriba del bloque: es un cambio
  visual menor que se revisa en el iPhone.

## Rollback plan *(mandatory)*

- Steps: trivial, revertir el commit del fix (vuelven `SAFE_BOTTOM = 224` y `BLOCK_PADDING_Y = 6`)
  y la corrección de `decisions-FEAT-004.md`; el PRD de FEAT-004 vuelve con un revert del commit de
  DEFINE.
- Indicators: en el iPhone, la grilla queda demasiado arriba o demasiado chica; algún bloque pierde
  su horario o su nombre; los textos se ven pegados al borde superior del bloque.
