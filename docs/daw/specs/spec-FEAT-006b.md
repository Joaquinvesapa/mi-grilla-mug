# Spec FEAT-006b: Administrar y salir de un grupo

| Field | Value |
|-------|-------|
| Ticket | FEAT-006b |
| PRD | docs/daw/prd/prd-FEAT-006b.md |
| Tier | FEATURE |
| Date | 2026-11-18 |
| Spec loops | 1 |
| Loops since last human decision | 1 |

## Summary
Suma al servicio de grupos de FEAT-006a cuatro operaciones: renombrar, sacar a un integrante,
borrar el grupo y salir. Cada una corre en una transacción con el grupo bloqueado, y los permisos
se deciden con la fila de membresía de la sesión. La pantalla del grupo suma los controles del
administrador y "Salir del grupo", y borrar y salir piden confirmación con el `AlertDialog` de
shadcn. Un hook de cliente, `useConnectionGuard`, frena las siete acciones de grupos sin conexión
con "Necesitás conexión para hacer esto". No hay migración: alcanzan las tablas, las cascadas y el
índice parcial de FEAT-006a.

### Decisiones de diseño
- **Cómo se identifica a un integrante para sacarlo:** por su `userId`, que la página manda solo a
  los integrantes del mismo grupo (`GroupDetail.members[].userId`). `listGroups` no lo expone.
  Se valida con `USER_ID_PATTERN` (`^[A-Za-z0-9_-]{1,64}$`): Better Auth genera ids de 32
  caracteres alfanuméricos y los tests de integración usan ids literales cortos.
