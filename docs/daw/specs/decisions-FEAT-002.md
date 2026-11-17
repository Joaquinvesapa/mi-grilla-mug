# Decisiones de FEAT-002 fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque. En `autonomy: minimal`, "orquestador" quiere
decir que se mostró al usuario sin pedirle aprobación previa; cualquier objeción suya la revierte.

## Block 1 — Esquema, Better Auth y reglas de cuenta

- `validateName` devuelve `{ name }` o el código suelto (`"NAME_EMPTY"`, `"NAME_TOO_LONG"`), como
  dice la spec ("o el código"), sin envoltorio `{ ok, code }`. — orquestador — 2026-11-17 — Block 1
- El largo del nombre se cuenta en unidades UTF-16 (`.length`), igual que la contraseña y que el
  `maxLength` de HTML; un emoji cuenta 2. — orquestador — 2026-11-17 — Block 1
- `validateEmail` espera el email ya normalizado (`normalizeEmail` primero); solo chequea formato y
  largo. — orquestador — 2026-11-17 — Block 1
- El `log` inyectado en `createAuthOptions` recibe la línea completa `[auth] AUTH_INTERNAL_ERROR
  at=<ISO>` y por defecto es `console.error`; descarta también los argumentos de Better Auth. —
  orquestador — 2026-11-17 — Block 1
- `createAuthOptions` fija además `advanced.cookiePrefix` desde `sessionCookieOptions` (vale el
  default `"better-auth"`), para que el nombre de la cookie tenga una sola fuente (R-15). —
  orquestador — 2026-11-17 — Block 1
- `hasSessionCookie(request)` no recibe la URL base: `getSessionCookie` acepta la cookie con o sin
  `__Secure-`. Alcanza para el chequeo optimista; la verificación real es la de la página. —
  orquestador — 2026-11-17 — Block 1
- `createdAt` lleva `@default(now())` también en `Session`, `Account` y `Verification` (la spec lo
  listaba solo en `User`); inocuo, Better Auth escribe ambas fechas. — orquestador — 2026-11-17 —
  Block 1
- Las columnas de fecha son `TIMESTAMP(3)` sin zona (default de Prisma). El SQL crudo del Block 2
  compara contra parámetros `Date` del reloj inyectado, nunca contra `now()` de Postgres. —
  orquestador — 2026-11-17 — Block 1

## Block 2 — Servicios de cuentas y bloqueo por email

- Firmas `registerAccount(fields, headers)` y `signIn(fields, headers)`: Better Auth necesita los
  headers del pedido (la lógica de la spec ya los pasaba a `auth.api`). — orquestador — 2026-11-17
  — Block 2
- `fieldErrors` es un arreglo de códigos por campo y solo trae los campos que fallan, coherente con
  `validatePassword`. — orquestador — 2026-11-17 — Block 2
- Un `APIError` `INVALID_EMAIL` de Better Auth (su `z.email()` es más estricto, por ejemplo
  `ana@mail..com`) da `INVALID_INPUT` con `{ email: ["INVALID_EMAIL"] }` en el registro, e
  `INVALID_CREDENTIALS` + `recordFailure` en el inicio de sesión, para no distinguir la respuesta
  (NFR-04, R-09). — orquestador — 2026-11-17 — Block 2
- Si `throttle.clear` falla después de un inicio de sesión correcto, se registra
  `SERVICE_UNAVAILABLE` y se devuelve `{ ok: true }`: la sesión ya existe y la fila vence con su
  ventana. — orquestador — 2026-11-17 — Block 2
- `recordFailure` no extiende un bloqueo vigente: dura 15 minutos desde el 5.º fallo (AC-13). —
  orquestador — 2026-11-17 — Block 2
- `vitest.config.ts`, solo en el proyecto `integration`: `fileParallelism: false` (una sola base
  compartida que el setup vacía) y `server.deps.inline: ["better-auth"]` (para que el mock de
  `next/headers` llegue a `nextCookies()`). Helper nuevo `tests/integration/next-cookie-jar.ts`. —
  orquestador — 2026-11-17 — Block 2
- `test-accounts-latency`: "2 de calentamiento" se leyó como 1 registro + 1 inicio de sesión. —
  orquestador — 2026-11-17 — Block 2
- `pnpm test:integration` vacía `users` y `login_throttles` de la base de `DATABASE_URL` (la de
  desarrollo local); el setup se niega a hacerlo si el host no es local ni el de la CI. —
  orquestador — 2026-11-17 — Block 2
