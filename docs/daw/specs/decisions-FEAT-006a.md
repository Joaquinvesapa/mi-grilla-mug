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
