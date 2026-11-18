# Threat model FEAT-005b: Reloj simulado de /demo

| Field | Value |
|-------|-------|
| Ticket | FEAT-005b |
| Spec | docs/daw/specs/spec-FEAT-005b.md |
| Tier | FEATURE |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `src/components/demo-clock.ts` | Block 2 |
| `src/components/demo-clock-control.tsx` | Block 3 |
| `src/components/iphone-frame.tsx` | Block 3 |

## Trust boundaries
- Página `/demo` (padre) → app en el iframe (hijo): el instante del reloj simulado cruza por
  `window.postMessage`. El hijo es la app real del usuario, con su sesión; el padre es una página
  pública sin sesión.
- Cualquier otra ventana del navegador (otro sitio, otra pestaña, una extensión) → app: cualquier
  ventana puede llamar `postMessage` sobre una app que la enmarque o que ella abrió.
- Persona que mira la demo → control del reloj: el día y la hora que tipea entran por un
  `<input type="time">`.

## STRIDE analysis
### `src/components/demo-clock.ts`
- **Spoofing:** un sitio ajeno que enmarque la app o le mande mensajes podría hacerse pasar por
  `/demo`. El hijo acepta un mensaje solo si `event.source === window.parent`,
  `event.origin === location.origin` y la ruta de `window.parent.location` es `/demo`; leer esa ruta
  desde un padre de otro origen lanza, y eso cuenta como "no está en la demo" (R-01). Además,
  `frame-ancestors 'self'` y `X-Frame-Options` de `next.config.ts` (R-08 de FEAT-001) ya impiden que
  otro origen enmarque la app.
- **Tampering:** un mensaje con forma inesperada (otro tipo, un número fuera de rango, un objeto con
  getters) se descarta: `parseDemoClockMessage` solo acepta `{ type: "mi-grilla:demo-clock", at:
  <número finito dentro de los 3 días del festival> }` (R-02).
- **Repudiation:** no aplica: la hora simulada no se guarda ni cambia nada en el servidor; no hay
  acción que negar. Recargar `/demo` la vuelve a FR-02.
- **Information Disclosure:** el canal va solo del padre al hijo y lleva un número (el instante). El
  hijo manda al padre únicamente un saludo sin datos (`mi-grilla:demo-clock-hello`): la selección, el
  nombre y la sesión nunca cruzan. El padre responde solo a `iframe.contentWindow` con
  `targetOrigin = location.origin`, nunca a `"*"` (R-03).
- **Denial of Service:** una ráfaga de mensajes válidos solo cambia un estado de React; el padre manda
  uno por cambio del control, y el hijo descarta todo lo que no venga del padre.
- **Elevation of Privilege:** la hora simulada no otorga nada: no se manda al servidor, no participa
  de ninguna autorización y fuera de `/demo` el hook no se suscribe (FR-14 de FEAT-005a, R-01).

### `src/components/demo-clock-control.tsx`
- **Spoofing:** no aplica: el control no identifica a nadie y `/demo` no tiene sesión propia.
- **Tampering:** la hora tipeada pasa por `TIME_PATTERN` de `src/lib/festival-time.ts`; un valor que
  no matchea no cambia el reloj, y los botones de ±15 min se acotan a los 3 días del festival (R-02).
- **Repudiation:** no aplica: nada se persiste.
- **Information Disclosure:** el control muestra solo día y hora del festival, datos públicos.
- **Denial of Service:** tocar los botones muy rápido solo encola renders; no hay red de por medio.
- **Elevation of Privilege:** no aplica: el control no habilita ninguna acción de la app.

### `src/components/iphone-frame.tsx`
- **Spoofing:** el iframe sigue cargando `/` del mismo origen; el padre manda el reloj solo a su
  propio `contentWindow`, no a otras ventanas.
- **Tampering:** sin cambios en `src` ni en el `sandbox`: el iframe no recibe parámetros nuevos en la
  URL (ADR-007, opción 1 descartada).
- **Repudiation:** no aplica: el marco no registra acciones.
- **Information Disclosure:** el padre no lee el DOM ni el estado de la app del iframe.
- **Denial of Service:** un único listener de `message` por montaje, retirado en el cleanup.
- **Elevation of Privilege:** no aplica: el marco no cambia permisos del iframe.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| instante del reloj simulado | public | no se guarda: vive en la memoria de la página `/demo` | `postMessage` dentro del mismo navegador, `targetOrigin` = el propio origen |
| día y hora tipeados en el control | public | no se guardan | no salen del navegador |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | la hora simulada se activa en la app fuera de `/demo` (otra pestaña, la PWA instalada, un sitio que la enmarque) | S | L | M | el hijo solo escucha si está en un frame, el padre es del mismo origen y su ruta es `/demo`; sin URL, cookie ni storage (ADR-007); test unitario de cada guarda y E2E de AC-15 |
| R-02 | un mensaje o una hora con forma inválida rompe "En vivo" o la grilla | T | L | L | `parseDemoClockMessage` y `TIME_PATTERN`; instantes fuera de los 3 días se descartan o se acotan |
| R-03 | el padre manda el reloj a una ventana que no es su iframe | I | L | L | `iframe.contentWindow.postMessage(msg, location.origin)`; nunca `"*"` |

## Supply chain
Sin dependencias nuevas: el control usa `Button` e `Input` de shadcn/ui, que ya están en
`src/components/ui/`, y `postMessage` es una API del navegador.

## Availability
No hay endpoints nuevos ni trabajo de servidor: el canal vive en el navegador. Un exceso de mensajes
solo afecta a la pestaña que los genera.
