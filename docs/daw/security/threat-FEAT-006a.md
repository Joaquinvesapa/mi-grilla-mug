# Threat model FEAT-006a: Crear grupos, invitar y unirse

| Field | Value |
|-------|-------|
| Ticket | FEAT-006a |
| Spec | docs/daw/specs/spec-FEAT-006a.md |
| Tier | FEATURE |
| Date | 2026-11-18 |

## Components
| Component | Source in the spec |
|---|---|
| `prisma/schema.prisma` + migración de grupos + `src/server/groups.ts` + `src/server/invite-crypto.ts` + `src/lib/group-rules.ts` | Block 1 |
| `src/app/grupos/page.tsx` + `src/app/grupos/[groupId]/page.tsx` + `src/app/group-actions.ts` + `src/components/invite-link.tsx` | Block 2 |
| `src/app/invitacion/[token]/page.tsx` + `src/lib/return-path.ts` + `src/app/auth-actions.ts` + `src/proxy.ts` | Block 3 |

FEAT-006a agrega las primeras tablas que comparten datos entre cuentas: un grupo, sus integrantes y
su link de invitación (ADR-006). Todo pasa por Server Actions y páginas dinámicas que verifican la
sesión con `getAccounts().getCurrentUser()`.

## Trust boundaries
- Navegador → Server Actions (`createGroupAction`, `regenerateInviteAction`, `joinGroupAction`): el
  nombre del grupo, el `groupId` y el token llegan del cliente y son datos no confiables. La
  identidad sale siempre de la sesión verificada, nunca del cliente.
- Navegador → páginas `/grupos/[groupId]` e `/invitacion/[token]`: el segmento de la URL es dato no
  confiable; la página decide qué mostrar según la membresía del usuario de la sesión.
- Persona con el link → grupo: quien tiene un token vigente puede ver el nombre y la cantidad de
  integrantes y unirse; el link viaja por canales externos (WhatsApp) fuera del control de la app.
- `/login` y `/register` → destino de vuelta: el parámetro `next` es dato no confiable y decide a
  dónde se redirige después de entrar.
- Servidor → PostgreSQL: consultas parametrizadas sobre `groups`, `group_members` y `group_invites`.

## STRIDE analysis
### `prisma/schema.prisma` + migración de grupos + `src/server/groups.ts` + `src/server/invite-crypto.ts` + `src/lib/group-rules.ts`
- **Spoofing:** el servicio recibe el `userId` de la sesión verificada (patrón de `selection.ts`); no
  hay forma de actuar como otro usuario desde el cliente (R-01).
- **Tampering:** un token adivinado permitiría unirse a un grupo ajeno: 256 bits de
  `crypto.randomBytes` lo hacen inviable (R-02). Dos uniones simultáneas podrían pasar el límite de
  20 o de 10: la transacción bloquea la fila del grupo y la del usuario con `FOR UPDATE` (R-03).
  Unirse con un link mientras el administrador lo reemplaza podría usar el link viejo: el token se
  vuelve a comprobar dentro de la transacción, después de bloquear la fila del grupo, que
  `regenerateInvite` también bloquea (R-13).
- **Repudiation:** no se registra quién se unió ni cuándo más allá de `joined_at`; para el MVP
  alcanza, y los errores se registran con un código genérico (R-08).
- **Information Disclosure:** un grupo ajeno y uno inexistente responden igual, sin nombre ni
  integrantes (R-04). La vista previa con token vigente muestra solo nombre y cantidad (FR-06).
- **Denial of Service:** crear grupos sin fin está acotado a 10 grupos por usuario (FR-02); un token
  ilegible se rechaza por formato antes de consultar la base (R-05).
- **Elevation of Privilege:** generar un link nuevo exige `is_admin` del usuario de la sesión en ese
  grupo; un integrante común recibe `NOT_ADMIN` (R-06). El índice único parcial impide dos
  administradores.

### `src/app/grupos/page.tsx` + `src/app/grupos/[groupId]/page.tsx` + `src/app/group-actions.ts` + `src/components/invite-link.tsx`
- **Spoofing:** sin sesión, las páginas redirigen a `/login`; las acciones devuelven
  `UNAUTHENTICATED` sin tocar la base (R-01).
- **Tampering:** Next rechaza Server Actions de otro origen (CSRF, R-07); el nombre se valida en el
  servidor (1 a 40 caracteres tras `trim`), no solo en el formulario.
- **Repudiation:** sin acciones que necesiten auditoría en este ticket.
- **Information Disclosure:** el nombre del grupo y de los integrantes se renderizan como texto de
  React, sin `dangerouslySetInnerHTML` (R-09); al cliente nunca llega `error.message` (R-08).
- **Denial of Service:** las acciones hacen una transacción corta por pedido; el límite de grupos
  acota lo que una cuenta puede crear.
- **Elevation of Privilege:** el botón "Generar link nuevo" solo se muestra al administrador, y la
  acción vuelve a verificarlo en el servidor (R-06).

### `src/app/invitacion/[token]/page.tsx` + `src/lib/return-path.ts` + `src/app/auth-actions.ts` + `src/proxy.ts`
- **Spoofing:** unirse exige sesión; sin ella se pasa por `/login?next=/invitacion/<token>`.
- **Tampering:** un `next` manipulado podría llevar a otro sitio o ruta: `return-path.ts` solo acepta
  `/invitacion/` más un token de 43 caracteres base64url; cualquier otra cosa vuelve a `/` (R-10).
