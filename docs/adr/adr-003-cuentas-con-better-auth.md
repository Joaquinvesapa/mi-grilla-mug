# ADR-003: Cuentas con Better Auth

| Field | Value |
|-------|-------|
| Date | 2026-11-17 |
| Ticket | FEAT-002 |
| Status | Accepted |

## Context
FEAT-002 (`docs/daw/prd/prd-FEAT-002.md`) pidió cuentas con email y contraseña, sesión de 30 días
sin renovación, mensaje idéntico ante un inicio de sesión fallido y bloqueo por email tras 5 fallos
en 15 minutos, sin servicio de correo. Hacía falta elegir cómo guardar contraseñas y sesiones en
Next.js 16 + Prisma 7 + PostgreSQL.

## Options considered

### Option 1: implementación propia sin dependencias
- **Pros:** scrypt de `node:crypto` y sesiones en Postgres con el token hasheado; hacía exactamente
  lo que pedía el PRD y no sumaba paquetes.
- **Cons:** todo el código sensible (hash, cookies firmadas, vencimiento, comparación) quedaba a
  cargo del proyecto y de sus tests.

### Option 2: Better Auth 1.7.25
- **Pros:** librería mantenida con adaptador de Prisma; normaliza el email a minúsculas, hashea con
  scrypt, firma la cookie con HMAC, iguala el tiempo de respuesta ante un email inexistente y
  devuelve el mismo error (`INVALID_EMAIL_OR_PASSWORD`) en los dos casos; `expiresIn` y
  `disableSessionRefresh` dan la sesión fija de 30 días.
- **Cons:** dependencia grande (trae `kysely`, `zod`, adaptadores que no se usan); guarda el token
  de sesión en texto plano en la base; no trae bloqueo por email ni regla de letras y números, y no
  valida el nombre.

### Option 3: implementación propia con argon2id
- **Pros:** el algoritmo preferido por OWASP.
- **Cons:** los mismos de la opción 1, más un binario nativo (`@node-rs/argon2`).

## Decision
Se eligió la opción 2 (decisión del usuario, 2026-11-17): delegar el manejo de contraseñas y
cookies en una librería mantenida en lugar de escribirlo y sostenerlo a mano. Lo que Better Auth no
cubre se resolvió en el proyecto: el bloqueo por email en una tabla propia, y las reglas de contraseña,
nombre y formato de email en funciones puras. No se montó su handler HTTP: el registro, el inicio y
el cierre de sesión pasan por Server Actions que llaman a `auth.api`, así que la superficie pública
quedó reducida a esos formularios.

## Consequences
- Nuevas tablas de Better Auth (usuarios, sesiones, cuentas, verificaciones) y una propia para el
  bloqueo, en una migración de Prisma.
- Variables nuevas: `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL`, también en la CI.
- Las llamadas directas a `auth.api` no pasan por su rate limiter ni por su chequeo de origen: el
  freno contra la prueba de contraseñas es el bloqueo por email, y el origen lo chequean las Server
  Actions de Next.
- Un volcado de la tabla de sesiones expondría tokens válidos; se aceptó para el MVP (ver
  `docs/daw/security/threat-FEAT-002.md`).
