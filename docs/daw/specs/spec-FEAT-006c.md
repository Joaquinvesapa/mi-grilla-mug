# Spec FEAT-006c: El grupo en la grilla

| Field | Value |
|-------|-------|
| Ticket | FEAT-006c |
| PRD | docs/daw/prd/prd-FEAT-006c.md |
| Tier | FEATURE |
| Date | 2026-11-18 |
| Spec loops | 1 |
| Loops since last human decision | 0 |

## Vuelta 1 (CODE → PLAN desde el Block 5, decisión del usuario, 2026-11-18)

- **Qué encontró el E2E.** `test-e2e-group-grid-fit` falló en los 3 proyectos mobile. En los dos
  shows de 20 minutos del domingo en Kidzapalooza (18:00 y 18:30), la fila de iniciales sale del
  bloque de 60 px. La cuenta de "Horario siempre visible" suponía un horario de unos 15 px, pero
  `[data-time-line]` no tiene `leading` propio y hereda 24 px (16 px × 1,5). A 360 px, además,
  "¡Qué Lío, Hugo!" ocupa 2 líneas, y nombre en 2 líneas + horario + iniciales (≈ 75,5 px) no
  entran en 60 px con ningún ajuste.
- **Decisión del usuario (opción 1 de 3).** En un bloque con amigos cuya altura no alcanza para el
  nombre en 2 líneas, el nombre se recorta a 1 línea con "…". El nombre completo sigue en el nombre
  accesible y el horario sigue visible. Se descartaron dejar que el bloque tape el principio del
  show siguiente y mostrar solo "+N" (eso último no cumple FR-02).
- **Cómo se aplica.** Un bloque nuevo, el Block 6, que se implementa antes de cerrar el Block 5
  (cuyo `test-e2e-group-grid-fit` es el que lo comprueba). Los Blocks 1 a 4 ya están completos y no
  se tocan.
- **Fuera de este ticket.** Sin amigos, el bloque de 44 px de "¡Qué Lío, Hugo!" ya no mostraba su
  horario a 360 px desde FEAT-003a (nombre en 2 líneas + horario ≈ 64,5 px). No se corrige acá.

## Summary
La página `/` suma una lectura más a su `Promise.all`: `listGroupPicks(user.id)` en
`src/server/groups.ts` trae, para cada grupo del usuario, los demás integrantes con su selección
guardada (una fila por amigo, con `array_agg`). La pantalla de la grilla muestra un selector de grupo
(el `native-select` de shadcn/ui) y, en cada show, las iniciales de los amigos que lo eligieron.
Todos los grupos viajan en la copia del dispositivo, así el selector y los indicadores funcionan sin
conexión (ADR-007, que extiende ADR-004). Son 6 bloques: servicio; reglas puras y copia;
presentación (grilla y selector); pantalla, página y copia; E2E; y el ajuste de los bloques cortos
con amigos (vuelta 1). Incorpora R-01 a R-08 de `docs/daw/security/threat-FEAT-006c.md`, los 16 huecos del Impact
Check y los 9 hallazgos de la auditoría de arquitectura de PLAN.

### Decisiones aplicadas
- **ADR-007:** se cargan todos los grupos al renderizar `/` y se guardan en la copia del
  dispositivo. No hay Server Action nueva ni entrada del cliente.
- **Horario siempre visible (auditoría, hallazgo 2).** El horario de cada bloque no se oculta nunca:
  es FR-03 de FEAT-003a. La fila de iniciales va debajo del horario. Un bloque con iniciales mide al
  menos `MIN_BLOCK_HEIGHT_WITH_FRIENDS = 60` px, sin pasar del inicio del show siguiente del mismo
  escenario. En la grilla real, los únicos bloques de menos de 60 px son los dos shows de 20 minutos
  del domingo en Kidzapalooza (18:00 y 18:30). Cada show deja al menos 10 minutos (20 px) libres
  antes del siguiente. Un bloque con iniciales y subtítulo recorta el subtítulo a 1 línea. (La
  cuenta original, "44 + 16 = 60 px siempre entra", estaba mal: ver "Vuelta 1" y el Block 6.) El E2E `test-e2e-group-grid-fit` comprueba en los tres días que
  la fila entra en todos los bloques.
- **Selector:** se usa el componente `native-select` de shadcn/ui, copiado con la CLI fijada
  (`pnpm exec shadcn add native-select`, 4.23.0). No suma dependencias porque usa `lucide-react` y
  `cn`, que ya están. En iOS abre la rueda nativa. Se le pasan clases para medir `h-11` (44 px) y
  `text-base` (16 px).