- **Repudiation:** sin acciones que necesiten auditoría.
- **Information Disclosure:** un token vencido o reemplazado no muestra el nombre del grupo (R-04);
  el token viaja en la URL y puede quedar en el historial del navegador (R-11, aceptado).
- **Denial of Service:** probar tokens al azar no tiene chance (R-02) y el formato se valida antes de
  la base (R-05).
- **Elevation of Privilege:** abrir el link de un grupo propio no duplica la membresía (clave
  primaria `(group_id, user_id)`).

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| nombre del grupo | public (lo eligen los integrantes; visible solo para ellos y para quien tiene un link vigente) | PostgreSQL, columna `groups.name` | HTTPS |
| membresías (quién está en qué grupo, nombre visible) | PII (vincula nombres de personas) | PostgreSQL `group_members`; el nombre sale de `users.name` | HTTPS; solo a integrantes |
| token de invitación | credentials (permite unirse mientras está vigente) | nunca en claro: `token_hash` HMAC-SHA256 y `token_ciphertext` AES-256-GCM con claves HKDF de `BETTER_AUTH_SECRET` (ADR-006), 72 h de vida | HTTPS; en la URL del link |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | actuar como otro usuario desde el cliente | S | L | H | `userId` solo de `getCurrentUser()`; acciones sin sesión devuelven `UNAUTHENTICATED` |
| R-02 | adivinar un token vigente | T | L | H | 32 bytes de `crypto.randomBytes` (256 bits), test de longitud y unicidad (AC-31) |
| R-03 | dos uniones simultáneas superan 20 integrantes o 10 grupos | T | M | M | transacción con `FOR UPDATE` sobre el grupo y el usuario; test de integración concurrente |
| R-04 | un no integrante ve el nombre o los integrantes de un grupo (IDOR) | I | M | H | toda lectura filtra por membresía; ajeno e inexistente dan la misma respuesta; tests de AC-29 |
| R-05 | tokens o ids malformados llegan a la base | D | L | L | formato validado en `group-rules.ts` antes de consultar |
| R-06 | un integrante común genera un link nuevo | E | M | M | `is_admin` verificado en el servidor; test de `NOT_ADMIN` |
| R-07 | acción disparada desde otro sitio (CSRF) | T | L | M | chequeo de origen de Server Actions de Next |
| R-08 | errores de la base llegan al cliente | I | L | M | resultados con código; log `[groups] SERVICE_UNAVAILABLE at=…` sin el error |
| R-09 | un nombre de grupo o de integrante con marcado se interpreta como HTML | T | L | M | texto renderizado por React, sin `dangerouslySetInnerHTML` |
| R-10 | redirección abierta con el parámetro `next` | T | M | H | lista blanca exacta en `return-path.ts`; tests con URLs externas, `//`, otras rutas y tokens mal formados |
| R-11 | el token queda en el historial o en un link reenviado | I | M | L | aceptado, ver abajo |
| R-12 | una base filtrada expone tokens vigentes | I | L | M | el token se guarda como HMAC (para buscar) y cifrado con AES-256-GCM (para mostrar), con claves fuera de la base (ADR-006); test de que la fila no contiene el token |
| R-13 | unirse con un link que el administrador está reemplazando | T | L | M | token re-verificado dentro de la transacción tras `FOR UPDATE` del grupo, que `regenerateInvite` también toma; test con el lock forzado |
| R-14 | el administrador reemplaza el link sin querer y corta los ya compartidos | T | M | L | aceptado, ver abajo |
| R-15 | un grupo queda sin administrador si se borra la cuenta del administrador | E | L | L | no existe borrado de cuentas en la app (fuera de alcance del PRD 02); la sucesión al salir es FEAT-006b |
| R-16 | cuentas y grupos creados en masa | D | L | L | límites por cuenta (10 grupos, 20 integrantes); el probar tokens no tiene chance (R-02) |

## Accepted risks
### R-11
- **Accepted by:** el usuario (decisión de producto: invitación solo por link, `prd-DISC-001-06.md`,
  Out of Scope, 2026-11-16)
- **Justification:** el link existe para compartirse; vence a las 72 h y el administrador puede
  reemplazarlo (FR-05).
- **Review conditions:** si se agrega invitación con aprobación del administrador o un grupo maneja
  datos más sensibles que la selección de shows.
### R-14
- **Accepted by:** el usuario (VERIFY de FEAT-006a, 2026-11-18: no confirmó el `AlertDialog` y
  eligió que "Generar link nuevo" actúe sin confirmación)
- **Justification:** el impacto es bajo: solo el administrador ve el botón y, si corta un link
  compartido sin querer, comparte el nuevo; nadie pierde datos ni accesos ya ganados.
- **Review conditions:** si alguien reporta haber cortado un link sin querer, o si FEAT-006b suma
  acciones del administrador más destructivas en la misma pantalla.

## Supply chain
No suma dependencias: `crypto.randomBytes`, `createHmac`, `hkdfSync` y `createCipheriv`
(AES-256-GCM) de `node:crypto`, Prisma 7 y Next ya están en el proyecto.

## Availability
Las acciones son transacciones cortas sobre índices; el límite de 10 grupos por usuario y 20
integrantes por grupo acota las filas por cuenta. No hay endpoints anónimos que escriban: la vista
previa de la invitación solo lee, y con un token mal formado ni siquiera consulta la base.
