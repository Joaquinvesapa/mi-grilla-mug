# Threat model FEAT-006c: El grupo en la grilla

| Field | Value |
|-------|-------|
| Ticket | FEAT-006c |
| Spec | docs/daw/specs/spec-FEAT-006c.md |
| Tier | FEATURE |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `src/server/groups.ts` (`listGroupPicks`) + `src/app/page.tsx` | Block 1 |
| `src/lib/group-picks.ts` + `src/lib/offline-selection.ts` (`groups` en la copia) + `src/lib/group-messages.ts` | Block 2 |
| `src/components/device-store.ts` (elección de grupo) + `src/components/group-picker.tsx` + `src/components/schedule-screen.tsx` + `src/components/schedule-grid.tsx` + `src/components/offline-app.tsx` | Block 3 (grilla y selector) y Block 4 (pantalla, página y copia) |
| `tests/e2e/db.ts` (helper de E2E que escribe en la base) | Block 5 |

FEAT-006c no agrega endpoints ni Server Actions: la grilla (`/`, página dinámica que ya verifica la
sesión) suma una lectura, `listGroupPicks(user.id)`, que trae las selecciones guardadas de los demás
integrantes de cada grupo del usuario. Es la primera vez que la selección de una cuenta llega a la
pantalla de otra, y la primera vez que datos de otras personas quedan en el dispositivo (ADR-004,
ADR-007).

## Trust boundaries
- Servidor → navegador: `src/app/page.tsx` serializa `GroupPicks[]` (nombre del grupo, nombre,
  iniciales y `showIds` de cada amigo) en el payload de React. Solo cruza lo de los grupos de los que
  el usuario de la sesión es integrante.
- Servidor → PostgreSQL: `listGroupPicks` es un `$queryRaw` parametrizado sobre `group_members`,
  `groups`, `users` y `selected_shows`, anclado en la membresía del usuario de la sesión.
- `localStorage` → pantalla: la copia del dispositivo (`mi-grilla:snapshot`, ahora con `groups`) y
  la elección de grupo (`mi-grilla:group-choice:<userId>`) son datos no confiables: cualquiera con el
  dispositivo o una extensión puede editarlos.
- Proceso de Playwright → PostgreSQL de test: `tests/e2e/db.ts` escribe filas directamente; vive
  fuera de `src/` y nunca se importa desde la app.

## STRIDE analysis
### `src/server/groups.ts` (`listGroupPicks`) + `src/app/page.tsx`
- **Spoofing:** el `userId` sale de `getAccounts().getCurrentUser(headers)` en la página; la función
  no recibe nada del cliente, así que no hay identidad que suplantar (R-01).
- **Tampering:** solo lee. No hay parámetro del cliente que pueda alterar la consulta: el único valor
  interpolado es el `userId` de la sesión, como parámetro del tagged template (R-01).
- **Repudiation:** una lectura no es una acción que alguien pueda negar; los fallos quedan como
  `[groups] SERVICE_UNAVAILABLE at=…`, sin el error, igual que el resto del servicio.
- **Information Disclosure:** el riesgo central. Una consulta mal anclada mostraría la selección de
  quien no comparte grupo con el usuario (R-01). Los `user_id` de los amigos no salen del servidor
  (R-02). Solo se lee `selected_shows`, que tiene lo guardado: los cambios sin guardar de un amigo
  nunca están en la base (FR-05).
- **Denial of Service:** el resultado tiene un techo: 10 grupos × 19 amigos × los shows de la
  grilla. Corre en paralelo con la grilla y la selección; si falla, la grilla igual se muestra sin
  selector (R-06).
- **Elevation of Privilege:** ver las selecciones del grupo no da ningún permiso de escritura; ser
  administrador no cambia lo que se lee.

### `src/lib/group-picks.ts` + `src/lib/offline-selection.ts` (`groups` en la copia) + `src/lib/group-messages.ts`
- **Spoofing:** `parseGroupChoice` exige que el `userId` dentro del valor sea el pedido, además del
  de la clave, como `parsePending` (R-05).
- **Tampering:** la copia editada a mano podría traer grupos, nombres o `showIds` inventados.
  `groupPicksOf` valida cada campo (largos acotados, `GROUP_ID_PATTERN`, como mucho 10 grupos y 19
  amigos, ids de show conocidos por la grilla de la copia) y ante cualquier problema descarta solo
  los grupos, no la copia (R-04).
- **Repudiation:** no hay acciones: son funciones puras.
- **Information Disclosure:** la copia ahora incluye nombres y selecciones de amigos (R-03); los
  textos de `group-messages.ts` no incluyen datos.
- **Denial of Service:** una copia enorme o malformada no se procesa: el parseo corta en los límites
  y devuelve `[]`.
- **Elevation of Privilege:** nada de lo leído del dispositivo se manda al servidor: la elección de
  grupo solo decide qué se pinta.

### `src/components/device-store.ts` (elección de grupo) + `src/components/group-picker.tsx` + `src/components/schedule-screen.tsx` + `src/components/schedule-grid.tsx` + `src/components/offline-app.tsx`
- **Spoofing:** la pantalla lee la elección con el `userId` de la sesión (o de la copia, sin
  conexión), nunca la de otra cuenta (R-05).
- **Tampering:** una elección editada que apunta a un grupo ajeno no muestra nada: solo se elige
  entre los grupos que vinieron del servidor o de la copia validada; si no está, se usa el grupo más
  reciente (R-05).
- **Repudiation:** cambiar de grupo en el selector no es una acción del servidor ni deja registro, y
  no hace falta: no cambia ningún dato.