- **La elección de grupo tiene tres estados (auditoría, hallazgo 5).** `readGroupChoice(userId)`
  devuelve `{ groupId: string | null } | undefined`:
  - `undefined`: nunca eligió, la clave es inválida o es de otra cuenta. Se muestra el grupo más
    reciente.
  - `{ groupId: null }`: eligió "Sin grupo".
  - `{ groupId }`: eligió ese grupo, que se respeta si todavía es uno de sus grupos.

  La elección no se borra al cerrar sesión (ADR-007). Se lee después de hidratar, con el mismo
  patrón `inBrowser`/`adopted` que `readPending`, porque `/~offline` se prerenderiza.
- **Grupos que no se pudieron cargar (Impact Check 11, auditoría 6).** Si `listGroupPicks` falla,
  `page.tsx` pasa `groups: null`. La grilla se muestra igual, sin selector ni indicadores. La copia
  conserva los grupos anteriores solo si es del mismo `userId`; si no hay copia o es de otra cuenta,
  queda `[]`. `ScheduleScreen` guarda en un ref los grupos que la copia tiene que conservar:
  - si `groups` no es `null`, el ref toma `groups`;
  - si es `null`, al montar en el navegador el ref toma `readSnapshot()?.groups` cuando
    `snapshot.userId === userId`, y si no, `[]`.

  `rememberConfirmed` escribe siempre lo que tiene ese ref. Como lo llaman `refreshCopy`, `sync` y
  `save`, los tres escriben los mismos grupos.
- **E2E con 20 integrantes (Impact Check 15, auditoría 8).** Quien mira la grilla se registra por la
  UI. Para los grupos de AC-21, AC-22, AC-25 y AC-30, un helper nuevo, `tests/e2e/db.ts`, inserta
  los grupos, los amigos y sus selecciones directamente con `pg`. Usa ids `randomUUID`, correos
  `e2e-picks-<uuid>@example.com` y `joined_at` explícito (`timestamptz(3)`). Pasa por
  `assertTruncatableDatabaseUrl` antes de conectarse. No hay limpieza: las filas se acumulan, igual
  que las de `signUp`. Los amigos insertados no tienen cuenta de Better Auth y no pueden entrar. Cada
  test arma su propio grupo, así los 4 proyectos en paralelo no comparten filas.
- **AC-30 (auditoría, hallazgo 1).** Va en `tests/e2e/performance.spec.ts`, que ya está en
  `CHROMIUM_ONLY` porque mide con CDP. Se verifica en la corrida completa del cierre de CODE y al
  mergear a `main`, no en el job de PR (solo `iphone-webkit`). La red se limita recién después de
  armar los datos.
- **Guías mobile (`.agents/skills/`, auditoría 9):**
  - `mobile-native`:
    - el select usa 16 px, para que iOS no haga zoom;
    - los objetivos táctiles miden al menos 44 px;
    - el tap highlight se apaga y el estado presionado ya está resuelto de forma global en
      `globals.css`;
    - la fila del selector va dentro de `app-fixed-screen`, debajo del AppBar, así que las safe
      areas no cambian.
  - `gestures`: el selector no captura gestos; la grilla sigue siendo lo único que scrollea en x/y.
  - `design-taste-frontend`:
    - un solo sistema: tokens de shadcn y Rosé Pine;
    - las iniciales van en chips `bg-rp-overlay`/`text-foreground` sobre bloques sin elegir y
      `bg-rp-base/25` sobre bloques elegidos (foam), sin iris;
    - los textos son propios.

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 4 (selector solo con grupos), Block 5 (AC-20, AC-21) |
| FR-02 | Block 1 (amigos sin el propio usuario), Block 2 (`indicatorParts`), Block 3 (fila de iniciales), Block 5 (AC-21, AC-22) |
| FR-03 | Block 2 (`picksByShow` vacío con "Sin grupo"), Block 3, Block 4, Block 5 (AC-23) |
| FR-04 | Block 2 (`resolveGroupChoice`, `parseGroupChoice`), Block 4 (`readGroupChoice`/`writeGroupChoice`), Block 5 (AC-24, AC-25) |
| FR-05 | Block 1 (solo `selected_shows`, lo guardado), Block 5 (AC-26) |
| FR-06 | Block 2 (`groups` en la copia), Block 4 (`offline-app.tsx`, ref de grupos), Block 5 (AC-27) |
| NFR-01 | Strategy: una sola consulta con `array_agg` (una fila por amigo) en paralelo con la grilla y la selección; mapas por id en el cliente; medido por AC-30 en `performance.spec.ts` con 4G y un grupo de 20 integrantes con selección completa |
| NFR-02 | Strategy: iniciales `text-[12px]`, select `h-11 text-base`; medido por AC-32 en `mobile-360` |
| AC-20 | Block 4, Block 5 |
| AC-21 | Block 1, Block 3, Block 4, Block 5 |
| AC-22 | Block 2, Block 3, Block 5 |
| AC-23 | Block 2, Block 3, Block 4, Block 5 |
| AC-24 | Block 2, Block 4, Block 5 |
| AC-25 | Block 1, Block 2, Block 4, Block 5 |
| AC-26 | Block 1, Block 5 |
| AC-27 | Block 2, Block 4, Block 5 |
| AC-30 | Block 1, Block 5 |
| AC-32 | Block 3, Block 5, Block 6 |

