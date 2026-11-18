# Threat model FEAT-004: Fondo de pantalla personal

| Field | Value |
|-------|-------|
| Ticket | FEAT-004 |
| Spec | docs/daw/specs/spec-FEAT-004.md |
| Tier | FEATURE |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `src/lib/wallpaper-layout.ts` + `src/lib/wallpaper-messages.ts` | Block 1 |
| `src/components/wallpaper-canvas.ts` + `src/components/wallpaper-delivery.ts` | Block 2 |
| `src/components/wallpaper-button.tsx` + `src/components/day-picker.tsx` + `src/components/schedule-screen.tsx` | Block 3 |

FEAT-004 no agrega rutas, Server Actions, consultas a la base ni dependencias. Todo pasa en el
navegador de la persona, con datos que la pantalla de la grilla ya tiene (ADR-005).

## Trust boundaries
- Estado de la pantalla → generador: `ScheduleScreen` pasa a `WallpaperButton` el día en pantalla,
  los escenarios, los shows de ese día y el `draft`. El `draft` puede venir de la selección
  pendiente de `localStorage` (`mi-grilla:pending:<userId>`, ADR-004), que es dato no confiable:
  cualquier script del mismo origen o la persona con el celular pudo cambiarlo.
- Navegador → sistema operativo: `navigator.share({ files })` entrega el PNG a la hoja de compartir
  de iOS/Android, y `<a download>` lo entrega al gestor de descargas. A partir de ahí la imagen
  sale del control de la app. Va adonde la persona la mande.
- Navegador → `document.fonts`: el canvas pide la familia de Public Sans que `next/font` sirve desde
  `/_next/static/media` y que el service worker tiene en el precache (ADR-002).

## STRIDE analysis
### `src/lib/wallpaper-layout.ts` + `src/lib/wallpaper-messages.ts`
- **Spoofing:** no identifica a nadie ni recibe identidades. Es una función pura de (día,
  escenarios, shows, ids elegidos) a geometría.
- **Tampering:** un `draft` alterado en `localStorage` con ids que no son del día, o que no existen,
  no cambia la imagen. El layout solo enciende los shows de la lista del día que coinciden por `id`
  (R-01). Los nombres de artista salen de `data/schedule.json`, versionado, y no de la persona.
- **Repudiation:** no hay acción que registrar. Generar un fondo no cambia ningún dato de la cuenta.
- **Information Disclosure:** la imagen no lleva el nombre ni el email de la persona: solo el día,
  "Mi Grilla" y los shows (FR-08). Los textos de error son fijos por código y no llevan
  `error.message` (R-04).
- **Denial of Service:** el costo es constante y acotado: a lo sumo 31 shows y 13 marcas de hora
  por día.
- **Elevation of Privilege:** no hay permisos en juego. Es código puro sin I/O.

### `src/components/wallpaper-canvas.ts` + `src/components/wallpaper-delivery.ts`
- **Spoofing:** no aplica: no habla con ningún servicio. La fuente sale del mismo origen.
- **Tampering:** el texto se dibuja con `fillText` en un canvas, nunca como HTML, así que un nombre
  con marcado no se interpreta (R-02).
- **Repudiation:** no hay acción con consecuencias para la cuenta.
- **Information Disclosure:** el canvas no se inserta en el DOM ni se lee desde otro origen. El Blob
  solo vive en memoria hasta que la persona lo comparte o lo descarga.
- **Denial of Service:** un canvas de 1290 × 2796 ocupa unos 14 MB de memoria. Muchos toques
  seguidos podrían acumular canvas y Blobs (R-03). Si WebKit no puede reservar el canvas,
  `getContext` devuelve `null`: se trata como `CANVAS_UNSUPPORTED` y no como excepción.
- **Elevation of Privilege:** no pide permisos del navegador. `document.fonts` y canvas no los
  requieren.

