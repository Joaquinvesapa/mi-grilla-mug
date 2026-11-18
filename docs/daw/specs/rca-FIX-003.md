# RCA FIX-003: Despejar la linterna y la cámara en el fondo de pantalla

| Field | Value |
|-------|-------|
| Ticket | FIX-003 |
| Tracker | none |
| Date | 2026-11-18 |
| PRD loops | 0 |
| Loops since last human decision | 0 |
| PRD relacionado | `docs/daw/prd/prd-FEAT-004.md` (FR-07, AC-08), actualizado en este ticket |

## Context and Problem

El usuario puso como fondo de pantalla de bloqueo, en su iPhone, la imagen del viernes que genera
la app (1290 × 2796 px). En la captura, los botones de la linterna y la cámara tapan la última hora
de la grilla: la franja de 00:00 a 01:00, con Peggy Gou (23:30–01:00) en Samsung. Los botones no se
pueden esquivar de costado: la linterna cae sobre las columnas de Flow y Samsung, y la cámara sobre
las de Perry's y Kidzapalooza.

Medido sobre la captura, llevado a la escala del PNG (≈ 0,921):

| Elemento | Desde arriba | Desde abajo |
|---|---|---|
| Fin de la zona de la grilla (línea de 01:00) | ≈ 2572 px | 224 px (8 %) |
| Borde superior de la linterna y la cámara | ≈ 2449 px | ≈ 347 px (12,4 %) |
| Barra de inicio | ≈ 2760 px | ≈ 36 px |

Arriba no hay problema: el reloj termina en ≈ 640 px y la zona libre llega a 699 px.

### Causa raíz

El requisito estaba mal dimensionado. FR-07 de `prd-FEAT-004.md` fijaba la zona libre de abajo en
el 8 % (224 px), y el código lo cumple al pie de la letra: `SAFE_BOTTOM = 224` en
`src/lib/wallpaper-layout.ts`, y la zona de la grilla termina en `WALLPAPER_HEIGHT - SAFE_BOTTOM`
= 2572 px. Ese 8 % no salió de medir una pantalla de bloqueo real. En el iPhone, la linterna y la
cámara ocupan desde ≈ 347 px del borde inferior, así que los ≈ 123 px entre 2449 y 2572 quedan
debajo de los botones.

Componente afectado: el armado del fondo de pantalla (`src/lib/wallpaper-layout.ts`) y sus tests
unitarios. No cambia nada del servidor ni de la base.

Hueco en el PRD: sí. FR-07 y AC-08 pedían el 8 % inferior. Se actualizaron con la decisión del
usuario (2026-11-18): el 14 % inferior, 392 px (el 14 % de 2796 da 391,4, redondeado hacia
arriba). Deja ≈ 45 px de aire sobre los botones.

## Goals

- Que en la pantalla de bloqueo ningún show ni marca de hora quede debajo de la linterna o la
  cámara.
- Que la grilla siga entrando completa y legible entre las dos zonas libres.

## Functional Requirements

- FR-01: La imagen no tiene bloques de shows ni marcas de hora en los 392 px inferiores (14 %).
- FR-02: La imagen sigue mostrando todos los shows del día y las marcas de hora de todo el rango
  del día entre las dos zonas libres.

## Non-Functional Requirements

- NFR-01: La zona libre inferior mide 392 px de una imagen de 2796 px y deja al menos 40 px entre
  la grilla y el borde superior de la linterna y la cámara (≈ 347 px desde abajo).
- NFR-02: Los mínimos de legibilidad de NFR-02 de FEAT-004 se siguen cumpliendo: el nombre de
  artista mide al menos 28 px de alto y un show de 30 minutos, al menos 70 px de alto.

## Acceptance Criteria

- AC-01 (FR-01, NFR-01): WHEN se genera la imagen de cualquier día, THE imagen SHALL no tener
  bloques de shows ni marcas de hora en los 392 px inferiores.
- AC-02 (FR-02): WHEN se genera la imagen del viernes, THE imagen SHALL mostrar a Peggy Gou
  (23:30–01:00) y la marca de las 01:00 por encima de los 392 px inferiores.
- AC-03 (NFR-02): WHEN se genera la imagen del domingo, el día más largo, THE nombre de artista
  SHALL medir al menos 28 px de alto y un show de 30 minutos SHALL medir al menos 70 px de alto.
- AC-04 (FR-01): IF un show termina justo al final del rango del día, THEN THE imagen SHALL dibujar
  su bloque terminando por encima de los 392 px inferiores.

## Out of Scope

- Cambiar la zona libre de arriba (25 %, 699 px): en la captura el reloj termina antes.
- Ajustar la imagen por modelo de iPhone: sigue siendo una sola imagen de 1290 × 2796 px (FR-02 de
  FEAT-004).
- Cambiar los colores, la tipografía o el contenido de la imagen.
- El fondo de pantalla del grupo (PRD 07), que todavía no existe.

## Risks and Mitigations

- **La grilla pierde ≈ 168 px de alto** (de 1723 a 1555 px de eje): los bloques quedan ≈ 10 % más
  bajos y los shows cortos pegados al siguiente en su escenario pueden quedar debajo de los 70 px
  de NFR-02 de FEAT-004. → El fix-plan revisa la altura del encabezado y los mínimos de bloque, y
  AC-03 lo verifica sobre el domingo.
- **Otros modelos de iPhone pueden poner los botones un poco más arriba o más abajo** en una imagen
  de 1290 × 2796. → Los ≈ 45 px de aire del 14 % cubren esa diferencia; el usuario lo revisa en su
  iPhone antes de cerrar el ticket.

## Dependencies

- `prd-FEAT-004.md` (FR-07, AC-08), actualizado en este ticket.
- FEAT-004: el armado del fondo de pantalla, ya en `main`.
