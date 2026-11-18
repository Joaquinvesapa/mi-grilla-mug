# ADR-005: El fondo de pantalla se dibuja en el cliente

| Field | Value |
|-------|-------|
| Date | 2026-11-18 |
| Ticket | FEAT-004 |
| Status | Accepted |

## Context

FEAT-004 (`docs/daw/prd/prd-FEAT-004.md`) pide una imagen de 1290 × 2796 de la grilla de un día,
generada también sin conexión (FR-10) y con la selección que se ve en pantalla, incluidos los
cambios sin guardar y la selección pendiente de sincronizar (FR-09). Esa selección vive solo en el
navegador (ADR-004). En un iPhone la imagen tiene que terminar en Fotos (FR-11), y una PWA no
escribe en Fotos: lo hace la hoja de compartir del sistema.

## Options considered

### Option 1: dibujarla en el cliente con Canvas 2D
- **Pros:** funciona sin conexión; lee la selección en pantalla sin mandarla al servidor; no suma
  dependencias; reusa el eje de `src/lib/schedule-layout.ts`.
- **Cons:** hay que escribir a mano el dibujo y el corte de texto; el resultado depende del motor
  de canvas de cada navegador.

### Option 2: generarla en el servidor con `next/og`
- **Pros:** el proyecto ya lo usa para los íconos; una sola salida para todos los navegadores.
- **Cons:** no anda sin conexión; el servidor no conoce los cambios sin guardar ni la selección
  pendiente, y habría que mandárselos.

### Option 3: capturar el DOM con una librería (html-to-image o similar)
- **Pros:** reusa los estilos de la grilla.
- **Cons:** dependencia nueva; la grilla de la app no tiene el formato ni las zonas libres de la
  imagen; en WebKit esas librerías fallan con tipografías y `foreignObject`.

## Decision

Se eligió la opción 1. Es la única que cumple FR-09 y FR-10 a la vez sin sacar datos del
dispositivo. La geometría quedó como función pura en `src/lib/` y el dibujo en `src/components/`.
Para entregarla, en pantallas táctiles con `navigator.canShare({ files })` se usa la hoja de
compartir, desde un botón que el usuario toca después de generarla, porque WebKit pide un gesto
reciente. En el resto de los casos se usa una descarga con nombre `mi-grilla-<día>.png`.

## Consequences

- Archivos nuevos: `src/lib/wallpaper-layout.ts`, `src/components/wallpaper-canvas.ts` y
  `src/components/wallpaper-button.tsx`. `src/lib/palette.ts` suma los colores que usa el canvas.
- Guardar en Fotos y el tiempo en un iPhone 12 (AC-01, AC-15) solo se verifican a mano: en CI,
  WebKit no tiene hoja de compartir.
- El fondo del grupo (PRD 07) reusa el mismo layout.