- **Sin conexión:** el botón queda habilitado y el intento muestra el aviso (AC-28 dice "intenta…
  dice"). El chequeo es `navigator.onLine` al enviar, como `schedule-screen.tsx`. Si la Server
  Action se rechaza por red con `onLine` en `true`, se muestra el genérico del catálogo.
- **Salir y borrar navegan con `RedirectType.replace`**, para que "Atrás" no vuelva a la pantalla
  del grupo desde la caché del router de Next (R-11).
- **Sacar a un integrante no pide confirmación:** el PRD pide confirmación solo para borrar y para
  salir (FR-01, FR-02), y el sacado puede volver con un link.
- **El texto de `NOT_ADMIN` pasa a ser genérico** ("Solo quien administra el grupo puede hacer
  esto."), porque ahora lo devuelven cuatro operaciones.
- **NFR-01 y "la selección de sus integrantes":** en este ticket no hay ninguna pantalla que muestre
  selecciones de un grupo (llegan con FEAT-006c). Acá se prueba la parte del grupo: pantalla, lista
  y "Atrás". FEAT-006c lee las selecciones con el mismo filtro de membresía.

### Vuelta 1 (auditoría de arquitectura del PLAN, 2026-11-18)
- **F1:** el lock del grupo y la lectura de la membresía van en sentencias separadas. En READ
  COMMITTED, un `SELECT … JOIN group_members … FOR UPDATE OF g` que espera el lock devuelve el
  `is_admin` de su snapshot viejo y no lo vuelve a leer. Por eso `leaveGroup` decide la promoción
  con `DELETE … RETURNING is_admin`. `regenerateInvite` de FEAT-006a tiene el mismo patrón y se
  corrige igual (W1): con salidas y promociones, un ex admin podría regenerar el link.
- **W2:** `tests/unit/components/invite-link.test.tsx` pasa al Block 1, porque el texto de
  `NOT_ADMIN` cambia ahí.
- **W3:** `GroupMembers` pasa a ser `"use client"`, con un `RemoveMemberForm` por fila (un hook no
  va dentro de un `map`). La acción llega por prop desde la página, como `regenerateAction`.
- **W4:** son siete formularios. Los seis de FR-04/AC-28 más "Borrar grupo", que también cambia el
  grupo. Protegerlo sin conexión amplía el alcance de FR-04 ("no hacer el cambio") a la acción que
  el PRD no enumera.
- **W6:** `deleteGroupAction` con `NOT_FOUND` redirige a `/grupos` igual que `leaveGroupAction`.
- **W7:** si conviven el aviso del hook y el error de la acción, gana el del hook, que se limpia en
  el próximo envío.

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 1, Block 2, Block 4 |
| FR-02 | Block 1, Block 2, Block 4 |
| FR-03 | Block 1, Block 2, Block 4 |
| FR-04 | Block 3, Block 4 |
| NFR-01 | Strategy: `getGroup` y `listGroups` filtran por la fila de membresía en cada carga (Block 1); salir, borrar y ser sacado dejan sin fila; salir y borrar navegan con `replace` (Block 2); tests de integración y E2E sobre el 100 % de los caminos de este ticket (pantalla, lista, Atrás, link viejo) |
| AC-14 | Block 1, Block 2, Block 4 |
| AC-15 | Block 1, Block 2, Block 4 |
| AC-16 | Block 2, Block 4 |
| AC-17 | Block 1, Block 4 |
| AC-18 | Block 1, Block 4 |
| AC-19 | Block 1, Block 2, Block 4 |
| AC-28 | Block 3, Block 4 |

## Dependencies between blocks
Block 1 → Block 2 → Block 3 → Block 4. Block 2 usa las operaciones del Block 1; el Block 3 protege
los formularios del Block 2 y los de FEAT-006a; el Block 4 prueba todo en el navegador.

## Mobile guides applied (AGENTS.md → Code conventions)
Para `/grupos/[groupId]` y los formularios de grupos:
- `mobile-native` "Baseline" y fix 5: todos los botones nuevos ("Sacar", "Guardar nombre", "Salir
  del grupo", "Borrar grupo" y los de los diálogos) son el `Button` de shadcn con 44 × 44 o más
  (`size="lg"` o `min-h-11`), con `touch-action: manipulation`.
- `mobile-native`, inputs: el nombre usa el `Input` de shadcn con `text-base` (16 px, sin zoom en
  iOS), `autoComplete="off"` y `enterKeyHint="done"`, como "Crear grupo".
- `mobile-native` fixes 3 y 7: la página sigue scrolleando en el documento (`.app-screen`); el
  `AlertDialog` ya respeta las safe areas (`src/components/ui/alert-dialog.tsx`).
- `gestures`: los diálogos de confirmación se cierran con "Cancelar" o tocando afuera; no se suma
  ningún gesto nuevo.
- `design-taste-frontend`: un solo sistema; las acciones destructivas usan `variant="destructive"`
  y van en una sección propia al final de la pantalla, separada de "Generar link nuevo"; copy
  propio en español; nada de iris.

## Block 1 — Servicio: renombrar, sacar, borrar y salir

**Files**
- `src/server/groups.ts` (modified) — `renameGroup`, `removeMember`, `deleteGroup`, `leaveGroup`
  en `createGroupsService` y sus wrappers exportados; `GroupDetail.members` pasa a
  `GroupDetailMember[]`.
- `src/lib/group-rules.ts` (modified) — `USER_ID_PATTERN`.
- `src/lib/group-messages.ts` (modified) — código `MEMBER_NOT_FOUND`, texto genérico de
  `NOT_ADMIN`.
- `tests/integration/groups.test.ts` (modified) — casos nuevos y `toStrictEqual` de `getGroup` con
  `userId`/`isSelf` (líneas 124-126 y 237-240).
- `tests/unit/server/groups.test.ts` (modified) — servicio con base falsa: ids inválidos,
  `SERVICE_UNAVAILABLE`, `memberRows` con `user_id`.
- `tests/unit/lib/group-rules.test.ts` (modified) — `USER_ID_PATTERN`.
- `tests/unit/lib/group-messages.test.ts` (modified) — código nuevo y texto de `NOT_ADMIN`.
- `tests/unit/components/invite-link.test.tsx` (modified) — el texto de `NOT_ADMIN` (líneas 172 y
  184).

**Logic**
Implementa FR-01, FR-02 y FR-03 en el servidor.
- `GroupDetailMember = GroupMember & { userId: string; isSelf: boolean }`. `getGroup` lee
  `m.user_id` en la consulta de integrantes y marca `isSelf` con el `userId` de la sesión.
  `GroupSummary` y `listGroups` no cambian.
- Todas las operaciones nuevas validan `groupId` con `GROUP_ID_PATTERN` (si no, `NOT_FOUND`) y
  abren una transacción en dos sentencias, como `joinGroup`: primero
  `SELECT id FROM groups WHERE id = $group FOR UPDATE` (sin fila → `NOT_FOUND`) y, ya con el lock,
  `SELECT is_admin FROM group_members WHERE group_id = $group AND user_id = $user` (sin fila →
  `NOT_FOUND`, sea un grupo ajeno o uno inexistente, R-05). La segunda sentencia toma un snapshot
  nuevo, así ve lo que commiteó quien tenía el lock. No toman el lock del usuario: ninguna suma grupos a nadie, así que el orden
  "usuario y después grupo" de `joinGroup` se respeta.
- `renameGroup(userId, groupId, name)`: `normalizeGroupName` primero (si es `null`,
  `INVALID_NAME`); bajo el lock, si no es admin, `NOT_ADMIN`; si no, `UPDATE groups SET name`.
- `removeMember(userId, groupId, memberUserId)`: `memberUserId` con `USER_ID_PATTERN` (si no,
  `MEMBER_NOT_FOUND`); bajo el lock, si no es admin, `NOT_ADMIN`; si `memberUserId === userId`,
  `MEMBER_NOT_FOUND` (para irse está "Salir"); `DELETE FROM group_members WHERE group_id AND
  user_id = memberUserId`; si no borró nada, `MEMBER_NOT_FOUND`.
- `deleteGroup(userId, groupId)`: bajo el lock, si no es admin, `NOT_ADMIN`; si no,
  `DELETE FROM groups` (las FK `ON DELETE CASCADE` borran integrantes y link).
- `leaveGroup(userId, groupId)`: bajo el lock, `DELETE FROM group_members WHERE group_id AND
  user_id = $user RETURNING is_admin` (sin fila → `NOT_FOUND`). Cuenta los que quedan: con 0,
  `DELETE FROM groups` (AC-18); si el `RETURNING` dice que era admin, promueve al de `joined_at` más
  viejo con desempate por `user_id` (`UPDATE group_members SET is_admin = true WHERE (group_id,
  user_id) = (SELECT … ORDER BY joined_at, user_id LIMIT 1)`, AC-17). La fila del admin se borra
  antes de promover, así el índice `group_members_one_admin_idx` no rechaza la transacción (R-06).
- `regenerateInvite` (FEAT-006a) pasa al mismo patrón de dos sentencias: lock del grupo y
  después `is_admin` de la sesión.
- Toda excepción de la base → `SERVICE_UNAVAILABLE` con la línea genérica de siempre (R-08 de
  FEAT-006a).

**API contract**
- Method + path: funciones del servidor (`import "server-only"`), sin ruta HTTP propia:
  `renameGroup`, `removeMember`, `deleteGroup`, `leaveGroup`; las llaman las Server Actions del
  Block 2.
- Request: `renameGroup(userId: string, groupId: unknown, name: unknown)`;
  `removeMember(userId: string, groupId: unknown, memberUserId: unknown)`;
  `deleteGroup(userId: string, groupId: unknown)`; `leaveGroup(userId: string, groupId: unknown)`.
  `userId` siempre de la sesión verificada.
- Response: `{ ok: true }` o `{ ok: false; code }`.
- Error codes: `renameGroup`: `INVALID_NAME`, `NOT_FOUND`, `NOT_ADMIN`, `SERVICE_UNAVAILABLE`;
  `removeMember`: `NOT_FOUND`, `NOT_ADMIN`, `MEMBER_NOT_FOUND`, `SERVICE_UNAVAILABLE`;
  `deleteGroup`: `NOT_FOUND`, `NOT_ADMIN`, `SERVICE_UNAVAILABLE`; `leaveGroup`: `NOT_FOUND`,
  `SERVICE_UNAVAILABLE`.
- Auth: el llamador pasa el usuario de la sesión de Better Auth; el permiso de administrador lo
  decide el servicio con la fila de membresía bajo el lock (R-02).

**Data model**
- Reuses `groups`, `group_members` and `group_invites` from FEAT-006a — no schema change;
  constraints as declared there: `groups.name` varchar(40) NOT NULL; PK `(group_id, user_id)` en
  `group_members`; FK `group_members.group_id` y `group_invites.group_id` → `groups.id`
  `ON DELETE CASCADE`; unique index parcial `group_members_one_admin_idx` sobre `group_id`
  `WHERE is_admin`; index on `group_members.user_id`.

**Input validation**
- `groupId`: string con `GROUP_ID_PATTERN` (UUID v4).
- `memberUserId`: string con `USER_ID_PATTERN` (`^[A-Za-z0-9_-]{1,64}$`).
- `name`: `normalizeGroupName` (trim, 1 a 40 puntos de código).

**Error handling**
- `groupId` mal formado, grupo ajeno o inexistente → `NOT_FOUND`, sin tocar la base de más.
- Un integrante común renombra, saca o borra → `NOT_ADMIN`; nada cambia.
- `name` vacío o largo → `INVALID_NAME`; nada cambia.
- `memberUserId` mal formado, propio o de alguien que no está → `MEMBER_NOT_FOUND`; nada cambia.
- La base falla → `SERVICE_UNAVAILABLE` y la línea `[groups] SERVICE_UNAVAILABLE at=…`; la
  transacción se revierte.

**Required tests**
- [ ] `test-remove-member-ac14` — el admin saca a un integrante y ya no figura en `getGroup` — validates AC-14
- [ ] `test-delete-group-ac15` — el admin borra el grupo y desaparece para todos (`getGroup` `NOT_FOUND` y `listGroups` sin él para cada integrante; el link deja de existir) — validates AC-15
- [ ] `test-admin-leaves-ac17` — con 3 integrantes sale el admin y el de `joined_at` más viejo pasa a admin; queda un solo admin — validates AC-17
- [ ] `test-last-member-leaves-ac18` — sale el último integrante y el grupo y su link dejan de existir — validates AC-18
- [ ] `test-left-member-rejected-ac19` — quien salió y quien fue sacado reciben `NOT_FOUND` en `getGroup` y no ven el grupo en `listGroups` — validates AC-19, NFR-01
- [ ] `test-rejoin-after-leave` — quien salió vuelve a unirse con un link vigente — validates FR-03
- [ ] `test-rename-group` — el admin renombra y `getGroup` devuelve el nombre nuevo — validates FR-01
- [ ] `test-member-leaves-keeps-admin` — sale un integrante común y el admin sigue siendo el mismo — validates FR-02
- [ ] `test-non-admin-rejected` — un integrante común que renombra, saca o borra es rechazado con `NOT_ADMIN` y nada cambia (sad path)
- [ ] `test-foreign-group-rejected` — un no integrante que renombra, saca, borra o sale es rechazado con `NOT_FOUND`, y un `groupId` inválido también (sad path)
- [ ] `test-invalid-name-rejected` — renombrar con un nombre vacío o de 41 puntos de código es rechazado con `INVALID_NAME` (sad path)
- [ ] `test-member-not-found-rejected` — sacarse a uno mismo, sacar a alguien que no está o un `memberUserId` inválido es rechazado con `MEMBER_NOT_FOUND` (sad path)
- [ ] `test-service-unavailable` — con la base caída cada operación devuelve `SERVICE_UNAVAILABLE` y registra solo la línea genérica (sad path)
- [ ] `test-concurrent-leaves` — el admin y el integrante más antiguo salen a la vez de un grupo de 3 (la segunda salida espera el lock): las dos terminan, el que queda es admin y hay exactamente un admin, sin conflicto con el índice parcial (sad path)
- [ ] `test-regenerate-after-leave-rejected` — un admin que salió y después intenta regenerar el link es rechazado con `NOT_FOUND`, y el admin promovido sí puede (sad path)

**Completion criterion**
Los 15 tests pasan con `pnpm test` y `pnpm test:integration`, y la cobertura sigue sobre los pisos.

## Block 2 — Acciones y pantalla del grupo

**Files**
- `src/app/group-actions.ts` (modified) — `renameGroupAction`, `removeMemberAction`,
  `deleteGroupAction`, `leaveGroupAction` (cada una `export async`, es `"use server"`).
- `src/app/grupos/[groupId]/page.tsx` (modified) — pasa integrantes, `isAdmin` y las acciones.
- `src/components/group-members.tsx` (modified) — pasa a `"use client"`; "Sacar" por fila para el
  admin con un `RemoveMemberForm` por fila, `key` por
  `userId`.
- `src/components/rename-group-form.tsx` (new) — "Cambiar nombre" para el admin.
- `src/components/group-danger-zone.tsx` (new) — "Salir del grupo" para todos y "Borrar grupo"
  para el admin, cada uno con su `AlertDialog`.
- `src/lib/group-messages.ts` (modified) — textos de la pantalla.
- `tests/integration/group-actions.test.ts` (modified) — las acciones nuevas con la cookie de
  sesión; `toStrictEqual` de integrantes (líneas 100 y 188) con `userId`/`isSelf`.
- `tests/unit/app/group-page.test.tsx` (modified) — mock de `@/app/group-actions` con las acciones
  nuevas; fixture de integrantes con `userId`/`isSelf`.
- `tests/unit/components/group-members.test.tsx` (modified)
- `tests/unit/components/rename-group-form.test.tsx` (new)
- `tests/unit/components/group-danger-zone.test.tsx` (new)

**Logic**
Implementa FR-01, FR-02 y FR-03 en la UI.
- Las acciones siguen el patrón de `regenerateInviteAction`: `sessionUser()` → servicio → mensaje
  del catálogo. `renameGroupAction` y `removeMemberAction` devuelven `{ ok: true } | { ok: false;
  error }` y hacen `revalidatePath` de `/grupos/<id>` y `/grupos`. `deleteGroupAction` y
  `leaveGroupAction` hacen `revalidatePath("/grupos")` y
  `redirect("/grupos", RedirectType.replace)`; las dos redirigen también con `NOT_FOUND` (la
  persona ya no está en el grupo o el grupo ya no existe).
- La página: el título con el nombre; "Integrantes" con `GroupMembers` (con `isAdmin` y
  `removeMemberAction`); si `isAdmin`, `RenameGroupForm` debajo del título; `InviteLink` como hoy;
  al final, `GroupDangerZone` con `isAdmin`.
- `GroupMembers` (`"use client"`) recibe `removeAction` por prop desde la página. Si `isAdmin`,
  cada fila que no es la propia renderiza un `RemoveMemberForm` (componente del mismo archivo, con
  su propio `useActionState`) con
  `groupId` y `memberUserId` ocultos y el botón "Sacar", con nombre accesible
  "Sacar a <nombre>". Sin confirmación (decisión de diseño). Un integrante común no ve ningún
  "Sacar" (AC-16).
- `RenameGroupForm`: `Input` con el nombre actual y "Guardar nombre"; tras guardar, "Nombre
  guardado"; con un rechazo, el mensaje del código y el texto escrito se conserva.
- `GroupDangerZone`: "Salir del grupo" abre un `AlertDialog` "¿Salir de <grupo>?" con "Cancelar"
  y "Salir"; si `isAdmin`, "Borrar grupo" abre "¿Borrar <grupo>?" ("Se borra para todos sus
  integrantes.") con "Cancelar" y "Borrar". El botón que confirma es un `submit` dentro de su
  `form` (no `AlertDialogAction`, como en `app-menu.tsx`), deshabilitado mientras envía.

**API contract**
- Method + path: Server Actions (POST de Next desde `/grupos/[groupId]`) `renameGroupAction`,
  `removeMemberAction`, `deleteGroupAction`, `leaveGroupAction`; página `GET /grupos/[groupId]`.
- Request: `FormData` con `groupId` (string) en todas; `name` (string) en `renameGroupAction`;
  `memberUserId` (string) en `removeMemberAction`.
- Response: `renameGroupAction` y `removeMemberAction`: `{ ok: true } | { ok: false; error:
  string }`; `deleteGroupAction` y `leaveGroupAction`: redirección `replace` a `/grupos` o
  `{ ok: false; error: string }`.
- Error codes: `INVALID_NAME`, `NOT_FOUND`, `NOT_ADMIN`, `MEMBER_NOT_FOUND`, `UNAUTHENTICATED`,
  `SERVICE_UNAVAILABLE` (siempre como texto del catálogo).
- Auth: sesión de Better Auth verificada con `getCurrentUser`; Next rechaza Server Actions de
  otro origen (R-07 de FEAT-006a); el permiso de admin lo decide el servicio (R-02).

**Data model**
- Reuses `groups` and `group_members` from Block 1 — no schema change; constraints as declared
  there: `groups.name` varchar(40) NOT NULL, PK `(group_id, user_id)`, FK `ON DELETE CASCADE`,
  unique index parcial `group_members_one_admin_idx`.

**Input validation**
- `groupId`, `memberUserId` y `name` se leen con `textField` (un valor que no es string queda
  como `""`) y los valida el servicio del Block 1.

**Error handling**
- Sesión vencida o inválida → `UNAUTHENTICATED` ("Tu sesión terminó…"), sin llamar al servicio.
- Rechazo del servicio → el texto del catálogo en un `FormAlert`; nada de `error.message`.
- `leaveGroupAction` con `NOT_FOUND` → redirige a `/grupos` igual.

**Required tests**
- [ ] `test-page-admin-controls` — el admin ve "Cambiar nombre", "Sacar" en cada fila menos la suya y "Borrar grupo" — validates FR-01
- [ ] `test-page-member-no-controls` — un integrante común no ve renombrar, "Sacar" ni "Borrar grupo", y sí "Salir del grupo" — validates AC-16
- [ ] `test-delete-needs-confirmation` — "Borrar grupo" no envía hasta tocar "Borrar" en el diálogo, y "Cancelar" no envía nada — validates AC-15
- [ ] `test-leave-needs-confirmation` — "Salir del grupo" no envía hasta tocar "Salir" en el diálogo — validates FR-02
- [ ] `test-action-remove-member` — `removeMemberAction` con la cookie del admin saca al integrante — validates AC-14
- [ ] `test-action-leave-redirects` — `leaveGroupAction` redirige a `/grupos` en modo `replace`, también si el grupo ya no existe — validates AC-19
- [ ] `test-action-delete-redirects` — `deleteGroupAction` borra y redirige a `/grupos` en modo `replace`, también si el grupo ya no existe — validates AC-15
- [ ] `test-action-rename` — `renameGroupAction` guarda el nombre y revalida — validates FR-01
- [ ] `test-action-unauthenticated-rejected` — sin sesión, cada acción es rechazada con el texto de `UNAUTHENTICATED` y no llama al servicio (sad path)
- [ ] `test-action-not-admin-rejected` — un integrante común que manda a mano `removeMemberAction`, `renameGroupAction` o `deleteGroupAction` es rechazado con el texto de `NOT_ADMIN` (sad path)
- [ ] `test-rename-form-invalid-rejected` — un nombre inválido muestra su mensaje rechazado y conserva el texto escrito (sad path)

**Completion criterion**
Los 11 tests pasan con `pnpm test` y `pnpm test:integration`; `pnpm typecheck` y `pnpm lint`
pasan.

## Block 3 — Sin conexión en las acciones de grupos

**Files**
- `src/components/use-connection-guard.ts` (new) — el hook.
- `src/lib/group-messages.ts` (modified) — `OFFLINE_ACTION = "Necesitás conexión para hacer
  esto"`.
- `src/components/create-group-form.tsx` (modified)
- `src/components/join-group-form.tsx` (modified)
- `src/components/invite-link.tsx` (modified) — "Generar link nuevo" (el guard va dentro del
  componente, que envía directo).
- `src/components/rename-group-form.tsx` (modified)
- `src/components/group-members.tsx` (modified) — "Sacar".
- `src/components/group-danger-zone.tsx` (modified) — "Salir" y "Borrar".
- `tests/unit/components/use-connection-guard.test.ts` (new)
- `tests/unit/components/create-group-form.test.tsx`, `join-group-form.test.tsx`,
  `invite-link.test.tsx`, `rename-group-form.test.tsx`, `group-members.test.tsx`,
  `group-danger-zone.test.tsx` (modified)

**Logic**
Implementa FR-04.
- `useConnectionGuard()` devuelve `{ message, onSubmit, guard }`:
  - `onSubmit(event)`: con `navigator.onLine === false`, `event.preventDefault()` (React no corre
    la `action` del `form`) y `message = OFFLINE_ACTION`; con conexión, `message = null`.
  - `guard(action)`: envuelve la acción de `useActionState`; si la promesa se rechaza, primero
    `unstable_rethrow(error)` (de `next/navigation`, así `redirect` y `notFound` siguen
    navegando) y después `message` = `OFFLINE_ACTION` si `navigator.onLine` es `false`, o el texto
    de `SERVICE_UNAVAILABLE`; devuelve el estado anterior.
- Los siete formularios pasan `onSubmit` y `guard(action)` y muestran `message` en su `FormAlert`.
  En los diálogos, el aviso se muestra dentro del diálogo.
- No se deshabilitan botones: el aviso aparece al intentarlo (AC-28).

**API contract**
- Method + path: sin endpoints nuevos; envuelve en el cliente los POST de Next de
  `createGroupAction` (`/grupos`), `joinGroupAction` (`/invitacion/[token]`),
  `regenerateInviteAction` y las cuatro acciones del Block 2 (`/grupos/[groupId]`).
- Request: el mismo `FormData` de cada acción, sin campos nuevos.
- Response: la misma de cada acción; sin conexión o con la promesa rechazada, el estado anterior y
  `message` del hook.
- Error codes: ninguno nuevo; el aviso `OFFLINE_ACTION` y el texto de `SERVICE_UNAVAILABLE` son del
  cliente.
- Auth: sin cambios: cada acción sigue verificando la sesión en el servidor.

**Data model**
- Reuses `groups` and `group_members` from Block 1 — no schema change; constraints as declared
  there: `groups.name` varchar(40) NOT NULL, PK `(group_id, user_id)`, FK `ON DELETE CASCADE`,
  unique index parcial `group_members_one_admin_idx`. El hook no lee ni escribe la base.

**Input validation**
- No lee campos del formulario: solo `navigator.onLine` y el resultado de la acción.

**Error handling**
- Sin conexión al enviar → "Necesitás conexión para hacer esto" y la acción no sale.
- La acción se rechaza por red → el mismo aviso si `onLine` es `false`, si no el genérico de
  `SERVICE_UNAVAILABLE`.
- Un `redirect` o `notFound` de Next llega como rechazo → `unstable_rethrow` lo relanza; no se
  muestra aviso.

**Required tests**
- [ ] `test-guard-offline-blocks` — con `navigator.onLine` en `false`, `onSubmit` cancela el envío y deja "Necesitás conexión para hacer esto" — validates AC-28
- [ ] `test-guard-online-clears` — con conexión, `onSubmit` no cancela y limpia el aviso — validates FR-04
- [ ] `test-guard-rejected-offline` — una acción rechazada sin conexión deja el aviso de conexión (sad path)
- [ ] `test-guard-rejected-online` — una acción rechazada con conexión deja el genérico, nunca el mensaje del rechazo (sad path)
- [ ] `test-guard-redirect-rethrown` — un rechazo de `redirect` de Next se relanza y no deja aviso (sad path)
- [ ] `test-guard-message-priority` — con el aviso del hook y un mensaje rechazado de la acción a la vez, el `FormAlert` muestra el del hook, y el próximo envío con conexión lo limpia (sad path)
- [ ] `test-forms-offline-ac28` — en cada formulario (crear, unirse, generar link, renombrar, sacar, salir, borrar) sin conexión aparece el aviso y la acción no se llama — validates AC-28

**Completion criterion**
Los 7 tests pasan con `pnpm test` y la cobertura sigue sobre los pisos.

## Block 4 — E2E de administrar y salir

**Files**
- `tests/e2e/groups-admin.spec.ts` (new)
- `tests/e2e/groups.ts` (modified) — helpers para unir a un segundo y un tercer usuario con el
  link, si hacen falta.
- Reusa `goOffline` de `tests/e2e/offline.ts`.

**Logic**
Prueba en el navegador FR-01 a FR-04 y NFR-01, con dos o tres contextos de Playwright (uno por
persona) y la base real.

**Data model**
- Reuses `groups` and `group_members` from Block 1 — no schema change; constraints as declared
  there: PK `(group_id, user_id)`, FK `ON DELETE CASCADE`, unique index parcial
  `group_members_one_admin_idx`. Cada test crea sus propias cuentas.

**Error handling**
- Sin condiciones de error propias: los rechazos de la app se prueban como resultado esperado en
  los tests de abajo.

**Required tests**
- [ ] `test-e2e-remove-member` — el admin saca a un integrante; ya no figura, y el sacado recibe 404 en `/grupos/<id>` y no ve el grupo en "Grupos" — validates AC-14, AC-19
- [ ] `test-e2e-member-no-controls` — un integrante común no ve renombrar, "Sacar" ni "Borrar grupo" — validates AC-16
- [ ] `test-e2e-admin-leaves` — con 3 integrantes sale el admin (confirmando) y el más antiguo ve "Administrador" y los controles — validates AC-17
- [ ] `test-e2e-last-leaves` — sale el último integrante y el grupo ya no está; su link viejo dice que no es válido — validates AC-18
- [ ] `test-e2e-delete-group` — el admin borra con confirmación y el otro integrante recibe 404 en el grupo — validates AC-15
- [ ] `test-e2e-back-after-leave` — después de salir, "Atrás" no muestra el grupo — validates NFR-01
- [ ] `test-e2e-rename` — el admin renombra y el otro integrante ve el nombre nuevo — validates FR-01
- [ ] `test-e2e-offline-ac28` — sin conexión, "Salir del grupo" confirmado dice "Necesitás conexión para hacer esto" y el integrante sigue en el grupo al volver la conexión — validates AC-28

**Completion criterion**
`pnpm test:e2e tests/e2e/groups-admin.spec.ts --project=iphone-webkit` pasa en el bloque, y la
suite completa en los 4 proyectos pasa en el cierre de CODE.

## Final verification
- `validate_spec.py --tier FEATURE` y `validate_threat.py` pasan sobre esta spec y
  `docs/daw/security/threat-FEAT-006b.md`.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (con los pisos de cobertura),
  `pnpm test:integration` y la suite E2E en los 4 proyectos pasan.
- Ningún archivo de `src/app/` ni `src/components/` importa `@prisma/*`; ninguna respuesta lleva
  un `error.message` de infraestructura.
- Rollback: no hay migración ni cambio de esquema, así que no hace falta una migración inversa;
  volver atrás es revertir el merge. Los grupos borrados o las salidas hechas mientras estuvo
  activo no se recuperan.
