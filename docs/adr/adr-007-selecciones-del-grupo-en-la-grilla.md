# ADR-007: Selecciones del grupo en la grilla: todas al abrir y en la copia del dispositivo

| Field | Value |
|-------|-------|
| Date | 2026-11-18 |
| Ticket | FEAT-006c |
| Status | Accepted |

## Context
FEAT-006c (`docs/daw/prd/prd-FEAT-006c.md`) muestra en cada show las iniciales de los amigos del
grupo elegido, y también sin conexión con los últimos datos cargados (FR-06). Un usuario puede
estar en hasta 10 grupos de hasta 20 integrantes. Sin conexión, la grilla se arma con la copia del
dispositivo en `localStorage` (ADR-004).

## Options considered

### Option 1: cargar solo el grupo elegido, con una Server Action al cambiar el selector
- **Pros:** payload inicial más chico; cada cambio trae datos frescos.
- **Cons:** sin conexión solo se vería el último grupo elegido; cambiar de grupo espera a la red
  en pleno festival; suma una Server Action que recibe un `groupId` del cliente.

### Option 2: cargar todos los grupos en el render de `/` y guardarlos en la copia
- **Pros:** cambiar de grupo es instantáneo y anda sin conexión para todos los grupos; la lectura
  ocurre del lado del servidor con la sesión verificada, sin entrada del cliente.
- **Cons:** payload más grande (acotado: 10 grupos × 19 amigos × sus shows); la copia del
  dispositivo pasa a tener nombres y selecciones de otras personas.

## Decision
Se eligió la opción 2: `listGroupPicks(userId)` en `src/server/groups.ts` corre en el
`Promise.all` de `src/app/page.tsx`, y `DeviceSnapshot` sumó `groups` sin cambiar de versión (una
copia sin `groups`, o con `groups` inválidos, se lee con `[]`). Pesó que en el festival la señal
falla justo cuando se quiere mirar al grupo, y que no agrega ninguna entrada nueva al servidor.

## Consequences
- La copia del dispositivo tiene datos de amigos: se borra en los mismos caminos que ya la borraban
  (ADR-004) y la valida `groupPicksOf` (`src/lib/group-picks.ts`).
- Sin conexión, quien salió de un grupo lo sigue viendo hasta el próximo `/` con red (riesgo R-08 de
  `docs/daw/security/threat-FEAT-006c.md`, aceptado por el PRD).
- La elección de grupo (`mi-grilla:group-choice:<userId>`) no se borra al cerrar sesión, igual que
  la selección pendiente: guarda solo el id de un grupo del mismo usuario.
- Los indicadores se actualizan al cargar `/` con conexión, no en tiempo real (fuera de alcance en
  el PRD).
- Si la consulta falla, la grilla se muestra sin selector y la copia conserva los grupos anteriores.
- Archivos: `src/server/groups.ts`, `src/app/page.tsx`, `src/lib/offline-selection.ts`,
  `src/lib/group-picks.ts`, `src/components/schedule-screen.tsx`, `src/components/offline-app.tsx`.
