# Spec FEAT-006a: Crear grupos, invitar y unirse

| Field | Value |
|-------|-------|
| Ticket | FEAT-006a |
| PRD | docs/daw/prd/prd-FEAT-006a.md |
| Tier | FEATURE |
| Date | 2026-11-18 |
| Spec loops | 3 |
| Loops since last human decision | 0 |

## Vuelta 3 (VERIFY → PLAN, decisiones del usuario, 2026-11-18)

- **"Generar link nuevo" sin confirmación.** El usuario no confirmó el `AlertDialog` de R-14: al
  tocar "Generar link nuevo" se genera el link y el anterior deja de funcionar en el momento. R-14
  pasa a riesgo aceptado en el modelo de amenazas.
- **Ids de test.** Cada test de **Required tests** abre con un identificador `test-…`, porque
  F-VER-06 (`validate_verify.py`) solo reconoce nombres con esa forma. El nombre descriptivo sigue a
  continuación y es el nombre real del test en el código.
- Las otras decisiones de VERIFY (AC-13 cumple con la lista actual; la parte de selecciones de AC-29
  pasa a FEAT-006c; la clave del token derivada de `BETTER_AUTH_SECRET` y el integrante con link
  vencido que va al grupo) no cambian la spec.

## Summary
Tres tablas nuevas en PostgreSQL (`groups`, `group_members`, `group_invites`) y un servicio
`src/server/groups.ts` con resultados tipados por código, como `selection.ts`: SQL parametrizado,
`userId` siempre de la sesión verificada, reloj inyectable. El token de invitación se guarda como
HMAC (para buscar) y cifrado con AES-256-GCM (para mostrarlo a los integrantes), nunca en claro
(ADR-006). Server Actions delgadas en `src/app/group-actions.ts`. Rutas nuevas: `/grupos`,
`/grupos/[groupId]` e `/invitacion/[token]`. Login y registro aceptan un único destino de vuelta,
`/invitacion/<token>`, validado por lista blanca. Son 4 bloques: datos y servicio; pantallas de
grupos; invitación y vuelta después de entrar; E2E. Incorpora R-01 a R-16 de
`docs/daw/security/threat-FEAT-006a.md`, los 17 gaps del Impact Check y los 17 hallazgos de la
auditoría de arquitectura de PLAN (ronda 2 de esta spec).

### Decisiones aplicadas
- **Del usuario (2026-11-18, DEFINE):** partición en FEAT-006a (este ticket, 15 AC), FEAT-006b y
  FEAT-006c; cada uno desde `main`, sin apilar.
- **Técnica — ADR-006, el token.** 32 bytes de `crypto.randomBytes` en base64url (43 caracteres,
  256 bits). `src/server/invite-crypto.ts` deriva dos claves con `hkdfSync("sha256",
  BETTER_AUTH_SECRET, …)` (una para HMAC-SHA256, otra para AES-256-GCM) y expone
  `hashToken(token)` y `sealToken(token)` / `openToken(ciphertext)`. La base guarda `token_hash`
  (único) y `token_ciphertext` (`iv.tag.datos` en base64url); el token nunca se guarda en claro
  (R-12). El servicio recibe estas funciones por inyección, así los tests unit no dependen del
  secreto.