## Rollback
No hay migración ni cambio de esquema: revertir el merge alcanza. El campo `groups` de la copia
(versión 1) lo ignora el código anterior, que arma la copia solo con los campos que conoce, y la
clave `mi-grilla:group-choice:<userId>` queda sin uso.

## Dependencies between blocks
Block 1 → Block 2 → Block 3 → Block 4 → Block 5, y el Block 6 (vuelta 1) depende del Block 3 y se
implementa antes de cerrar el Block 5: `test-e2e-group-grid-fit` lo comprueba. Block 2 importa el tipo `GroupPicks` desde `src/lib/` (lo
define Block 2, y Block 1 lo reusa desde `src/lib/group-picks.ts`: `src/lib/` no importa de
`src/server/`). Por eso Block 1 crea el archivo con los tipos, y Block 2 agrega las funciones.

## Block 1 — `listGroupPicks` en el servicio de grupos

**Files**
- `src/lib/group-picks.ts` (new) — solo los tipos `FriendPicks = { name: string; initials: string;
  showIds: string[] }` y `GroupPicks = { id: string; name: string; friends: FriendPicks[] }`.
- `src/server/groups.ts` (modified) — `listGroupPicks(userId)` como método de `GroupsService` y
  export de módulo (`shared().listGroupPicks`).
- `tests/unit/server/groups.test.ts` (modified) — regla de `fakeDb` para la consulta nueva, y el
  test de errores pasa de 6 a 7 métodos (`log` llamado 7 veces).
- `tests/integration/groups.test.ts` (modified) — casos de privacidad y orden contra PostgreSQL.

**Logic**
Implements FR-02 (sin el propio usuario), FR-05 (solo lo guardado) y la base de FR-01, FR-04 y FR-06.
Una consulta parametrizada:

```sql
SELECT g.id AS group_id, g.name AS group_name, u.name AS member_name,
       COALESCE(array_agg(s.show_id ORDER BY s.show_id) FILTER (WHERE s.show_id IS NOT NULL), '{}') AS show_ids
FROM group_members me
JOIN groups g ON g.id = me.group_id
LEFT JOIN group_members m ON m.group_id = g.id AND m.user_id <> me.user_id
LEFT JOIN users u ON u.id = m.user_id
LEFT JOIN selected_shows s ON s.user_id = m.user_id
WHERE me.user_id = ${userId}
GROUP BY g.id, g.name, me.joined_at, m.user_id, m.joined_at, u.name
ORDER BY me.joined_at DESC, g.id, m.joined_at, m.user_id
```

Agrupa en orden: un grupo por `group_id`, en el orden de `me.joined_at DESC`, así `groups[0]` es el
grupo al que el usuario se unió último (FR-04). Un grupo sin otros integrantes aparece con
`friends: []`: la fila tiene `member_name` nulo. Las iniciales salen de `initialsOf(name)`. Ningún
`user_id` de un amigo sale de la función (R-02). El `userId` siempre sale de la sesión verificada y
la consulta parte de la membresía de esa sesión (R-01).

**Data model**
- Reuses `groups`, `group_members` and `users` from FEAT-006a and `selected_shows` from FEAT-003a —
  no schema change; constraints as declared there: `group_members` PK (`group_id`, `user_id`), FK a
  `groups` y `users` con `ON DELETE CASCADE`, índice en `user_id`, `joined_at` NOT NULL
  `timestamptz(3)`; `selected_shows` PK (`user_id`, `show_id`), índice en `show_id`; `groups.name`
  `varchar(40)` NOT NULL.

**Input validation**
- `userId`: string de la sesión verificada (`getCurrentUser`); nunca viene del cliente. Se pasa
  como parámetro del tagged template, nunca concatenado.

**Error handling**
- La base no responde o la consulta falla → `{ ok: false, code: "SERVICE_UNAVAILABLE" }` y una línea
  `[groups] SERVICE_UNAVAILABLE at=…` sin el error, como el resto del servicio.

