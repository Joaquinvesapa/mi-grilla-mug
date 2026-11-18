# ADR-004: Sin conexión con una copia en el dispositivo

| Field | Value |
|-------|-------|
| Date | 2026-11-17 |
| Ticket | FEAT-003b |
| Status | Accepted |

## Context

FEAT-003b (`docs/daw/prd/prd-FEAT-003b.md`) pide ver la grilla y la selección sin señal, guardar
sin señal y sincronizar solo al volver la conexión. ADR-002 eligió Serwist pensando en esto, pero el
service worker de FEAT-001 no cachea nada en tiempo de ejecución, y el test R-17
(`tests/e2e/pwa.spec.ts`) exige que ninguna caché guarde `/`, `/login` ni `/register`: `/` es una
página por usuario. Además, iOS Safari no implementa Background Sync, así que un reintento en
segundo plano no llega al iPhone, el dispositivo para el que se pensó la app.

## Options considered

### Option 1: copia en `localStorage` y la pantalla `/~offline` precacheada
- **Pros:** el HTML cacheado sigue sin datos de nadie y R-17 se mantiene; los datos van con su dueño
  (`userId`), lo que resuelve FR-06; no suma dependencias; funciona igual en WebKit y Chromium.
- **Cons:** la copia queda en texto plano en el dispositivo; la sincronización solo ocurre con la app
  abierta; suma un helper de cliente con I/O que no encaja en `src/lib/` ni en `src/server/`.

### Option 2: caché del service worker (NetworkFirst sobre `/`) y Background Sync
- **Pros:** la página completa queda disponible sin conexión sin cambiar la pantalla; el reintento lo
  hace el navegador aunque la app esté cerrada.
- **Cons:** cachea una página con el nombre y la selección de un usuario, servible a otro (rompe
  R-17 y FR-06); Background Sync no existe en iOS; los guardados sin señal igual necesitan
  almacenamiento propio.

## Decision

Se eligió la opción 1. El service worker sigue como lo dejó ADR-002, y `/~offline` arma la grilla
desde la copia del dispositivo cuando la URL que falló es `/`. El almacenamiento es `localStorage`
y no IndexedDB: los datos son unos pocos KB (91 shows) y la API sincrónica simplifica la lectura al
montar. El acceso vive en `src/components/device-store.ts`, junto a la UI que lo usa, y la
validación pura en `src/lib/offline-selection.ts`. La copia se conserva hasta cerrar sesión, hasta
que entre otra cuenta o hasta pasar por `/login` o `/register`, sin vencimiento (decisión del
usuario, 2026-11-17).

## Consequences

- ADR-002 queda complementado: el service worker sigue sin cachear datos; los datos sin conexión
  viven fuera de él.
- Archivos: `src/lib/offline-selection.ts`, `src/components/device-store.ts`,
  `src/components/offline-app.tsx`, `src/app/~offline/page.tsx`, `src/components/schedule-screen.tsx`,
  `src/app/selection-actions.ts` (detalle en `docs/daw/specs/spec-FEAT-003b.md`).
- `src/components/` pasa a admitir helpers de cliente con acceso al almacenamiento del navegador
  (AGENTS.md, estructura de carpetas).
- Riesgos aceptados: si iOS borra los datos de la PWA, la selección pendiente se pierde (PRD,
  Risks); sin conexión, la copia se muestra sin verificar sesión
  (`docs/daw/security/threat-FEAT-003b.md`, R-03).
