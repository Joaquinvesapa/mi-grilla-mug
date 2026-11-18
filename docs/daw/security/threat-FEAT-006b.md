# Threat model FEAT-006b: Administrar y salir de un grupo

| Field | Value |
|-------|-------|
| Ticket | FEAT-006b |
| Spec | docs/daw/specs/spec-FEAT-006b.md |
| Tier | FEATURE |
| Date | 2026-11-18 |

Parte del modelo de FEAT-006a (`docs/daw/security/threat-FEAT-006a.md`): el grupo, la membresía, el
link y sus controles (R-01 sesión verificada, R-04 lecturas filtradas por membresía, R-07 Server
Actions con chequeo de origen de Next, R-08 solo códigos genéricos al cliente, R-13 lock del grupo)
siguen valiendo. Este modelo cubre las cuatro operaciones nuevas, que cambian o borran un grupo que
ya existe, y el aviso sin conexión.

## Components
| Component | Source in the spec |
|---|---|
| `src/server/groups.ts` | Block 1 (`renameGroup`, `removeMember`, `deleteGroup`, `leaveGroup`, `getGroup` con `userId`/`isSelf`; `USER_ID_PATTERN` en `src/lib/group-rules.ts`) |
| `src/app/group-actions.ts` | Block 2 (`renameGroupAction`, `removeMemberAction`, `deleteGroupAction`, `leaveGroupAction`) |
| `src/app/grupos/[groupId]/page.tsx` | Block 2 (con `src/components/group-members.tsx`, `src/components/rename-group-form.tsx` y `src/components/group-danger-zone.tsx`) |
| `src/components/use-connection-guard.ts` | Block 3 (y los formularios que lo usan; textos en `src/lib/group-messages.ts`) |

## Trust boundaries
- Navegador → Server Actions (`src/app/group-actions.ts`): el formulario manda `groupId`, `name` y
  `memberUserId`; todo es entrada no confiable. La identidad sale solo de la cookie de sesión
  verificada por Better Auth, nunca del formulario.
- Server Actions → servicio (`src/server/groups.ts`) → PostgreSQL: cada operación valida los ids con
  patrón, corre en una transacción con el grupo bloqueado (`FOR UPDATE`) y decide permisos con la
  fila de membresía de la sesión leída bajo ese lock.
- Servidor → pantalla de un integrante: la página del grupo manda el `userId` de cada integrante a
  todos los integrantes (para el formulario "Sacar"). Ningún dato cruza hacia quien no es integrante.

## STRIDE analysis
### `src/server/groups.ts`
- **Spoofing:** el `userId` llega del llamador, que lo saca de la sesión verificada (R-01 de
  FEAT-006a). Ninguna operación acepta un id de usuario del formulario como identidad: el
  `memberUserId` de "Sacar" solo dice a quién sacar, y lo hace el admin de la sesión (R-01).
- **Tampering:** un integrante común podría mandar a mano un POST a `removeMember`, `renameGroup` o
  `deleteGroup`. El servicio lee `is_admin` de la fila de la sesión bajo el lock del grupo y responde
  `NOT_ADMIN` (R-02). Las sentencias son tagged templates parametrizados; `groupId` pasa por
  `GROUP_ID_PATTERN`, `memberUserId` por `USER_ID_PATTERN` y `name` por `normalizeGroupName` antes de
  tocar la base (R-03).
- **Repudiation:** no hay auditoría de quién sacó a quién ni de quién borró un grupo; el PRD no la pide
  y los integrantes ven el resultado en la pantalla. Las fallas de infraestructura quedan con la línea
  `[groups] SERVICE_UNAVAILABLE at=…` del servicio (R-08 de FEAT-006a).
- **Information Disclosure:** quien salió o fue sacado deja de tener fila en `group_members`, y
  `getGroup`/`listGroups` filtran por esa fila: responde `NOT_FOUND` igual que un grupo ajeno (R-04).
  Las operaciones de admin sobre un grupo ajeno también responden `NOT_FOUND`, no `NOT_ADMIN`, para no
  confirmar que el grupo existe (R-05).