**Required tests**
- [ ] test-groups-picks-friends — `listGroupPicks devuelve los demás integrantes con su selección
  guardada y sin el propio usuario` — validates AC-21, AC-22
- [ ] test-groups-picks-order — `listGroupPicks ordena los grupos del más reciente al más viejo y los
  amigos por fecha de unión` — validates AC-25
- [ ] test-groups-picks-privacy — `listGroupPicks no incluye a quien está en otro grupo ni grupos
  ajenos` (integración, un tercero en otro grupo con selección; acceso no autorizado rechazado)
- [ ] test-groups-picks-saved-only — `listGroupPicks solo trae lo guardado en selected_shows` —
  validates AC-26
- [ ] test-groups-picks-alone — `un grupo sin otros integrantes aparece con friends vacío`
- [ ] test-groups-picks-no-user-ids — `el resultado no tiene ids de cuenta de los amigos`
- [ ] test-groups-picks-unavailable — `con la base caída devuelve SERVICE_UNAVAILABLE, rechazado sin
  datos, y registra una línea genérica` (sad path)

**Completion criterion**
Los 7 tests pasan en `pnpm test` y `pnpm test:integration`, y la consulta del test unitario es
parametrizada (el `userId` llega como parámetro, no en el texto SQL).

## Block 2 — Reglas puras del grupo en la grilla y la copia del dispositivo

**Files**
- `src/lib/group-picks.ts` (modified) — funciones puras:
  - `picksByShow(group: GroupPicks | undefined): Map<string, FriendPicks[]>`, vacío sin grupo;
  - `indicatorParts(friends): { initials: string[]; extra: number }`, como mucho 3 iniciales y
    `extra = friends.length - 3`;
  - `resolveGroupChoice(groups, stored): string | null | undefined`;
  - `GROUP_CHOICE_KEY_PREFIX`, `groupChoiceKey(userId)` y `parseGroupChoice(raw, userId)`;
  - `groupPicksOf(value, knownShowIds): GroupPicks[]`.
- `src/lib/offline-selection.ts` (modified) — `DeviceSnapshot` suma `groups: GroupPicks[]`.
  `parseSnapshot` lo lee con `groupPicksOf` contra los shows de la copia, y una copia sin `groups`
  da `[]`. `FORMAT_VERSION` sigue en 1.
- `src/lib/group-messages.ts` (modified) — `GROUP_PICKER_LABEL = "Grupo"`, `NO_GROUP_OPTION = "Sin
  grupo"`, `friendsPickedLabel(names)` → `"Lo eligieron: Ana Pérez, Bruno"` y `extraFriendsLabel(n)`
  → `"+n"`.
- `tests/unit/lib/group-picks.test.ts` (new)
- `tests/unit/lib/offline-selection.test.ts` (modified) — el fixture suma `groups`, el roundtrip
  espera `groups`, y se agregan casos de `groups` inválidos.
- `tests/unit/lib/group-messages.test.ts` (modified)

**Logic**
Implements FR-02 (3 iniciales y "+N"), FR-03 (sin grupo, mapa vacío), FR-04 (la elección guardada
o, si no hay, el grupo más reciente) y FR-06 (los grupos viajan en la copia).

`resolveGroupChoice(groups, stored)` devuelve:
- `undefined` si `groups` está vacío (no hay selector);
- `null` si `stored` es `{ groupId: null }`;
- `stored.groupId` si ese id está en `groups`;
- si no, `groups[0].id`.

El valor de la elección es `{ version: 1, userId, groupId: string | null }`. `parseGroupChoice` exige
que el `userId` de adentro sea el pedido y que `groupId` cumpla `GROUP_ID_PATTERN` o sea `null`.

**Data model**
- Reuses `DeviceSnapshot` from FEAT-003b (`mi-grilla:snapshot`, versión 1) — campo nuevo `groups:
  GroupPicks[]`, no nulo; constraints as declared there: una sola copia, del último usuario, borrada
  por `clearSnapshot`.
- Clave nueva `mi-grilla:group-choice:<userId>`: `{ version: 1, userId: string (≤ 64), groupId:
  string (GROUP_ID_PATTERN) | null }`.

**Input validation**
Todo lo que viene de `localStorage` es no confiable (R-04).
- `groupPicksOf`:
  - un array de 10 grupos como máximo;
  - `id` cumple `GROUP_ID_PATTERN`;
  - `name` es un string de 1 a 40 puntos de código;
  - `friends` es un array de 19 como máximo;
  - el `name` de cada amigo tiene de 1 a 100 caracteres y sus `initials`, de 0 a 4 graphemes;
  - los `showIds` no se repiten y todos están en la grilla de la copia.

  Ante cualquier falla devuelve `[]` entero, no una parte.
