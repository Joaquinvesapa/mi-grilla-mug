# Threat model FEAT-007: Fondo de pantalla del grupo

| Field | Value |
|-------|-------|
| Ticket | FEAT-007 |
| Spec | docs/daw/specs/spec-FEAT-007.md |
| Tier | FEATURE |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `src/lib/wallpaper-layout.ts` + `src/lib/group-picks.ts` | Block 1 |
| `src/components/wallpaper-canvas.ts` | Block 2 |
| `src/components/wallpaper-button.tsx` + `src/components/schedule-screen.tsx` + `src/lib/wallpaper-messages.ts` | Block 3 |

FEAT-007 no agrega rutas, Server Actions, consultas a la base, cambios de schema ni dependencias.
Extiende el fondo de FEAT-004 (Canvas 2D en el cliente, ADR-005) con los grupos que la grilla ya
recibe desde FEAT-006c (`listGroupPicks` con conexión, la copia del dispositivo sin ella, ADR-008).

## Trust boundaries
- Estado de la pantalla → generador: `ScheduleScreen` pasa a `WallpaperButton` el `draft`, los
  grupos (`GroupPicks[]`) y el grupo del selector. Sin conexión, los grupos salen de la copia del
  dispositivo en `localStorage` (ADR-004/ADR-008), que es dato no confiable: ya pasaron por
  `groupPicksOf`, que descarta la copia entera si algo no cumple los límites.
- Otros integrantes → imagen: el nombre del grupo (lo puede cambiar quien lo administra) y las
  iniciales y selecciones guardadas de cada amigo son datos escritos por otras personas que terminan
  dibujados en la imagen de este usuario.
- Navegador → sistema operativo: `navigator.share({ files })` o `<a download>` entregan el PNG, igual
  que en FEAT-004. Desde ahí la imagen, con las iniciales de los amigos, sale del control de la app.

## STRIDE analysis
### `src/lib/wallpaper-layout.ts` + `src/lib/group-picks.ts`
- **Spoofing:** no identifica a nadie. Las iniciales son las que `listGroupPicks` calculó del nombre
  visible de cada integrante; el layout no recibe ids de cuenta (R-02 de FEAT-006c).
- **Tampering:** un grupo alterado en la copia del dispositivo no llega al layout: `groupPicksOf` ya
  lo descartó (todo o nada). El layout además solo pone iniciales en shows del día que existen, por
  `id` (R-01).
- **Repudiation:** no hay acción que registrar: generar el fondo no cambia ningún dato.
- **Information Disclosure:** la imagen lleva el nombre del grupo y las iniciales de los amigos,
  nunca sus nombres completos, ids ni emails (R-03). Es lo que el PRD pide (FR-06 a FR-10).
- **Denial of Service:** costo acotado: a lo sumo 31 shows por día, 19 amigos por grupo y 3
  píldoras más "+N" por bloque.
- **Elevation of Privilege:** código puro sin I/O ni permisos.

### `src/components/wallpaper-canvas.ts`
- **Spoofing:** no habla con ningún servicio.
- **Tampering:** el nombre del grupo y las iniciales se dibujan con `fillText`, nunca como HTML
  (R-02).
- **Repudiation:** no hay acción con consecuencias para la cuenta.
- **Information Disclosure:** el canvas no se inserta en el DOM; el Blob vive en memoria hasta que
  la persona lo entrega.
- **Denial of Service:** el mismo canvas único de FEAT-004 (R-04): las píldoras no suman memoria.
- **Elevation of Privilege:** no pide permisos del navegador.

### `src/components/wallpaper-button.tsx` + `src/components/schedule-screen.tsx` + `src/lib/wallpaper-messages.ts`
- **Spoofing:** el botón vive dentro de `ScheduleScreen`, con sesión verificada o con la copia del
  dispositivo del mismo usuario; la copia de otra cuenta no aporta grupos (`groupsKeptFor`, R-06 de
  FEAT-006c).
- **Tampering:** el grupo elegido en la hoja solo puede ser uno de los `groups` recibidos; un valor
  que no está en la lista se ignora, como en `GroupPicker` (R-05).
- **Repudiation:** sin registro: no hay acción que disputar.
- **Information Disclosure:** el nombre de archivo sale del día y del nombre del grupo reducidos a
  `[a-z0-9-]`, así que un nombre de grupo no puede inyectar rutas ni caracteres raros en el archivo
  (R-06). La entrega sigue siendo un acto explícito en dos toques.
- **Denial of Service:** cambiar de grupo o de opción redibuja; sigue habiendo una sola generación
  a la vez y los resultados viejos se descartan por número de generación (R-04).
- **Elevation of Privilege:** `navigator.share` sigue corriendo solo dentro de un toque fresco
  (R-05 de FEAT-004).

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| iniciales y selecciones guardadas de los amigos | PII (derivada del nombre visible de otras personas, dentro de un grupo que las comparte) | en memoria; sin conexión, la copia del dispositivo de ADR-008 (sin cifrar en `localStorage`, aceptado en FEAT-006c) | ya en el cliente; llegó por HTTPS en el render de `/` |
| nombre del grupo | PII (texto libre que escribe quien administra) | igual que arriba | igual que arriba |
| PNG del fondo del grupo | PII (iniciales de amigos y nombre del grupo, sin nombres completos) | en memoria como Blob hasta revocarlo; después donde la persona lo guarde | por la hoja de compartir o la descarga, decidido por la persona |
| ids de la selección en pantalla (`draft`) | public | solo en memoria | no viaja |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | ids de shows alterados en la copia o en el `draft` ponen iniciales en shows de otro día o rompen el dibujo | T | L | L | el layout recorre solo los shows del día y consulta `friendsByShow.get(show.id)`; un id desconocido no dibuja nada (test en Block 1) |
| R-02 | un nombre de grupo o unas iniciales con marcado se interpretan como HTML | T | L | M | se dibujan con `fillText` en el canvas; la vista previa es un `<img>` con `src` blob; el selector de grupo es un `<option>` con texto, sin `dangerouslySetInnerHTML` |
| R-03 | la imagen expone más datos de los amigos que los que el PRD decidió | I | L | M | el layout recibe `FriendPicks` (nombre, iniciales, shows) y dibuja solo `initials` vía `indicatorParts`; un test verifica que el nombre completo de un amigo no aparece en ningún texto del layout |
| R-04 | cambiar de opción o de grupo muchas veces acumula canvas y object URLs | D | M | M | una generación a la vez con el contador `generation` de FEAT-004; `revokeObjectURL` antes de cada redibujo y al cerrar |
| R-05 | un valor de grupo inventado en el selector de la hoja dibuja un grupo que no es del usuario | T | L | M | la hoja solo acepta ids presentes en `groups`; cualquier otro valor se ignora (test en Block 3) |
| R-06 | un nombre de grupo con `/`, `..` o caracteres de control termina en el nombre del archivo | T | L | L | `wallpaperFileName` normaliza, quita tildes y reduce a `[a-z0-9-]`; un nombre que queda vacío da `mi-grilla-<día>.png` (test en Block 1) |

## Supply chain
No suma dependencias: reusa Canvas 2D, Web Share, `<a download>` y el `NativeSelect` de shadcn que ya
está en el repo (`src/components/ui/native-select.tsx`).

## Availability
No hay servidor involucrado: generar el fondo del grupo no carga la base ni llama a Server Actions.
El único vector es la memoria del propio dispositivo (R-04), acotado a una generación a la vez.
