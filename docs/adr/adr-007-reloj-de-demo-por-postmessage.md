# ADR-007: El reloj simulado de /demo llega a la app del iframe por postMessage

| Field | Value |
|-------|-------|
| Date | 2026-11-18 |
| Ticket | FEAT-005b |
| Status | Accepted |

## Context
FEAT-005b (`docs/daw/prd/prd-FEAT-005b.md`) pide un reloj simulado en `/demo` que la app del iPhone
usa para "En vivo" y para el día inicial de la grilla. La app corre en un iframe del mismo origen
(`src/components/iphone-frame.tsx`, `src="/"`). FEAT-005a (FR-14, AC-15) y `AGENTS.md` prohíben que
la hora simulada exista fuera de `/demo`: el canal no tenía que poder activarse desde la app normal.

## Options considered

### Option 1: parámetro en la URL del iframe (`/?clock=…`)
- **Pros:** simple; el servidor podría elegir el día inicial sin parpadeo.
- **Cons:** cualquiera abre `/?clock=…` fuera de `/demo`: rompe FR-14. Cada cambio recarga la app.

### Option 2: cookie o almacenamiento del navegador (`localStorage`, `BroadcastChannel`)
- **Pros:** sin recargas; la cookie también llega al servidor.
- **Cons:** el mismo origen comparte cookie y storage con la app real: un reloj elegido en `/demo`
  se filtraría a la app abierta en otra pestaña o instalada como PWA.

### Option 3: `postMessage` del padre `/demo` al iframe, con guardas en el hijo
- **Pros:** el valor vive solo en la memoria de la página `/demo`; el hijo lo acepta solo si está
  en un frame cuyo padre es del mismo origen y tiene la ruta `/demo`, y si el mensaje viene de
  `window.parent` con el mismo origen. Fuera de `/demo` no hay canal. Sin recargas (NFR-01).
- **Cons:** el día inicial se corrige en el cliente después de la primera respuesta del padre; el
  HTML del servidor sale con el día de la hora real.

## Decision
Opción 3. Es la única de las tres en la que la hora simulada no puede llegar a la app fuera de
`/demo`, y `frame-ancestors 'self'` (`next.config.ts`, R-08) ya impide que otro sitio enmarque la app.

## Consequences
- Se suman `src/lib/demo-clock.ts` (puro) y `src/components/demo-clock.ts` (canal del cliente).
- "En vivo", la grilla y la app sin conexión toman la hora de un único hook que prefiere el reloj de
  `/demo` y, si no lo hay, usa `useNow`.
- Se acepta que dentro de `/demo` la grilla pueda mostrar un instante el día de la hora real antes
  de saltar al del reloj simulado.
- Recargar `/demo` vuelve el reloj al viernes 22:30 (FR-02): no se guarda en ningún lado.