- `parseGroupChoice`: JSON con `version === 1`, `userId` acotado e igual al pedido, y `groupId`
  `null` o con `GROUP_ID_PATTERN`. Cualquier otra cosa → `undefined`.

**Error handling**
- `groups` inválido en la copia → `[]`; la copia sigue valiendo (la grilla offline no se pierde).
- Elección inválida, mal formada o de otra cuenta → `undefined`: se usa el grupo más reciente.
- Elección de un grupo que ya no está entre los cargados → el grupo más reciente.

**Required tests**
- [ ] test-picks-by-show — `picksByShow arma, por show, los amigos que lo eligieron en orden de
  unión` — validates AC-21
- [ ] test-picks-none — `picksByShow sin grupo devuelve un mapa vacío` — validates AC-23
- [ ] test-indicator-parts — `indicatorParts con 5 amigos da 3 iniciales y extra 2; con 3, extra 0` —
  validates AC-22
- [ ] test-resolve-choice — `resolveGroupChoice respeta la elección guardada, "Sin grupo" y, sin
  elección, el grupo más reciente` — validates AC-24, AC-25
- [ ] test-resolve-choice-stale — `una elección de un grupo que ya no está es rechazada y se usa el
  más reciente` (sad path)
- [ ] test-parse-choice-invalid — `parseGroupChoice con JSON inválido, otra versión, otro userId o
  un groupId inválido devuelve undefined` (sad path)
- [ ] test-snapshot-groups-roundtrip — `parseSnapshot conserva groups y una copia sin groups da []` —
  validates AC-27
- [ ] test-snapshot-groups-invalid — `groups inválidos (show desconocido, más de 10 grupos, nombre
  faltante) se descartan y la copia sigue valiendo` (sad path)
- [ ] test-group-picks-messages — `friendsPickedLabel y extraFriendsLabel arman los textos`

**Completion criterion**
Los 9 tests pasan, los tests existentes de `offline-selection` y `group-messages` siguen en verde
y la cobertura de `src/lib/` respeta los pisos.

## Block 3 — Selector de grupo e iniciales en la grilla (presentación)

**Files**
- `src/components/ui/native-select.tsx` (new, CLI de shadcn 4.23.0) — `NativeSelect`,
  `NativeSelectOption`.
- `src/components/group-picker.tsx` (new) — `<label>` "Grupo" + `NativeSelect` con los grupos (en el
  orden de `listGroupPicks`) y "Sin grupo" al final. El valor `""` representa "Sin grupo". Recibe
  `groups`, `value: string | null` y `onChange(groupId: string | null)`.
- `src/lib/schedule-layout.ts` (modified) — `MIN_BLOCK_HEIGHT_WITH_FRIENDS = 60` y
  `heightWithFriends(geometry, nextTop)`, que devuelve `min(max(height, 60), nextTop - top)` (sin
  show siguiente, sin tope).
- `src/components/schedule-grid.tsx` (modified) — `ScheduleGrid` recibe `friendPicks:
  ReadonlyMap<string, FriendPicks[]>`. `ShowBlock` recibe `friends`:
  - con amigos, aplica `heightWithFriends`;
  - debajo de `[data-time-line]` dibuja una fila `data-friend-picks` con `aria-hidden`: chips de
    12 px con las iniciales y "+N";
  - suma a `aria-describedby` un `<span hidden>` con `friendsPickedLabel` (el nombre accesible no
    cambia);
  - con amigos, el subtítulo pasa a `line-clamp-1`;
  - el ícono de choque se queda en la línea del horario.
- `tests/unit/components/group-picker.test.tsx` (new)
- `tests/unit/components/schedule-grid.test.tsx` (modified) — `renderFriday` y el día vacío pasan
  `friendPicks` (vacío), más los casos de iniciales.
- `tests/unit/lib/schedule-layout.test.ts` (modified) — `heightWithFriends`.

**Logic**
Implements FR-02 (las iniciales en cada show, con 3 como máximo y "+N") y la parte visual de FR-01 y
FR-03. Con `friendPicks` vacío, la grilla se ve como hoy: sin fila de iniciales. Los textos salen de
`group-messages.ts`. El selector es un componente controlado: avisa el cambio y no guarda nada.

**Data model**
- Reuses `GroupPicks` and `FriendPicks` from Block 2 (`src/lib/group-picks.ts`) — no schema change;
  constraints as declared there: `id` NOT NULL con `GROUP_ID_PATTERN`, `name` NOT NULL (1 a 40),
  como mucho 19 amigos por grupo, `showIds` unique y conocidos por la grilla.

**Input validation**
- Valor del select: solo un `id` de los `groups` recibidos o `""` ("Sin grupo"). Cualquier otro
  valor se ignora y no llama a `onChange`.