- **Information Disclosure:** los nombres de amigos se pintan como texto con React (sin
  `dangerouslySetInnerHTML`), así que un nombre con HTML no se ejecuta (R-04). La copia con datos de
  amigos se borra en los mismos caminos que hoy borran la copia: "Cerrar sesión", `/login` y
  `/register` (R-03). Al cargar la grilla con otra cuenta, la copia se reemplaza entera.
- **Denial of Service:** el selector y los indicadores se calculan en memoria con mapas por id; con
  20 integrantes la grilla carga en 2 s o menos (NFR-01, AC-30).
- **Elevation of Privilege:** no hay controles nuevos con permisos: el selector no escribe en el
  servidor.

### `tests/e2e/db.ts` (helper de E2E que escribe en la base)
- **Spoofing:** inserta usuarios sin contraseña ni cuenta de Better Auth: no se puede entrar con
  ellos. Solo existen para ser amigos en la grilla del usuario del test.
- **Tampering:** escribe con consultas parametrizadas de `pg` sobre la base de `DATABASE_URL`. Usa
  el guard de bases locales de los tests de integración (`tests/integration/database-guard.ts`), que
  impide escribir en una base no local (R-07).
- **Repudiation:** las filas que crea usan correos `@example.com` con un prefijo propio del test,
  así que se distinguen de las de una persona.
- **Information Disclosure:** no lee datos de nadie: solo crea los suyos.
- **Denial of Service:** crea 19 usuarios por corrida, dentro del límite de 20 integrantes del
  grupo.
- **Elevation of Privilege:** no se importa desde `src/` (convención de `AGENTS.md`); no queda en el
  build de producción.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| nombre visible e iniciales de los amigos | PII | PostgreSQL (`users.name`), cifrado de disco del proveedor; en el dispositivo, en `localStorage` dentro de la copia, borrada al cerrar sesión, en `/login` y `/register` | TLS (HTTPS en producción) dentro del payload de la página |
| selección guardada de cada amigo (`showIds`) | PII | `selected_shows` en PostgreSQL; en el dispositivo, en la copia, con la misma vida que la copia | TLS dentro del payload de la página |
| nombre del grupo e id del grupo | PII | `groups` en PostgreSQL; en la copia y en `mi-grilla:group-choice:<userId>` (solo el id) | TLS |
| `user_id` de los amigos | PII | no sale del servidor | no viaja |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | `listGroupPicks` devuelve selecciones de quien no comparte grupo con el usuario | I | M | H | la consulta parte de `group_members me WHERE me.user_id = ${userId}` (sesión verificada) y une a los demás por `m.group_id = me.group_id`; test de integración con un tercero en otro grupo cuyas selecciones no aparecen |
| R-02 | los ids de cuenta de los amigos llegan al navegador | I | M | M | `GroupPicks` no tiene `userId`: solo nombre, iniciales y `showIds`; test unitario sobre la forma del resultado |
| R-03 | en un celular compartido, la copia deja ver nombres y selecciones de amigos | I | L | M | la copia con `groups` se borra en los mismos caminos que hoy (`clearSnapshot` en "Cerrar sesión", `/login` y `/register`) y se reemplaza al entrar con otra cuenta; tests de esos caminos con una copia con grupos |
| R-04 | una copia editada inyecta grupos, nombres o shows inventados, o HTML en un nombre | T | L | L | `groupPicksOf` valida forma y límites y descarta los grupos ante cualquier error; los nombres se pintan como texto de React |
| R-05 | la elección de grupo de otra cuenta o de un grupo que ya no es del usuario se aplica | S | L | L | clave por `userId` con el `userId` validado adentro; la elección solo se usa si el id está entre los grupos cargados, si no, el más reciente |
| R-06 | la consulta de grupos falla o tarda y la grilla no se ve | D | L | M | `page.tsx` mapea el fallo a `groups: null`: grilla sin selector, y la copia conserva los grupos que tenía; AC-30 mide la carga con 20 integrantes |
| R-07 | el helper de E2E escribe en una base que no es la de test | T | L | H | usa el guard de `tests/integration/database-guard.ts` antes de conectarse; vive en `tests/e2e/`, nunca en `src/` |
| R-08 | sin conexión, quien salió de un grupo o fue sacado (FEAT-006b) sigue viendo las selecciones de ese grupo desde la copia | I | L | L | accepted, see below; al primer `/` con conexión la copia se reescribe solo con los grupos que devuelve `listGroupPicks` |

## Accepted risks
### R-08
- **Accepted by:** el usuario (dueño del producto), en el PRD de FEAT-006c, sección "Risks and Mitigations": "Sin conexión, los indicadores pueden estar desactualizados → se muestran los últimos datos cargados (FR-06). Es mejor que no ver nada en el festival."
- **Justification:** sin conexión la app no puede saber que la membresía cambió; los datos son los que la persona ya veía como integrante, y solo en el dispositivo donde los cargó.
- **Review conditions:** si se agrega invalidación remota (push o sincronización en segundo plano), o si FEAT-006b pide que sacar a alguien tenga efecto inmediato también sin conexión.

## Supply chain
Ninguna dependencia nueva. El selector usa el componente `native-select` de shadcn/ui, copiado al
repo con la CLI fijada (4.23.0); solo usa `lucide-react` y `cn`, que ya están. El helper de E2E usa
`pg`, que ya está en las dependencias por `@prisma/adapter-pg`.

## Availability
El único vector nuevo es la consulta de `listGroupPicks` en cada carga de `/`: su resultado está
acotado (10 grupos, 19 amigos cada uno) y un fallo no tira la grilla (R-06). No hay endpoints
nuevos que alguien pueda llamar en loop: la lectura solo ocurre al cargar la página con sesión.
