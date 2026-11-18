# Threat model FEAT-005a: En vivo con la hora real

| Field | Value |
|-------|-------|
| Ticket | FEAT-005a |
| Spec | docs/daw/specs/spec-FEAT-005a.md |
| Tier | FEATURE |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `src/lib/live-now.ts` + `src/lib/live-messages.ts` + `src/lib/festival-time.ts` | Block 1 |
| `src/components/use-now.ts` | Block 2 |
| `src/components/live-button.tsx` + `src/components/live-panel.tsx` + `src/components/schedule-screen.tsx` + `src/components/schedule-grid.tsx` | Block 3 |

FEAT-005a no agrega rutas, Server Actions, consultas a la base ni dependencias. El panel se calcula
en el navegador con la grilla y la selección que la pantalla ya tiene (también en `/~offline`,
ADR-004) y con la hora del dispositivo.

## Trust boundaries
- Estado de la pantalla → panel: `ScheduleScreen` pasa a `LiveButton` la grilla (`Schedule`) y el
  `draft`. El `draft` puede venir de la selección pendiente de `localStorage`
  (`mi-grilla:pending:<userId>`, ADR-004) y la grilla, sin conexión, de la copia del dispositivo:
  los dos son datos no confiables, porque cualquier script del mismo origen o la persona con el
  celular pudo cambiarlos.
- Sistema operativo → app: la hora sale de `Date.now()` del dispositivo, que la persona controla.
  La app no tiene otra fuente de hora (FR-14).

## STRIDE analysis
### `src/lib/live-now.ts` + `src/lib/live-messages.ts` + `src/lib/festival-time.ts`
- **Spoofing:** no identifica a nadie ni recibe identidades. Es una función pura de (grilla,
  instante, ids elegidos) a lo que muestra el panel.
- **Tampering:** un `draft` alterado con ids que no existen no cambia el panel: solo se marcan los
  shows de la grilla cuyo `id` está en el conjunto (R-01). Una grilla alterada en la copia del
  dispositivo con fechas inválidas no rompe la pantalla: `liveNow` descarta los shows cuyo
  `startsAt` o `endsAt` no se puede leer como instante (R-02).
- **Repudiation:** no hay acción que registrar. Abrir el panel no cambia ningún dato de la cuenta.
- **Information Disclosure:** el panel muestra solo la grilla pública y las marcas de la propia
  persona, que ya ve en la grilla. No muestra nombre ni email.
- **Denial of Service:** el cálculo recorre los 91 shows una vez por minuto mientras el panel está
  abierto; con una grilla inflada en la copia del dispositivo el costo crece lineal, solo en ese
  dispositivo (R-03).
- **Elevation of Privilege:** no hay permisos en juego: el panel no llama al servidor.

### `src/components/use-now.ts`
- **Spoofing:** no aplica: no hay identidad, solo la hora del dispositivo.
- **Tampering:** la persona puede cambiar la hora de su celular y ver otro "En vivo". Solo se engaña
  a sí misma: no se guarda ni se comparte nada calculado con esa hora (R-04, aceptado).
- **Repudiation:** no hay acción que registrar.
- **Information Disclosure:** no lee ni expone nada además de la hora.
- **Denial of Service:** un temporizador por minuto mientras el panel está abierto; se cancela al
  cerrarlo o desmontar, así no quedan temporizadores acumulados (R-05).
- **Elevation of Privilege:** no acepta una hora de afuera (ni URL ni almacenamiento), así que nadie
  puede imponer el reloj simulado fuera de `/demo` (FR-14).

### `src/components/live-button.tsx` + `src/components/live-panel.tsx` + `src/components/schedule-screen.tsx` + `src/components/schedule-grid.tsx`
- **Spoofing:** no aplica: el botón aparece solo en la pantalla de la grilla, que ya exige sesión
  (`src/app/page.tsx`) o la copia del dispositivo de esa persona (`/~offline`).
- **Tampering:** un nombre de artista con marcado en una grilla alterada se muestra como texto: React
  escapa el contenido y el panel no usa `dangerouslySetInnerHTML` (R-06).
- **Repudiation:** no hay acción que registrar.
- **Information Disclosure:** el panel se monta en un portal de Vaul; no agrega datos al DOM que la
  grilla no tenga ya.
- **Denial of Service:** abrir y cerrar el panel muchas veces no acumula temporizadores (R-05).
- **Elevation of Privilege:** el panel no llama a ninguna acción del servidor ni cambia la selección.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| ids de la selección en pantalla (`draft`) | public (shows del festival elegidos por la persona; no identifica a nadie sin la cuenta) | solo en memoria; la selección pendiente sigue en `localStorage` como en ADR-004 | no viaja: nunca sale del navegador en este ticket |
| grilla (`data/schedule.json`) | public | versionada en el repo y en la copia del dispositivo | ya en el cliente; HTTPS al cargarse |
| hora del dispositivo | public | no se guarda | no viaja |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | ids alterados en la selección pendiente marcan como elegidos shows que la persona no eligió o rompen el orden | T | L | L | `liveNow` recorre solo los shows de la grilla y consulta `selectedIds.has(show.id)`; un id desconocido se ignora (test en Block 1) |
| R-02 | una grilla alterada en la copia del dispositivo con un instante ilegible deja el panel en blanco o lanza | T | L | L | `liveNow` ignora los shows con `Date.parse` = `NaN` (test en Block 1); la copia ya pasa por `readSnapshot()` (ADR-004) |
| R-03 | una grilla inflada en la copia del dispositivo hace lento el cálculo por minuto | D | L | L | cálculo lineal y solo con el panel abierto; `readSnapshot()` ya valida la forma de la copia |
| R-04 | la hora del dispositivo está mal o la persona la cambia | T | M | L | aceptado, ver abajo |
| R-05 | abrir y cerrar el panel deja temporizadores vivos que se acumulan | D | L | L | `useNow` agenda solo con `active = true` y limpia el temporizador y el listener de `visibilitychange` en el cleanup del efecto (test en Block 2) |
| R-06 | un nombre de artista con marcado se interpreta como HTML | T | L | M | texto renderizado por React, sin `dangerouslySetInnerHTML` (revisión del Block 3) |

## Accepted risks
### R-04
- **Accepted by:** el usuario (decisión de producto en el PRD de DISCOVERY, `prd-DISC-001-05.md`,
  sección Risks and Mitigations, 2026-11-16)
- **Justification:** no hay forma confiable de saber la hora sin conexión, y con una hora mal
  configurada la persona solo se engaña a sí misma: nada se guarda ni se comparte con esa hora.
- **Review conditions:** si "En vivo" pasa a afectar datos de otras personas (por ejemplo, los
  grupos del PRD 06 o 07), o si la app suma una fuente de hora del servidor.

## Supply chain
No suma dependencias: el panel usa el Drawer de shadcn sobre Vaul 1.1.2, que ya está en el proyecto
(`app-menu.tsx`, `wallpaper-button.tsx`), y `lucide-react` para los íconos, también ya instalado.

## Availability
No hay servidor involucrado: abrir el panel no carga la base ni los Server Actions. El único vector
es el propio dispositivo (R-03, R-05), acotado a un cálculo por minuto con el panel abierto.