**Error handling**
- Valor del select desconocido → ignorado; el grupo en pantalla no cambia.

**Required tests**
- [ ] test-grid-friend-initials — `con un grupo elegido, el bloque muestra las iniciales de quienes lo
  eligieron y su descripción las nombra` — validates AC-21
- [ ] test-grid-friend-extra — `con 5 amigos el bloque muestra 3 iniciales y "+2"` — validates AC-22
- [ ] test-grid-friend-height — `un bloque corto con amigos mide 60 px sin pasar del show siguiente y
  conserva el horario` — validates AC-32
- [ ] test-grid-no-friends — `sin amigos el bloque no tiene fila de iniciales y su nombre accesible
  no cambia` — validates AC-23
- [ ] test-picker-options — `el selector lista los grupos y "Sin grupo", con 16 px y 44 px de alto` —
  validates AC-32
- [ ] test-picker-unknown-value — `un valor desconocido del select es rechazado y no cambia el grupo`
  (sad path)

**Completion criterion**
Los 6 tests pasan, los tests existentes de `schedule-grid` y `schedule-layout` siguen en verde y
`pnpm lint` y `pnpm typecheck` no reportan nada.

## Block 4 — El grupo en la pantalla, la página y la copia

**Files**
- `src/components/device-store.ts` (modified) — `readGroupChoice(userId)` y `writeGroupChoice(userId,
  groupId)`, con el mismo manejo de `localStorage` no disponible.
- `src/components/schedule-screen.tsx` (modified):
  - `ScheduleScreenProps` suma `groups: GroupPicks[] | null`;
  - el estado `groupChoice` arranca como `undefined` en el server y al hidratar, y en el navegador se
    adopta `readGroupChoice(userId)` una sola vez;
  - el grupo se elige con `resolveGroupChoice`;
  - `GroupPicker` va entre `AppBar` y `DayPicker`, solo si `groups` no es `null` ni está vacío;
  - al cambiar de grupo: `writeGroupChoice` y `setGroupChoice`;
  - el ref de grupos que conserva la copia (ver "Decisiones aplicadas"), y `rememberConfirmed`
    escribe `groups`.
- `src/components/offline-app.tsx` (modified) — pasa `groups={snapshot.groups}`.
- `src/app/page.tsx` (modified) — suma `listGroupPicks(user.id)` al `Promise.all`. Mapea
  `picks.ok ? picks.groups : null`, y la grilla se renderiza igual si falló.
- `tests/unit/components/schedule-screen.test.tsx` (modified) — `renderScreen` pasa `groups`, el
  `toStrictEqual` de la copia espera `groups`, más los casos del selector.
- `tests/unit/components/live-button.test.tsx` (modified) — el render de `ScheduleScreen` pasa
  `groups`.
- `tests/unit/components/device-store.test.ts` (modified) — el fixture suma `groups`, más los casos
  de la elección.
- `tests/unit/components/offline-app.test.tsx` (modified) — la copia con `groups` llega a la grilla.
- `tests/unit/app/home-page.test.tsx` (modified) — mock de `@/server/groups` y el caso de fallo.
- `tests/unit/components/app-menu.test.tsx` y `tests/unit/components/forget-device-copy.test.tsx`
  (modified) — una copia con `groups` se borra en los dos caminos (R-03).

**Logic**
Implements:
- FR-01: el selector aparece solo si hay grupos.
- FR-03: con "Sin grupo", el mapa queda vacío.
- FR-04: la elección se recuerda en el dispositivo.
- FR-06: la pantalla offline usa los grupos de la copia.

Une el servicio de Block 1, las reglas de Block 2 y la presentación de Block 3. El selector cambia
solo la vista: no escribe en el servidor.

**Data model**
- Reuses `DeviceSnapshot.groups` and `mi-grilla:group-choice:<userId>` from Block 2 — no schema
  change; constraints as declared there: `groups` no nulo y validado por `groupPicksOf`, elección
  `{ version: 1, userId, groupId | null }` validada por `parseGroupChoice`.

**Input validation**
- La elección leída del dispositivo pasa por `parseGroupChoice` (Block 2).
- El `groupId` que llega de `GroupPicker` se escribe solo si es uno de los `groups` en pantalla o
  `null`.

**Error handling**
- `localStorage` no disponible al guardar la elección → `writeGroupChoice` devuelve
  `STORAGE_UNAVAILABLE`. La pantalla lo ignora a propósito, con un comentario: el grupo elegido
  igual se ve y solo no se recuerda. No es un `catch` silencioso: el código lo devuelve
  `device-store`.