- **Denial of Service:** un admin y un integrante que salen a la vez, o un admin que borra mientras
  otro sale, se serializan en el lock del grupo. El lock se toma con una sentencia propia y la
  membresía se lee en otra, así el segundo ve el estado nuevo y no un `is_admin` viejo; `leaveGroup`
  decide la promoción con `DELETE … RETURNING is_admin`. `regenerateInvite` pasa al mismo patrón. La promoción del
  nuevo admin borra primero la fila del admin que sale, así el índice parcial
  `group_members_one_admin_idx` nunca rechaza la transacción (R-06).
- **Elevation of Privilege:** si sale el admin, el nuevo admin es el de `joined_at` más viejo
  (desempate `user_id`), elegido en el servidor bajo el lock, nunca por el cliente. Un integrante no
  puede volverse admin sacando al admin: sacar exige ser admin, y el admin no puede sacarse a sí mismo
  (`MEMBER_NOT_FOUND`; para irse usa "Salir") (R-02, R-07).

### `src/app/group-actions.ts`
- **Spoofing:** cada acción llama a `sessionUser()` y con una sesión inválida devuelve
  `UNAUTHENTICATED` sin tocar el servicio.
- **Tampering:** Next rechaza una Server Action posteada desde otro origen (R-07 de FEAT-006a); los
  campos del formulario se leen con `textField` y se validan en el servicio.
- **Repudiation:** igual que el servicio: no se registran acciones correctas.
- **Information Disclosure:** al cliente solo llegan textos del catálogo de `group-messages.ts`,
  nunca un `error.message` (R-08 de FEAT-006a).
- **Denial of Service:** cada acción es una transacción corta sobre un solo grupo; no hay bucles ni
  trabajo proporcional a la entrada.
- **Elevation of Privilege:** las acciones no deciden permisos: los decide el servicio con la fila de
  la sesión (R-02).

### `src/app/grupos/[groupId]/page.tsx`
- **Spoofing:** la página saca al usuario de la sesión y redirige a `/login` sin ella.
- **Tampering:** mostrar u ocultar los controles de admin es solo presentación (AC-16); el permiso
  real lo vuelve a decidir el servicio (R-02).
- **Repudiation:** borrar y salir piden confirmación con `AlertDialog` (FR-01, FR-02), así una acción
  destructiva no sale de un toque perdido (R-09).
- **Information Disclosure:** el `userId` de cada integrante viaja a los demás integrantes. No es una
  credencial (la sesión usa su propio token) y solo lo ven quienes ya ven nombre e iniciales (R-10).
  Al salir, borrar o ser sacado, quien sale navega con `redirect` en modo `replace`, así "Atrás" no
  vuelve a la pantalla del grupo desde la caché del router de Next (R-11).
- **Denial of Service:** sin superficie nueva: la página hace las mismas dos lecturas que en
  FEAT-006a.
- **Elevation of Privilege:** un no admin que manipula el DOM para mostrar "Sacar" o "Borrar grupo"
  recibe `NOT_ADMIN` del servicio (R-02).

### `src/components/use-connection-guard.ts`
- **Spoofing:** sin superficie: no maneja identidad.
- **Tampering:** solo decide si el envío sale; no cambia los campos. Un atacante que lo saltea manda
  la acción igual, y el servidor la valida como cualquier otra.
- **Repudiation:** sin superficie: no hace cambios.
- **Information Disclosure:** si la acción falla por red muestra "Necesitás conexión para hacer
  esto" o el genérico del catálogo, nunca el error del fetch (R-08 de FEAT-006a). Los errores de
  navegación de Next (`redirect`, `notFound`) se relanzan con `unstable_rethrow`, así no se tragan.
- **Denial of Service:** sin superficie: no reintenta solo.
- **Elevation of Privilege:** sin superficie: no hay permisos en el cliente.

