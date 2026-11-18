# Decisiones de FEAT-006a fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque. En `autonomy: minimal`, "orquestador" quiere
decir que se mostró al usuario sin pedirle aprobación previa; cualquier objeción suya la revierte.

## PLAN — auditoría de arquitectura

- **El token de invitación no se guarda en claro (ADR-006, R-12).** El primer borrador lo guardaba en
  claro y aceptaba el riesgo a nombre del orquestador; la auditoría marcó que un riesgo sobre una
  credencial no lo puede aceptar el agente que implementa. Se cambió a HMAC-SHA256 para buscar y
  AES-256-GCM para mostrar, con claves HKDF de `BETTER_AUTH_SECRET`, que mitiga el riesgo en vez de
  aceptarlo y sigue cumpliendo FR-04. Si el usuario prefiere otra cosa (un hash y "generar link
  nuevo" para compartir, o una variable de entorno propia para la clave), se revisa ADR-006. —
  orquestador — 2026-11-18 — Block 1
- **Un integrante que abre un link vencido de su grupo va al grupo** (FR-10 antes que FR-08): el
  mensaje de FR-08 le pide un link nuevo "a alguien del grupo", que no le sirve a quien ya está. —
  orquestador — 2026-11-18 — Block 1, Block 3
- **Crear un grupo estando en 10 devuelve `USER_GROUP_LIMIT`**: quien lo crea queda como integrante
  (FR-01) y no puede pasar el máximo de FR-02. — orquestador — 2026-11-18 — Block 1, Block 2
- **"Generar link nuevo" pide confirmación** (R-14), aunque el PRD no lo nombra: el reemplazo corta
  los links ya compartidos. — orquestador — 2026-11-18 — Block 2

## Block 1 — Datos y servicio de grupos (de la ronda 2 de la auditoría de PLAN)

- `tests/unit/server/invite-crypto.test.ts` suma, además del generador: ida y vuelta de
  `sealToken`/`openToken`, IV de 12 bytes distinto en cada llamada, un ciphertext adulterado o
  sellado con otro secreto que no abre, y `hashToken` determinista. El ciphertext usa `group_id` como
  AAD, así no se puede mover a otra fila. — orquestador — 2026-11-18 — Block 1
- Las claves se derivan recién al usarse (perezoso): ni `groups.ts` ni `invite-crypto.ts` leen
  `BETTER_AUTH_SECRET` al importarse, porque el job `quality` de la CI no lo tiene. — orquestador —
  2026-11-18 — Block 1
- `sealToken(token, groupId)` y `openToken(ciphertext, groupId)` reciben el `groupId` como AAD (la
  spec las nombra con un argumento). — orquestador — 2026-11-18 — Block 1
- `getGroup` devuelve `invite: { token, expiresAt } | null`: `null` si el ciphertext no abre (sin
  log) o si abrirlo lanza (con el log genérico); un link vencido vuelve con su `expiresAt` y el
  Block 2 decide cómo mostrarlo. — orquestador — 2026-11-18 — Block 1
- En `joinGroup`, "ya es integrante" se comprueba después de los locks y antes de releer el link, así
  un integrante con un link vencido recibe `alreadyMember: true` (FR-10). El reloj se lee una vez por
  transacción. — orquestador — 2026-11-18 — Block 1
- `regenerateInvite` bloquea solo la fila del grupo (`FOR UPDATE OF g`) y reemplaza con un upsert;
  si la fila del usuario de la sesión no existe, `SERVICE_UNAVAILABLE` (como `selection.ts`). —
  orquestador — 2026-11-18 — Block 1
- Textos que la spec no fijaba: `NOT_FOUND` "No encontramos ese grupo.", `NOT_ADMIN` "Solo quien
  administra el grupo puede generar un link nuevo.", `UNAUTHENTICATED` "Tu sesión terminó. Volvé a
  iniciar sesión."; HKDF con salt `mi-grilla/group-invites` y dos `info` distintos. — orquestador —
  2026-11-18 — Block 1
- La migración se verificó con `prisma migrate diff --from-config-datasource` (no hay base shadow
  configurada): sin drift, y Prisma no propone borrar el índice parcial; un test de integración
  comprueba que existe. — orquestador — 2026-11-18 — Block 1
- Desvío de procedimiento: el implementador escribió el primer cambio de `schema.prisma` por shell
  en vez de Edit/Write; el contenido final se revisó en el diff. — orquestador — 2026-11-18 —
  Block 1