- `listGroupPicks` no disponible → `groups: null`: grilla sin selector y la copia conserva los
  grupos anteriores del mismo usuario.

**Required tests**
- [ ] test-picker-hidden-without-groups — `sin grupos no hay selector ni iniciales` — validates
  AC-20
- [ ] test-screen-friend-initials — `con el grupo elegido, la pantalla pasa sus amigos a la grilla` —
  validates AC-21
- [ ] test-picker-no-group — `"Sin grupo" saca las iniciales de la grilla` — validates AC-23
- [ ] test-picker-remembers — `el grupo elegido se guarda y al volver a montar se adopta` — validates
  AC-24
- [ ] test-picker-default-latest — `sin elección guardada se muestra el grupo más reciente` —
  validates AC-25
- [ ] test-offline-app-groups — `la grilla sin conexión muestra los indicadores de la copia` —
  validates AC-27
- [ ] test-home-page-picks-unavailable — `con listGroupPicks no disponible la grilla se muestra sin
  selector, rechazado sin romper la página` (sad path)
- [ ] test-screen-keeps-copy-groups — `con groups null, la copia conserva los grupos anteriores del
  mismo usuario y queda vacía para otra cuenta` (sad path, R-06)
- [ ] test-store-choice-unavailable — `writeGroupChoice con localStorage no disponible devuelve
  STORAGE_UNAVAILABLE` (sad path)
- [ ] test-logout-clears-groups — `cerrar sesión y /login borran la copia con los grupos` (R-03)

**Completion criterion**
Los 10 tests pasan, también los existentes que se ajustaron (`schedule-screen`, `live-button`,
`device-store`, `offline-app`, `home-page`, `app-menu`, `forget-device-copy`), `pnpm lint`,
`pnpm typecheck` y `pnpm format:check` quedan en verde, y la cobertura respeta los pisos.

## Block 5 — E2E del grupo en la grilla

**Files**
- `tests/e2e/db.ts` (new) — `insertGroup({ name, members, joinedAt })`, `insertFriends(groupId,
  friends: { name, showIds }[])` y `userIdByEmail(email)` con `pg`. Pasan por
  `assertTruncatableDatabaseUrl(process.env.DATABASE_URL)`.
- `tests/e2e/groups.ts` (modified) — recibe `join(page, link, groupId)`, que hoy es privado de
  `groups.spec.ts`.
- `tests/e2e/groups.spec.ts` (modified) — importa `join` desde `groups.ts`.
- `tests/e2e/group-grid.spec.ts` (new) — AC-20 a AC-27 y AC-32. AC-26 usa un amigo real: cuenta
  creada por la UI que se une con el link y marca un show sin guardar.
- `tests/e2e/performance.spec.ts` (modified) — AC-30: `/` con un grupo de 20 integrantes con
  selección completa del día, cargada en 2 s o menos con 4G. Los datos se arman antes de limitar la
  red.

**Logic**
Cubre de punta a punta los AC de FEAT-006c en el build de producción.

**Data model**
- Reuses `groups`, `group_members`, `users` and `selected_shows` (FEAT-003a, FEAT-006a) — no schema
  change; constraints as declared there: PK (`group_id`, `user_id`), `joined_at` NOT NULL
  `timestamptz(3)` (el helper lo escribe explícito), `users.email` único (correo con UUID), como
  mucho 20 integrantes por grupo (19 amigos + quien mira).

**Input validation**
- `DATABASE_URL` pasa por `assertTruncatableDatabaseUrl`: solo una base local o el service
  `postgres` de la CI (R-07).
- Los `showIds` del helper salen de `data/schedule.json` (`tests/e2e/grid.ts`).

**Error handling**
- `DATABASE_URL` que no es local → `UntruncatableDatabaseError` y el test no corre (R-07).

**Required tests**
- [ ] test-e2e-group-grid-no-groups — `sin grupos no hay selector ni iniciales` — validates AC-20
- [ ] test-e2e-group-grid-initials — `"Los del Lolla": Ana y Bruno eligieron Tyler, The Creator y su
  bloque muestra sus iniciales` — validates AC-21
- [ ] test-e2e-group-grid-extra — `5 amigos en el mismo show: 3 iniciales, "+2" y sin las del usuario`
  — validates AC-22
- [ ] test-e2e-group-grid-no-group — `"Sin grupo" saca las iniciales` — validates AC-23
- [ ] test-e2e-group-grid-remembers — `el grupo elegido sigue al cerrar y volver a abrir` — validates
  AC-24
- [ ] test-e2e-group-grid-latest — `la primera vez se muestra el grupo al que se unió último` —
  validates AC-25