- **Técnica — el destino de vuelta (ADR-006, R-10).** `safeReturnPath(value: unknown): string |
  null` devuelve `value` solo si es un string que cumple exactamente
  `^/invitacion/[A-Za-z0-9_-]{43}$`; cualquier otra cosa (un array, otra ruta, `//host`, `https:`,
  `\`, espacios, texto codificado) → `null`. Las páginas y los formularios solo reciben el resultado
  de `safeReturnPath`, nunca el valor crudo de `searchParams`; los links entre login y registro se
  arman con `URLSearchParams` (hallazgo 6).
- **Técnica — reloj inyectable.** El servicio recibe `now: () => Date` (por defecto la hora real),
  como `login-throttle.ts`, y escribe todas las fechas desde ese reloj (`created_at`, `joined_at`,
  `expires_at`), sin defaults de PostgreSQL en las escrituras del servicio. El link vale mientras
  `now < expires_at` y `expires_at = created_at + 72 h`: a las 72 h exactas ya no vale, dentro del
  minuto de margen de NFR-01 (AC-09 dice "más de 72 horas").
- **Técnica — límites y carreras (R-03, R-13).** Todas las escrituras corren en una transacción.
  Crear bloquea la fila del usuario (`SELECT … FROM users … FOR UPDATE`) y cuenta sus grupos (< 10).
  Unirse busca el grupo por `token_hash`, bloquea la fila del usuario y después la del grupo
  (`SELECT … FROM groups … FOR UPDATE`, siempre en ese orden para no generar deadlocks), y recién
  ahí vuelve a leer la invitación del grupo y comprueba que el hash coincide y que no venció,
  cuenta integrantes (< 20) y grupos del usuario (< 10). `regenerateInvite` bloquea la misma fila
  del grupo antes de reemplazar la invitación. Así un link reemplazado no une a nadie aunque las dos
  cosas pasen a la vez (hallazgo 2).
- **Técnica — un solo administrador.** `group_members.is_admin` con índice único parcial
  `(group_id) WHERE is_admin`, agregado a mano al SQL de la migración con un comentario, y otro
  comentario en `schema.prisma` que avisa que `prisma migrate dev` puede proponer borrarlo
  (hallazgo 10).
- **Técnica — nombre del grupo (hallazgo 1).** Se cuenta en puntos de código (`Array.from(name)`),
  la misma unidad que `varchar(40)` de PostgreSQL: de 1 a 40 tras `trim`. El `Input` no usa
  `maxLength` (cuenta unidades UTF-16): la validación es la del servidor, con su mensaje.
- **Técnica — privacidad (R-04).** Toda lectura de un grupo filtra por la membresía del usuario de
  la sesión; ajeno, inexistente o id mal formado dan `NOT_FOUND` y la página responde `notFound()`.
- **Técnica — vista previa (hallazgo 3).** `getInvitePreview(userId, token)` devuelve
  `{ ok: true; groupId; name; memberCount; alreadyMember }` | `INVALID_INVITE`. Si el usuario ya es
  integrante del grupo de ese token, va al grupo aunque el link haya vencido o lo hayan reemplazado:
  FR-10 lo manda al grupo y el mensaje de FR-08 ("pedile uno nuevo a alguien del grupo") no le
  sirve a quien ya está. Para buscar el grupo de un token vencido se usa `token_hash`; uno
  reemplazado ya no está en la base, así que para él vale el mensaje de FR-08.
- **Técnica — orden.** `listGroups`: los grupos por `joined_at` del usuario, del más reciente al más
  viejo, desempate por `group_id`; los integrantes por `joined_at` ascendente, desempate por
  `user_id` (hallazgo 9).
- **Técnica — iniciales.** `initialsOf(name)`: con dos o más palabras, la primera letra de la
  primera y de la última; con una, sus dos primeros grafemas (`Intl.Segmenter`); en mayúsculas
  `es-AR`. "Ana Pérez" → "AP", "Bruno" → "BR".
- **Técnica — vencimiento visible (FR-04).** `formatInviteExpiry(date)`: "Vence el viernes 21/11 a
  las 03:15", con `Intl.DateTimeFormat("es-AR", { timeZone: FESTIVAL_TIME_ZONE })`.
- **Técnica — la URL del link (hallazgo 8).** `InviteLink` es un componente de cliente y arma
  `${window.location.origin}/invitacion/${token}`; el servidor no usa el header `Host`.
- **Técnica — compartir.** "Compartir link" usa `navigator.share({ title, text, url })` dentro del
  toque si existe (patrón de `wallpaper-delivery.ts`; `AbortError` = la persona canceló, sin
  mensaje); si no, `navigator.clipboard.writeText` y "Link copiado"; si falla, el link queda
  visible y seleccionable con "No pudimos copiarlo: mantené apretado el link para copiarlo".
- **Técnica — "Generar link nuevo" sin confirmación (R-14, riesgo aceptado por el usuario en la
  vuelta 3).** Tocarlo genera el link nuevo en el momento; no hay `AlertDialog`.
- **Técnica — sin conexión.** `/grupos` e `/invitacion/*` sin conexión caen en la tarjeta "Sin
  conexión" del service worker (`sw.ts`, `offline-app.tsx`), sin cambios. El aviso "Necesitás
  conexión" de las acciones es FEAT-006b.
- **Técnica — navegación.** "Grupos" en el menú (`AppMenu`, dentro del bloque `data-vaul-no-drag`).
  `/grupos` tiene "Volver a la grilla" y `/grupos/[groupId]` "Volver a Grupos". Crear y unirse
  terminan en la pantalla del grupo.
- **Técnica — R-16 de FEAT-002.** Se actualizan los comentarios que decían "sin parámetro de vuelta"
  en `src/proxy.ts` y `src/app/auth-actions.ts`; el modelo de FEAT-002 queda como registro de su
  momento y este modelo (R-10) registra el cambio (hallazgo 7).

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 1, Block 2 |
| FR-02 | Block 1, Block 2, Block 3 |
| FR-03 | Block 1 |
| FR-04 | Block 2 |
| FR-05 | Block 1, Block 2 |
| FR-06 | Block 1, Block 3 |
| FR-07 | Block 3 |
| FR-08 | Block 1, Block 3 |
| FR-09 | Block 1, Block 3 |
| FR-10 | Block 1, Block 3 |
| FR-11 | Block 1, Block 2 |
| FR-12 | Block 1, Block 2, Block 4 |
| NFR-01 | Strategy: `expires_at = created_at + 72 h` con reloj inyectable; tests en el borde (71 h 59 min vale, 72 h no) en Block 1; AC-09 se cubre en integración con el reloj, no en E2E |
| NFR-02 | Strategy: 32 bytes de `crypto.randomBytes` (256 bits) en base64url; test de que el generador por defecto decodifica a 32 bytes de `randomBytes`, y de longitud, alfabeto y unicidad sobre 1000 tokens (Block 1) |
| NFR-03 | Strategy: toda lectura filtra por membresía en `groups.ts`; tests de no integrante en servicio, página y E2E (Block 1, Block 2, Block 4) |

## Dependencies between blocks
Block 2 y Block 3 dependen de Block 1 y son independientes entre sí. Block 4 depende de los tres.
Orden: 1 → 2 → 3 → 4.

## Mobile guides applied (AGENTS.md → Code conventions)
Para `/grupos`, `/grupos/[groupId]` e `/invitacion/[token]`:
- `mobile-native` "Baseline" y fix 5: botones del `Button` de shadcn de 44 × 44 o más
  (`size="lg"` o `min-h-11`), con `usePressed` y `touch-action: manipulation`.
- `mobile-native`, inputs: el nombre usa el `Input` de shadcn con `text-base` (16 px, sin zoom en
  iOS), `autoComplete="off"` y `enterKeyHint="done"`.
- `mobile-native` fixes 3 y 7: las páginas scrollean en el documento (`.app-screen`, como `/login`),
  con las safe areas de `.app-shell`.
- `design-taste-frontend`: un solo sistema; acento foam para los botones principales; copy propio en
  español; nada de iris. Cada integrante en una fila con sus iniciales en un círculo `size-11`, su
  nombre visible y "Administrador" como texto.

## Block 1 — Datos y servicio de grupos

**Files**
- `prisma/schema.prisma` (modified) — modelos `Group`, `GroupMember`, `GroupInvite`, la relación
  inversa en `User` y el comentario del índice parcial.
- `prisma/migrations/<YYYYMMDDHHMMSS>_groups/migration.sql` (new) — con
  `pnpm exec prisma migrate dev --create-only --name groups`, más el índice único parcial a mano.
- `src/lib/group-rules.ts` (new) — `normalizeGroupName`, `GROUP_NAME_MAX_LENGTH = 40`,
  `MAX_GROUP_MEMBERS = 20`, `MAX_GROUPS_PER_USER = 10`, `INVITE_TTL_MS`, `INVITE_TOKEN_PATTERN`,
  `GROUP_ID_PATTERN` (UUID), `initialsOf`.
- `src/lib/group-messages.ts` (new) — textos por código y `formatInviteExpiry`.
- `src/server/invite-crypto.ts` (new) — `generateToken`, `hashToken`, `sealToken`, `openToken`.
- `src/server/groups.ts` (new) — `createGroupsService({ db, now, generateToken, hashToken,
  sealToken, openToken, log })` y funciones compartidas.
- `tests/unit/lib/group-rules.test.ts` (new), `tests/unit/lib/group-messages.test.ts` (new)
- `tests/unit/server/invite-crypto.test.ts` (new)
- `tests/unit/server/groups.test.ts` (new) — con un `db` falso, para la cobertura.
- `tests/integration/groups.test.ts` (new) — contra PostgreSQL real.
- `tests/integration/setup.ts` (modified) — `DELETE FROM groups` antes de `DELETE FROM users`.

**Logic**
Implementa FR-01, FR-02, FR-03, FR-05, FR-06, FR-08 a FR-12 en el servidor, con las reglas de
"Decisiones aplicadas".
- `createGroup(userId, name)` → `{ ok: true; groupId }` | `INVALID_NAME` | `USER_GROUP_LIMIT` |
  `SERVICE_UNAVAILABLE`. Crea el grupo, al usuario como integrante y administrador, y su primera
  invitación.
- `listGroups(userId)` → `{ ok: true; groups: { id, name, members: { name, initials, isAdmin }[] }[] }`
  | `SERVICE_UNAVAILABLE`.
- `getGroup(userId, groupId)` → `{ ok: true; group: { id, name, members, isAdmin, invite: { token,
  expiresAt } } }` | `NOT_FOUND` | `SERVICE_UNAVAILABLE`. El token sale de `openToken`.
- `regenerateInvite(userId, groupId)` → `{ ok: true }` | `NOT_FOUND` | `NOT_ADMIN` |
  `SERVICE_UNAVAILABLE`.
- `getInvitePreview(userId, token)` → `{ ok: true; groupId; name; memberCount; alreadyMember }` |
  `INVALID_INVITE` | `SERVICE_UNAVAILABLE`.
- `joinGroup(userId, token)` → `{ ok: true; groupId; alreadyMember: boolean }` | `INVALID_INVITE` |
  `GROUP_FULL` | `USER_GROUP_LIMIT` | `SERVICE_UNAVAILABLE`.
- Errores de la base: log `[groups] SERVICE_UNAVAILABLE at=<ISO>` sin el error (R-08). Si
  `openToken` falla (secreto rotado), el grupo se muestra sin link y con "Generá un link nuevo" para
  el administrador.

**Data model**
- `groups`: `id` text PK (UUID de `crypto.randomUUID`), `name` varchar(40) NOT NULL, `created_at`
  timestamptz(3) NOT NULL.
- `group_members`: `group_id` text NOT NULL FK → `groups.id` ON DELETE CASCADE, `user_id` text NOT
  NULL FK → `users.id` ON DELETE CASCADE, `is_admin` boolean NOT NULL default false, `joined_at`
  timestamptz(3) NOT NULL; PK `(group_id, user_id)`; index on `user_id`; unique index parcial
  `(group_id) WHERE is_admin`.
- `group_invites`: `group_id` text PK FK → `groups.id` ON DELETE CASCADE, `token_hash` char(64) NOT
  NULL unique, `token_ciphertext` text NOT NULL, `created_at` timestamptz(3) NOT NULL, `expires_at`
  timestamptz(3) NOT NULL.
- `users`: sin columnas nuevas; relación inversa `groupMemberships` en Prisma.
- Rollback: la migración solo crea las tres tablas y sus índices; revertir es una migración inversa
  con `DROP TABLE group_invites, group_members, groups`, que pierde solo los datos de grupos.

**Input validation**
- `name`: string; `trim`; de 1 a 40 puntos de código; otro tipo → inválido.
- `groupId`: string con formato UUID; otro → `NOT_FOUND` sin consultar la base.
- `token`: string que cumple `INVITE_TOKEN_PATTERN`; otro → `INVALID_INVITE` sin consultar la base
  (R-05).
- `userId`: siempre de la sesión verificada (R-01).

**Error handling**
- Nombre vacío, solo espacios o de más de 40 puntos de código: `INVALID_NAME`, nada se guarda.
- Usuario ya en 10 grupos al crear o unirse: `USER_GROUP_LIMIT`, nada se guarda.
- Grupo con 20 integrantes al unirse: `GROUP_FULL`, nada se guarda.
- Token mal formado, desconocido, vencido o reemplazado (para un no integrante): `INVALID_INVITE`.
- Grupo ajeno, inexistente o id mal formado: `NOT_FOUND`, sin nombre ni integrantes.
- Integrante común que genera un link: `NOT_ADMIN`, el link anterior sigue.
- Ciphertext que no se puede abrir (secreto rotado): el grupo sin link, sin error para el usuario.
- Base caída: `SERVICE_UNAVAILABLE` con el log genérico.

**Required tests**
- [ ] `test-groups-crear-los-del-lolla-deja-al-usuario-como-unico` — `groups: crear "Los del Lolla" deja al usuario como único integrante y administrador` —
  validates AC-01
- [ ] `test-groups-nombre-vacio-de-41-puntos-de-codigo-o-con-emojis` — `groups: nombre vacío, de 41 puntos de código o con emojis que pasan de 40 es inválido` —
  validates AC-02
- [ ] `test-groups-el-grupo-nace-con-un-link-que-vence-a-las-72-h` — `groups: el grupo nace con un link que vence a las 72 h` — validates AC-03
- [ ] `test-groups-generar-un-link-nuevo-invalida-el-anterior` — `groups: generar un link nuevo invalida el anterior` — validates AC-05
- [ ] `test-groups-un-integrante-comun-que-genera-un-link-es` — `groups: un integrante común que genera un link es rechazado (NOT_ADMIN)` — validates AC-06
- [ ] `test-groups-unirse-con-un-link-vigente-suma-al-usuario` — `groups: unirse con un link vigente suma al usuario` — validates AC-07
- [ ] `test-groups-un-link-de-hace-72-h-es-invalido-y-no-une-a-las` — `groups: un link de hace 72 h es inválido y no une; a las 71 h 59 min todavía vale` —
  validates AC-09
- [ ] `test-groups-con-20-integrantes-el-grupo-esta-completo-y` — `groups: con 20 integrantes el grupo está completo y unirse es rechazado` — validates AC-10
- [ ] `test-groups-con-10-grupos-unirse-y-crear-son-rechazados` — `groups: con 10 grupos unirse y crear son rechazados` — validates AC-11
- [ ] `test-groups-el-integrante-que-abre-su-propio-link-vigente-o` — `groups: el integrante que abre su propio link, vigente o vencido, no se duplica` — validates
  AC-12
- [ ] `test-groups-la-lista-trae-los-grupos-con-integrantes` — `groups: la lista trae los grupos con integrantes, iniciales y administrador, en orden` —
  validates AC-13
- [ ] `test-groups-un-no-integrante-es-rechazado-y-no-recibe-nombre` — `groups: un no integrante es rechazado y no recibe nombre ni integrantes` — validates AC-29
- [ ] `test-invite-crypto-generador-32-bytes-y-1000-tokens-distintos` — `invite-crypto: el generador por defecto usa 32 bytes de randomBytes y 1000 tokens no se
  repiten` — validates AC-31
- [ ] `test-groups-la-fila-de-la-invitacion-no-contiene-el-token-en` — `groups: la fila de la invitación no contiene el token en claro` — R-12
- [ ] `test-groups-con-el-grupo-bloqueado-la-union-numero-21-espera` — `groups: con el grupo bloqueado, la unión número 21 espera y es rechazada` — R-03 (una
  transacción auxiliar toma el `FOR UPDATE` del grupo, se lanza la unión, se suma el integrante 20 y
  se libera; sin el lock el test falla)
- [ ] `test-groups-con-el-usuario-bloqueado-unirse-a-dos-grupos-en` — `groups: con el usuario bloqueado, unirse a dos grupos en 9 deja una rechazada` — R-03
- [ ] `test-groups-unirse-con-el-link-viejo-mientras-se-regenera-es` — `groups: unirse con el link viejo mientras se regenera es rechazado` — R-13 (el lock del grupo
  tomado por `regenerateInvite` se fuerza con una transacción auxiliar)
- [ ] `test-groups-token-mal-formado-es-invalido-sin-consultar-la` — `groups: token mal formado es inválido sin consultar la base` — sad path (R-05)
- [ ] `test-groups-id-de-grupo-mal-formado-es-rechazado-sin` — `groups: id de grupo mal formado es rechazado sin consultar la base` — sad path
- [ ] `test-groups-un-ciphertext-que-no-abre-muestra-el-grupo-sin` — `groups: un ciphertext que no abre muestra el grupo sin link` — error
- [ ] `test-groups-con-la-base-caida-devuelve-service-unavailable-y` — `groups: con la base caída devuelve SERVICE_UNAVAILABLE y registra solo el código` — error
  (R-08)
- [ ] `test-groups-un-segundo-administrador-en-el-mismo-grupo-es` — `groups: un segundo administrador en el mismo grupo es rechazado por el índice parcial` —
  error (en `tests/integration/groups.test.ts`)
- [ ] `test-group-rules-iniciales-de-una-dos-y-mas-palabras-con` — `group-rules: iniciales de una, dos y más palabras, con tildes y emojis` — validates AC-13
- [ ] `test-group-messages-vencimiento-en-hora-de-argentina-y-texto` — `group-messages: vencimiento en hora de Argentina y texto de cada código` — validates AC-04

**Completion criterion**
Los tests de Block 1 pasan (unit en `pnpm test`, integración en `pnpm test:integration` contra la
base migrada con `pnpm db:migrate`), `prisma migrate diff` desde la migración hasta el schema no
propone cambios salvo el índice parcial documentado, y `pnpm typecheck` y `pnpm lint` pasan.

## Block 2 — Pantallas "Grupos" y detalle del grupo

**Files**
- `src/app/grupos/page.tsx` (new) — lista de grupos y formulario para crear.
- `src/app/grupos/[groupId]/page.tsx` (new) — detalle: nombre, integrantes, link y acciones.
- `src/app/group-actions.ts` (new) — `createGroupAction`, `regenerateInviteAction`.
- `src/components/create-group-form.tsx` (new)
- `src/components/group-members.tsx` (new)
- `src/components/invite-link.tsx` (new) — link, vencimiento, compartir/copiar y, para el
  administrador, "Generar link nuevo" sin confirmación.
- `src/components/app-menu.tsx` (modified) — entrada "Grupos".
- `tests/unit/components/create-group-form.test.tsx` (new), `group-members.test.tsx` (new),
  `invite-link.test.tsx` (new), `tests/unit/components/app-menu.test.tsx` (modified)
- `tests/unit/app/groups-page.test.tsx` (new), `tests/unit/app/group-page.test.tsx` (new)
- `tests/integration/group-actions.test.ts` (new) — las acciones con la cookie de sesión
  (`next-cookie-jar`, como `selection.test.ts`).

**Logic**
Implementa FR-01, FR-04, FR-05, FR-11 y FR-12 en la UI.
- Las páginas leen la sesión con `getAccounts().getCurrentUser(await headers())`; sin usuario,
  `redirect("/login")`. `params` es una `Promise` (Next 16) y se espera con `await`.
- `/grupos`: `listGroups(user.id)`; cada grupo es un link a su pantalla con su nombre y la fila de
  iniciales; abajo, `CreateGroupForm`. Sin grupos: "Todavía no estás en ningún grupo".
- `/grupos/[groupId]`: `getGroup(user.id, groupId)`; `NOT_FOUND` → `notFound()` (R-04).
  `GroupMembers` lista nombre visible, iniciales y "Administrador". `InviteLink` muestra el link,
  "Vence el …" y "Compartir link"; si `isAdmin`, "Generar link nuevo" sin confirmación (FR-05;
  R-14 aceptado; un integrante común no lo ve, AC-06).
- `createGroupAction(prev, formData)` (con `useActionState`): sesión → `createGroup` →
  `redirect("/grupos/<id>")`; si no, `{ error }` con el mensaje del código.
  `regenerateInviteAction(prev, formData)` con `groupId` oculto: sesión → `regenerateInvite` →
  `revalidatePath` de la pantalla del grupo.

**API contract**
- Method + path: Server Action `createGroupAction` (POST de Next desde `/grupos`) y
  `regenerateInviteAction` (POST desde `/grupos/[groupId]`); páginas `GET /grupos` y
  `GET /grupos/[groupId]`.
- Request: `createGroupAction`: `FormData` con `name` (string); `regenerateInviteAction`:
  `FormData` con `groupId` (string).
- Response: `createGroupAction`: redirección a `/grupos/<groupId>` o `{ error: string }`;
  `regenerateInviteAction`: `{ ok: true }` | `{ ok: false; error: string }`.
- Error codes: `INVALID_NAME`, `USER_GROUP_LIMIT`, `NOT_FOUND`, `NOT_ADMIN`, `UNAUTHENTICATED`,
  `SERVICE_UNAVAILABLE`.
- Auth: sesión de Better Auth verificada con `getCurrentUser`; Next rechaza Server Actions de otro
  origen (R-07).

**Data model**
- Reuses `groups`, `group_members` and `group_invites` from Block 1 — no schema change; constraints
  as declared there: `name` varchar(40) NOT NULL, PK `(group_id, user_id)`, `token_hash` unique NOT
  NULL, unique index parcial de administrador.

**Input validation**
- `name`: el `Input` es `required`; la validación que vale es la del servidor (Block 1).
- `groupId`: string; el servicio lo rechaza si no es un UUID de un grupo propio.

**Error handling**
- Nombre inválido: "El nombre tiene que tener entre 1 y 40 caracteres", y conserva lo escrito.
- Ya en 10 grupos: "Ya estás en 10 grupos, el máximo".
- Grupo ajeno o inexistente: `notFound()` sin datos del grupo.
- Integrante común que llama a `regenerateInviteAction`: `NOT_ADMIN`, sin cambios.
- Compartir cancelado (`AbortError`): sin mensaje; compartir y copiar fallan: "No pudimos copiarlo:
  mantené apretado el link para copiarlo".
- Base caída: "No pudimos guardar. Probá de nuevo en un rato".

**Required tests**
- [ ] `test-create-group-form-nombre-invalido-muestra-el-largo` — `create-group-form: nombre inválido muestra el largo permitido y conserva lo escrito` —
  validates AC-02
- [ ] `test-create-group-form-con-10-grupos-crear-es-rechazado-y` — `create-group-form: con 10 grupos crear es rechazado y muestra el máximo` — sad path
- [ ] `test-group-actions-crear-un-grupo-redirige-a-su-pantalla` — `group-actions: crear un grupo redirige a su pantalla` — validates AC-01
- [ ] `test-group-actions-sin-sesion-crear-es-rechazado-no` — `group-actions: sin sesión crear es rechazado (no autorizado)` — sad path (R-01)
- [ ] `test-group-actions-crear-con-la-base-caida-devuelve-el-error` — `group-actions: crear con la base caída devuelve el error genérico` — error
- [ ] `test-group-actions-un-integrante-comun-que-regenera-el-link` — `group-actions: un integrante común que regenera el link es rechazado` — validates AC-06
- [ ] `test-invite-link-muestra-el-link-el-vencimiento-y-compartir` — `invite-link: muestra el link, el vencimiento y Compartir` — validates AC-04
- [ ] `test-invite-link-compartir-usa-la-hoja-del-sistema-y-si-no` — `invite-link: Compartir usa la hoja del sistema y si no copia el link` — validates AC-04
- [ ] `test-invite-link-si-copiar-da-error-el-link-queda-visible` — `invite-link: si copiar da error, el link queda visible con el aviso` — sad path
- [ ] `test-invite-link-admin-genera-link-sin-confirmacion` — `invite-link: el administrador genera un link nuevo sin confirmación y el integrante común
  no lo ve` — validates AC-05, AC-06
- [ ] `test-group-members-nombre-iniciales-y-marca-de-administrador` — `group-members: nombre, iniciales y marca de administrador` — validates AC-13
- [ ] `test-groups-page-lista-todos-los-grupos-del-usuario` — `groups-page: lista todos los grupos del usuario` — validates AC-13
- [ ] `test-group-page-un-grupo-ajeno-responde-not-found-sin-nombre` — `group-page: un grupo ajeno responde not found sin nombre ni integrantes` — validates AC-29
- [ ] `test-group-page-sin-sesion-redirige-a-login` — `group-page: sin sesión redirige a /login` — sad path
- [ ] `test-app-menu-la-entrada-grupos-lleva-a-grupos` — `app-menu: la entrada Grupos lleva a /grupos` — validates AC-13

**Completion criterion**
Los tests de Block 2 pasan, la cobertura sigue sobre los pisos de `vitest.config.ts`, y
`pnpm typecheck`, `pnpm lint` y `pnpm format:check` pasan.

## Block 3 — Invitación y vuelta después de entrar

**Files**
- `src/app/invitacion/[token]/page.tsx` (new) — vista previa y "Unirme".
- `src/app/group-actions.ts` (modified) — `joinGroupAction`.
- `src/components/join-group-form.tsx` (new) — el botón "Unirme" (con `useActionState`) y los
  mensajes.
- `src/lib/return-path.ts` (new) — `safeReturnPath(value: unknown): string | null`.
- `src/app/auth-actions.ts` (modified) — leen `next` del `FormData` y redirigen a
  `safeReturnPath(next) ?? "/"`; comentario de R-16 actualizado.
- `src/app/login/page.tsx`, `src/app/register/page.tsx` (modified) — `searchParams.next` pasa por
  `safeReturnPath`; con sesión, redirigen a ese destino o a `/`; solo pasan al formulario el valor
  validado.
- `src/components/login-form.tsx`, `src/components/register-form.tsx` (modified) — prop opcional
  `next` (ya validada): input oculto, y el link al otro formulario armado con `URLSearchParams`.
- `src/proxy.ts` (modified) — matcher `["/", "/grupos/:path*", "/invitacion/:path*"]`; sin cookie
  de sesión, `/login`, con `?next=` solo si la ruta pasa `safeReturnPath`; comentario actualizado.
- `tests/unit/lib/return-path.test.ts` (new), `tests/unit/proxy.test.ts` (new),
  `tests/unit/components/join-group-form.test.tsx` (new),
  `tests/unit/app/invitation-page.test.tsx` (new), `tests/unit/app/login-page.test.tsx` (new),
  `tests/unit/components/login-form.test.tsx`, `register-form.test.tsx` (modified),
  `tests/integration/auth-actions.test.ts` (new) — `loginAction` y `registerAction` con `next`,
  comprobando el destino del `NEXT_REDIRECT` (hallazgo 4),
  `tests/integration/group-actions.test.ts` (modified) — `joinGroupAction`.

**Logic**
Implementa FR-06 a FR-10 en la UI.
- `/invitacion/[token]`: sin sesión, `redirect("/login?next=/invitacion/<token>")` si el token pasa
  `safeReturnPath`, o `/login` si no (FR-07). Con sesión: `getInvitePreview(user.id, token)`;
  `alreadyMember` → `redirect("/grupos/<id>")` (FR-10); `INVALID_INVITE` → "Este link de invitación
  ya no es válido. Pedile uno nuevo a alguien del grupo" (FR-08); si no, nombre del grupo,
  "N integrantes" y "Unirme" (FR-06).
- `joinGroupAction(prev, formData)` con `token` oculto: sesión → `joinGroup` →
  `redirect("/grupos/<id>")`; si no, `{ error }` con el mensaje del código (FR-09: "El grupo está
  completo (20 integrantes)" o "Ya estás en 10 grupos, el máximo").
- Un POST de "Unirme" sin cookie pasa primero por el proxy, que redirige a `/login`; la acción
  también rechaza `UNAUTHENTICATED` por si llega sin sesión válida.

**API contract**
- Method + path: Server Action `joinGroupAction` (POST de Next desde `/invitacion/[token]`);
  `loginAction` y `registerAction` (POST desde `/login` y `/register`) con el campo `next`; páginas
  `GET /invitacion/[token]`, `GET /login?next=…` y `GET /register?next=…`.
- Request: `joinGroupAction`: `FormData` con `token` (string); `loginAction`/`registerAction`: los
  campos de siempre más `next` (string opcional).
- Response: `joinGroupAction`: redirección a `/grupos/<groupId>` o `{ error: string }`; las
  acciones de cuenta redirigen a `safeReturnPath(next) ?? "/"`.
- Error codes: `INVALID_INVITE`, `GROUP_FULL`, `USER_GROUP_LIMIT`, `UNAUTHENTICATED`,
  `SERVICE_UNAVAILABLE`.
- Auth: sesión verificada con `getCurrentUser`; la vista previa también exige sesión; Next rechaza
  Server Actions de otro origen (R-07).

**Data model**
- Reuses `groups`, `group_members` and `group_invites` from Block 1 — no schema change; constraints
  as declared there: PK `(group_id, user_id)` (sin duplicados, FR-10), `token_hash` unique NOT
  NULL, `expires_at` NOT NULL.

**Input validation**
- `token` (segmento de la URL y campo de la acción): string de 43 caracteres base64url; otro →
  `INVALID_INVITE` sin consultar la base.
- `next` (query y campo del formulario): `unknown` → solo `/invitacion/<token>` exacto; otro (un
  array incluido) → se ignora.

**Error handling**
- Link vencido, reemplazado, desconocido o mal formado, para quien no es integrante: el mensaje de
  FR-08, sin el nombre del grupo y sin unir.
- Grupo con 20 integrantes: "El grupo está completo (20 integrantes)", sin unir.
- Usuario en 10 grupos: "Ya estás en 10 grupos, el máximo", sin unir.
- `next` externo, de otra ruta o con formato inválido: se ignora y el destino es `/` (R-10).
- Sin sesión al tocar "Unirme": `UNAUTHENTICATED`.
- Base caída: "No pudimos unirte. Probá de nuevo en un rato".

**Required tests**
- [ ] `test-invitation-page-con-sesion-y-link-vigente-muestra-el` — `invitation-page: con sesión y link vigente muestra el nombre, los integrantes y Unirme` —
  validates AC-07
- [ ] `test-group-actions-unirme-suma-al-usuario-y-redirige-al` — `group-actions: Unirme suma al usuario y redirige al grupo` — validates AC-07
- [ ] `test-invitation-page-sin-sesion-redirige-a-login-con-next-de` — `invitation-page: sin sesión redirige a /login con next de la invitación` — validates AC-08
- [ ] `test-auth-actions-entrar-con-next-valido-vuelve-a-la` — `auth-actions: entrar con next válido vuelve a la invitación` — validates AC-08
- [ ] `test-login-form-lleva-next-oculto-y-el-link-a-registrarse-lo` — `login-form: lleva next oculto y el link a registrarse lo conserva codificado` — validates
  AC-08
- [ ] `test-login-page-con-sesion-y-next-valido-redirige-a-la` — `login-page: con sesión y next válido redirige a la invitación` — validates AC-08
- [ ] `test-invitation-page-un-link-vencido-o-reemplazado-muestra` — `invitation-page: un link vencido o reemplazado muestra el mensaje de link inválido` —
  validates AC-09
- [ ] `test-join-group-form-grupo-completo-y-maximo-de-grupos` — `join-group-form: grupo completo y máximo de grupos muestran cuál límite se alcanzó` —
  validates AC-10, AC-11
- [ ] `test-invitation-page-un-integrante-que-abre-su-link-va-al` — `invitation-page: un integrante que abre su link va al grupo sin duplicarse` — validates AC-12
- [ ] `test-return-path-rechaza-urls-externas-otras-rutas-arrays-y` — `return-path: rechaza URLs externas, //, otras rutas, arrays y tokens inválidos` — sad path
  (R-10)
- [ ] `test-auth-actions-un-next-invalido-es-rechazado-y-el-destino` — `auth-actions: un next inválido es rechazado y el destino es /` — sad path (R-10)
- [ ] `test-login-page-un-next-invalido-no-llega-al-formulario` — `login-page: un next inválido no llega al formulario (rechazado)` — sad path (R-10)
- [ ] `test-proxy-sin-cookie-invitacion-token-va-a-login-con-next-y` — `proxy: sin cookie, /invitacion/<token> va a /login con next y /grupos sin next` — validates
  AC-08
- [ ] `test-proxy-un-token-mal-formado-no-se-lleva-en-next` — `proxy: un token mal formado no se lleva en next (rechazado)` — sad path
- [ ] `test-group-actions-unirme-sin-sesion-es-rechazado-no` — `group-actions: Unirme sin sesión es rechazado (no autorizado)` — sad path
- [ ] `test-group-actions-unirme-con-la-base-caida-devuelve-el` — `group-actions: Unirme con la base caída devuelve el error genérico` — error

**Completion criterion**
Los tests de Block 3 pasan, los tests existentes de login, registro y del proxy siguen en verde, y
`pnpm typecheck`, `pnpm lint` y `pnpm format:check` pasan.

## Block 4 — E2E de grupos

**Files**
- `tests/e2e/groups.spec.ts` (new)
- `tests/e2e/groups.ts` (new) — helpers: otra cuenta en otro contexto del navegador, crear grupo,
  leer el link.
- `tests/e2e/auth.ts` (modified) — `signUp` acepta el destino esperado.
- `tests/e2e/pwa.spec.ts` (modified) — `/grupos` e `/invitacion/<token de formato válido>` en
  `SESSION_PAGES` (R-17 de FEAT-002).

**Logic**
Contra el build de producción, con varias cuentas en contextos separados, agrupando AC por test por
el presupuesto de 10 min del job `e2e`. Los elementos se buscan por rol y nombre accesible
("Generar link nuevo", "Unirme", "Compartir link") y por los textos de `group-messages.ts`:
- crear "Los del Lolla" (AC-01) y ver el link con vencimiento y "Compartir link" (AC-04);
- la segunda cuenta abre el link con sesión y se une (AC-07); una tercera, sin sesión, entra y
  vuelve a la invitación (AC-08);
- el administrador genera un link nuevo (sin confirmación) y el anterior muestra el mensaje de
  link inválido para quien no es integrante (AC-05; AC-09 por reemplazo; el vencimiento a las 72 h
  se prueba en integración), y la segunda cuenta no ve "Generar link nuevo" (AC-06);
- abrir el link del propio grupo lleva al grupo sin duplicar (AC-12);
- "Grupos" lista con iniciales y "Administrador" (AC-13);
- una cuenta que no es integrante abre `/grupos/<id>` y no ve nombre ni integrantes (AC-29).

**Error handling**
- Sin condiciones de error propias: los casos de error son los de la app (link inválido, no
  integrante).

**Required tests**
- [ ] `test-groups-e2e-crear-un-grupo-y-ver-su-link-con-vencimiento` — `groups e2e: crear un grupo y ver su link con vencimiento` — validates AC-01, AC-04
- [ ] `test-groups-e2e-unirse-con-sesion-y-volver-a-la-invitacion` — `groups e2e: unirse con sesión y volver a la invitación sin sesión` — validates AC-07, AC-08
- [ ] `test-groups-e2e-el-link-reemplazado-deja-de-funcionar-y-el` — `groups e2e: el link reemplazado deja de funcionar y el no administrador no lo regenera` —
  validates AC-05, AC-06, AC-09
- [ ] `test-groups-e2e-abrir-el-link-propio-no-duplica-y-la-lista` — `groups e2e: abrir el link propio no duplica y la lista muestra iniciales y administrador` —
  validates AC-12, AC-13
- [ ] `test-groups-e2e-un-no-integrante-no-ve-el-grupo` — `groups e2e: un no integrante no ve el grupo` — validates AC-29

**Completion criterion**
`pnpm test:e2e tests/e2e/groups.spec.ts --project=iphone-webkit` pasa en el bloque; en el cierre de
CODE, la suite E2E completa pasa en los 4 proyectos.

## Final verification
- `validate_spec.py --tier FEATURE` y `validate_threat.py` pasan sobre esta spec y su modelo.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (con los pisos de cobertura),
  `pnpm test:integration` (con `pnpm db:migrate` aplicado) y la suite E2E completa pasan.
- Los 15 AC del PRD tienen al menos un test.