## Data classification
| Data | Class | At rest | In transit |
|---|---|---|---|
| nombre del grupo (renombrado) | public (visible solo para integrantes y para quien tiene un link vigente) | PostgreSQL `groups.name`, en el disco del servidor de base | HTTPS (TLS) |
| membresías y nombre visible de cada integrante | PII | PostgreSQL `group_members` y `users.name`, en el disco del servidor de base | HTTPS (TLS); solo a integrantes |
| `userId` de cada integrante | PII (identificador interno de la cuenta) | PostgreSQL `users.id`, en el disco del servidor de base | HTTPS (TLS); solo a integrantes del mismo grupo, en el payload de la página |
| cookie de sesión | credentials | sin cambios: Better Auth guarda el token de sesión en `sessions` (ADR-003) | HTTPS (TLS), cookie `httpOnly` |

## Risks and mitigations
| ID | Risk | STRIDE | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-01 | Suplantar a otro usuario mandando su id en el formulario | S | M | H | La identidad sale solo de la sesión verificada; `memberUserId` es el objetivo, nunca el actor |
| R-02 | Un integrante común renombra, saca o borra con un POST armado a mano | E | M | H | El servicio lee `is_admin` de la fila de la sesión bajo `FOR UPDATE` del grupo y responde `NOT_ADMIN`; tests de integración por operación |
| R-03 | Inyección o ids mal formados en `groupId`/`memberUserId`/`name` | T | L | H | Tagged templates parametrizados; `GROUP_ID_PATTERN`, `USER_ID_PATTERN` (`^[A-Za-z0-9_-]{1,64}$`) y `normalizeGroupName` antes de la base |
| R-04 | Quien salió o fue sacado sigue viendo el grupo | I | M | H | `getGroup`/`listGroups` filtran por membresía en cada carga; test de integración y E2E de NFR-01 |
| R-05 | Una operación de admin confirma que existe un grupo ajeno | I | L | M | Grupo ajeno o inexistente responde `NOT_FOUND`, igual que hoy `getGroup` |
| R-06 | Salidas o borrados simultáneos dejan el grupo sin admin, con dos o en error | D | M | M | Todas las operaciones toman el lock del grupo; borrar la fila del admin antes de promover; test de concurrencia |
| R-07 | El grupo queda sin admin o el cliente elige al nuevo | E | L | M | Promoción en el servidor, por `joined_at` y `user_id`, en la misma transacción que la salida |
| R-08 | El último integrante sale y queda un grupo huérfano con link vivo | E | L | M | Si no quedan integrantes, `DELETE FROM groups` (cascade borra el link); test AC-18 |
| R-09 | Borrar o salir por un toque perdido | R | M | M | `AlertDialog` de confirmación en borrar y salir |
| R-10 | El `userId` de los integrantes llega a otros integrantes | I | L | L | Solo a integrantes del mismo grupo; no es credencial; `listGroups` no lo expone |
| R-11 | "Atrás" muestra la pantalla del grupo desde la caché del router después de salir | I | M | M | `redirect(..., RedirectType.replace)` en salir y borrar; E2E que vuelve Atrás y no ve el grupo |
| R-12 | El guard sin conexión se traga un `redirect` de Next y la acción parece fallar | D | M | L | `unstable_rethrow` en el `catch`; tests unit con una acción que redirige |

## Supply chain
Sin dependencias nuevas: `AlertDialog` ya está en `src/components/ui/alert-dialog.tsx` (Radix, versión
exacta, FEAT-002) y `unstable_rethrow` es de `next/navigation`, ya instalado.

## Availability
El único vector nuevo es la contención en el lock de un grupo, acotado a 20 integrantes por grupo
(`MAX_GROUP_MEMBERS`); cada transacción toca un solo grupo y termina en pocas sentencias. El riesgo
R-14 de FEAT-006a se revisó porque esta pantalla suma "Borrar grupo": borrar tiene su propia
confirmación y va en una sección aparte de "Generar link nuevo", así que R-14 queda como lo aceptó el
usuario.