- [ ] test-e2e-group-grid-unsaved — `lo que un amigo marcó sin guardar no aparece` — validates AC-26
- [ ] test-e2e-group-grid-offline — `sin conexión se ven los indicadores de la última carga` —
  validates AC-27
- [ ] test-e2e-group-grid-size — `a 360 px las iniciales miden al menos 12 px y el selector al menos
  44 × 44` — validates AC-32
- [ ] test-e2e-group-grid-fit — `con un amigo que eligió todo, la fila de iniciales entra en cada
  bloque de los tres días`
- [ ] test-e2e-group-grid-load — `con 4G, la grilla con 20 integrantes se ve completa con indicadores
  en 2 s o menos` — validates AC-30
- [ ] test-e2e-db-guard-rejected — `el helper con una DATABASE_URL no local es rechazado antes de
  conectarse` (sad path, unit en `tests/unit/` sobre `assertTruncatableDatabaseUrl` del helper)

**Completion criterion**
`pnpm test:e2e tests/e2e/group-grid.spec.ts --project=iphone-webkit` pasa en el bloque. En el cierre
de CODE pasa la suite completa en los 4 proyectos, con `performance.spec.ts` en los proyectos
Chromium. Siguen en verde `groups.spec.ts`, `grid.spec.ts` (nombres accesibles sin cambios) y
`offline.spec.ts`.

## Block 6 — Bloques cortos con amigos: horario a su alto y nombre a 1 línea (vuelta 1)

**Files**
- `src/lib/schedule-layout.ts` (modified) — `NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS = 76`: el alto
  que necesita un bloque con amigos para el nombre en 2 líneas (padding 8 + nombre 32,5 + 2 +
  horario 15 + 2 + fila 16 ≈ 75,5 px).
- `src/components/schedule-grid.tsx` (modified):
  - `[data-time-line]` toma `leading-tight` (12 px → 15 px de alto), así no hereda los 24 px del
    `body`;
  - en un bloque con amigos cuya altura (después de `heightWithFriends`) es menor que
    `NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS`, el nombre pasa a `line-clamp-1`, que muestra "…" al
    final; sin amigos, o con altura suficiente, el nombre sigue como hasta ahora (hasta 2 líneas,
    NFR-04 de FEAT-003a).
- `tests/unit/components/schedule-grid.test.tsx` (modified)
- `tests/unit/lib/schedule-layout.test.ts` (modified)

**Logic**
Implements FR-02 (las iniciales se ven en cada show, también en los bloques cortos) y AC-32 (la
fila mide al menos 12 px y queda dentro del bloque), sin ocultar el horario (FR-03 de FEAT-003a).
Con el horario a 15 px, un bloque de 60 px con el nombre en 1 línea mide 8 + 16,25 + 2 + 15 + 2 +
16 = 59,25 px y entra. El nombre accesible del bloque no cambia: el recorte es solo visual.

**Data model**
- Reuses `FriendPicks` from Block 2 (`src/lib/group-picks.ts`) — no schema change; constraints as
  declared there: `name` NOT NULL (1 a 100), `showIds` unique y conocidos por la grilla, como mucho
  19 amigos por grupo.

**Error handling**
- Sin condiciones de error propias: es presentación sobre datos ya validados en el Block 2.

**Required tests**
- [ ] test-grid-short-name-clamp — `un bloque corto con amigos recorta el nombre a 1 línea y conserva
  el nombre accesible completo` — validates AC-32
- [ ] test-grid-tall-name-unclamped — `un bloque con amigos y altura suficiente, o sin amigos, no
  recorta el nombre` — validates AC-21
- [ ] test-grid-time-line-height — `la línea del horario tiene leading-tight y no hereda el alto de
  línea del body` — validates AC-32
- [ ] test-name-two-lines-threshold — `NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS vale 76 y deja afuera a
  los bloques de 60 px` — validates AC-32

**Completion criterion**
Los 4 tests pasan, los existentes de `schedule-grid` y `schedule-layout` siguen en verde (nombres
accesibles sin cambios), y `test-e2e-group-grid-fit` (Block 5) pasa en `iphone-webkit`,
`mobile-chromium` y `mobile-360`.

## Final verification
- `validate_spec.py --tier FEATURE` y `validate_threat.py --spec docs/daw/specs/spec-FEAT-006c.md`
  pasan.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (pisos 80/70/80),
  `pnpm test:integration` y la suite E2E completa (4 proyectos) en verde.
- Ninguna selección de alguien fuera de los grupos del usuario llega a la pantalla, y ningún id de
  cuenta de un amigo sale del servidor (R-01, R-02).
- El horario de todos los bloques sigue visible y su nombre accesible no cambia (FR-03 y NFR-04 de
  FEAT-003a).