### `src/components/wallpaper-button.tsx` + `src/components/day-picker.tsx` + `src/components/schedule-screen.tsx`
- **Spoofing:** el botón solo existe dentro de `ScheduleScreen`, que se renderiza con sesión
  verificada (`/`) o con la copia del dispositivo de ese mismo usuario (`/~offline`, ADR-004). No
  abre ninguna forma nueva de ver la selección de otra persona.
- **Tampering:** la imagen usa la selección en pantalla, incluidos los cambios sin guardar (FR-09).
  Puede no coincidir con la cuenta, y es lo que el PRD decidió. Nunca se envía al servidor ni cambia
  lo guardado.
- **Repudiation:** sin registro, igual que el resto de la grilla en el cliente: no hay acción que
  disputar.
- **Information Disclosure:** la vista previa usa un object URL `blob:` del propio origen, que se
  revoca al cerrar la hoja o al desmontar (R-03). Compartir la imagen es un acto explícito de la
  persona, en dos toques ("Descargar fondo" y después "Guardar en Fotos" o "Descargar imagen").
- **Denial of Service:** mientras se genera, el botón de la hoja está deshabilitado y se ignora un
  segundo pedido (R-03). Un `AbortError` de `share()` (la persona cerró la hoja del sistema) no se
  trata como error ni reintenta.
- **Elevation of Privilege:** `navigator.share` solo corre dentro del gesto de la persona.
  `NotAllowedError` cae a la descarga con `<a download>` y no intenta saltear la restricción
  (R-05).

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| ids de la selección en pantalla (`draft`) | public (shows del festival elegidos por la persona; no identifica a nadie sin la cuenta) | solo en memoria; la selección pendiente sigue en `localStorage` como en ADR-004 | no viaja: nunca sale del navegador en este ticket |
| PNG del fondo | public (grilla del día con los shows elegidos, sin nombre ni email) | en memoria como Blob hasta revocarlo; después donde la persona lo guarde | por la hoja de compartir o la descarga, decidido por la persona |
| grilla (`data/schedule.json`) | public | versionada en el repo y en la copia del dispositivo | ya en el cliente; HTTPS al cargarse |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | ids alterados en la selección pendiente encienden shows ajenos al día o rompen el dibujo | T | L | L | `wallpaperLayout` recorre solo los shows del día y consulta `selectedIds.has(show.id)`; un id desconocido se ignora (test en Block 1) |
| R-02 | un nombre con marcado se interpreta como HTML | T | L | M | el texto se dibuja con `fillText` en canvas, nunca con `innerHTML`; la vista previa es un `<img>` con `src` blob |
| R-03 | toques repetidos acumulan canvas, Blobs y object URLs y agotan la memoria del iPhone | D | M | M | una sola generación en curso (estado `generating` que deshabilita la acción); `URL.revokeObjectURL` al cerrar la hoja, al regenerar y al desmontar; el canvas no se guarda entre generaciones |
| R-04 | un error del navegador (`toBlob`, `fonts.load`, `share`) llega a la UI con su `message` | I | L | L | resultado tipado `{ ok: false, code }` con `FONT_UNAVAILABLE`, `CANVAS_UNSUPPORTED`, `ENCODE_FAILED`, `SHARE_FAILED`; el texto sale de `src/lib/wallpaper-messages.ts` |
| R-05 | WebKit rechaza `share()` (`NotAllowedError`) porque generar consumió la activación del gesto | E | M | L | `share()` se llama desde un segundo toque, con el Blob ya generado; si igual falla, la hoja ofrece la descarga y la vista previa sigue disponible para "Agregar a Fotos" manteniéndola apretada |

## Supply chain
No suma dependencias: Canvas 2D, `document.fonts`, Web Share y `<a download>` son APIs del
navegador. La tipografía es la misma Public Sans que ya sirve `next/font` y que el service worker ya
precachea.

## Availability
No hay servidor involucrado: generar el fondo no carga la base ni los Server Actions. El único
vector es la memoria del propio dispositivo (R-03), y queda acotado a una generación a la vez.
