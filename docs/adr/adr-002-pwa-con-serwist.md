# ADR-002: PWA con Serwist

| Field | Value |
|-------|-------|
| Date | 2026-11-16 |
| Ticket | FEAT-001 |
| Status | Accepted |

## Context

El PRD de FEAT-001 pide tres cosas que necesitan un service worker: que la app se instale en el
iPhone, que muestre una pantalla propia cuando no hay conexión y que sirva de base para el PRD 03,
donde la grilla y la selección se leen y se guardan sin conexión. Next.js 16 compila por defecto con
Turbopack, y `next-pwa`, la librería clásica para esto, dejó de mantenerse.

## Options considered

### Option 1: Serwist (`serwist` y `@serwist/turbopack` 9.5)
- **Pros:**
  - Es el sucesor mantenido de `next-pwa` y tiene integración con Turbopack.
  - Resuelve el precache y la página de respaldo sin conexión.
  - Trae las estrategias de caché (red primero, caché primero) y la sincronización en segundo
    plano que el PRD 03 va a necesitar.
- **Cons:**
  - Suma una dependencia.
  - Su integración con la compilación agrega configuración en `next.config.ts`.

### Option 2: un service worker escrito a mano
- **Pros:**
  - No suma dependencias.
  - Todo el código está a la vista.
- **Cons:**
  - Hay que escribir y mantener el precache, el versionado y la limpieza de cachés viejas.
  - El modo sin conexión del PRD 03, con cola de sincronización, también hay que hacerlo de cero.
    Es justo el código con más casos borde.

## Decision

Opción 1, elegida por el usuario el 2026-11-16. Lo que cuesta del modo sin conexión (precache,
estrategias de caché y reintentos) ya está resuelto y probado. Además, el mismo mecanismo sirve para
este ticket y para el PRD 03.

## Consequences

- Archivos nuevos: `src/app/sw.ts` (service worker) y la configuración de Serwist en
  `next.config.ts`.
- En FEAT-001, el service worker precachea la página `/~offline` y la usa como respaldo de
  navegación. Todavía no cachea datos.
- El service worker solo corre en el build de producción. Los tests E2E que lo usan corren contra
  `next build` + `next start`, no contra el servidor de desarrollo.
- iOS limita el almacenamiento y la sincronización en segundo plano de las PWAs. Eso pesa recién en
  el PRD 03, que decide cómo resolverlo.
