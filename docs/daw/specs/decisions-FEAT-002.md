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

## Block 3 — Pantallas de registro e inicio de sesión

- El CLI de shadcn 4.23.0 genera `input` y `label` importando el paquete paraguas `radix-ui` y
  `cn`; se adaptaron al primitivo `@radix-ui/react-label` 2.1.17 (exacta, como pide la spec) y a
  `@/lib/utils`, con el motivo comentado. Un `shadcn add` futuro necesita la misma adaptación. —
  orquestador — 2026-11-17 — Block 3
- Estado del formulario: `{ formError, fieldErrors: { campo: string[] }, values: { email, name } }`
  con los mensajes ya traducidos; nunca lleva la contraseña. `FormFailure` es un tipo estructural en
  `src/lib` para no importar tipos de `src/server`. — orquestador — 2026-11-17 — Block 3
- `INVALID_INPUT` sin ningún campo con error cae en el mensaje general de `SERVICE_UNAVAILABLE`. —
  orquestador — 2026-11-17 — Block 3
- Archivo extra `src/components/form-feedback.tsx` (`FieldMessages`, `FormAlert`, `describedBy`)
  para no duplicar el render de errores entre los dos formularios. — orquestador — 2026-11-17 —
  Block 3
- Registro en el orden Nombre, Email, Contraseña, con la ayuda "Al menos 8 caracteres, con una
  letra y un número." en el `aria-describedby` de la contraseña. — orquestador — 2026-11-17 —
  Block 3
- En el inicio de sesión los errores van solo en el aviso general, sin `aria-invalid` en los
  campos, para no señalar cuál falló (NFR-04). — orquestador — 2026-11-17 — Block 3
- Copy propio: "Entrá con tu email para armar tu grilla y verla con tu grupo.", "Con tu email y una
  contraseña. El nombre es el que van a ver tus amigos en los grupos.", botones "Entrar" y "Crear
  cuenta" (con `aria-busy` mientras está pendiente), links "¿Primera vez? Creá tu cuenta" y "¿Ya
  tenés cuenta? Entrá". — orquestador — 2026-11-17 — Block 3
- `logoutAction` redirige a `/login` aunque `signOut` devuelva `SERVICE_UNAVAILABLE`: el servicio
  ya lo registró y `/` vuelve a verificar la sesión. — orquestador — 2026-11-17 — Block 3
- Los formularios reciben la Server Action por la prop `action` (las páginas pasan
  `loginAction`/`registerAction`; los tests, una acción falsa). — orquestador — 2026-11-17 —
  Block 3
- `LOGIN_LOCK_MINUTES = 15` vive en `src/lib/account-rules.ts` junto a las otras reglas; los textos
  y, desde el Block 4, `LOGIN_WINDOW_MS`/`LOGIN_LOCK_MS` de `login-throttle.ts` salen de ahí. —
  orquestador — 2026-11-17 — Block 3

## Block 4 — Protección de `/`, cierre de sesión, E2E, CI y documentación

- No hay un proyecto de Playwright de 430 px: `test-e2e-auth-screens-mobile` fija 360×780 y 430×932
  con `setViewportSize` en cada proyecto mobile, como `home.spec`. — orquestador — 2026-11-17 —
  Block 4
- `scripts/test-e2e-docker.sh` pasa por nombre solo `DATABASE_URL` y `BETTER_AUTH_SECRET`; si no
  están en el entorno del host, Next las lee del `.env` montado. `BETTER_AUTH_URL` sale de la config
  de Playwright. — orquestador — 2026-11-17 — Block 4
- `test-e2e-session-persists` registra, cierra sesión e inicia sesión por la UI, y mide `expires`
  contra el momento del inicio de sesión; busca la cookie por el sufijo `session_token`. —
  orquestador — 2026-11-17 — Block 4
- `test-e2e-protected-unauthorized` también comprueba el 307 y el `Location: /login` del proxy con
  `request.get(..., { maxRedirects: 0 })`; la cookie inventada es `better-auth.session_token`. —
  orquestador — 2026-11-17 — Block 4
- "Cerrar sesión" usa la variante `outline` del `Button` para no competir con el acento foam. —
  orquestador — 2026-11-17 — Block 4
- En `pwa.spec` el test del head abre `/login` (mismo layout raíz) y `openControlledHome` conserva
  su nombre. — orquestador — 2026-11-17 — Block 4
- Con la cookie inventada, `/` también responde 307, pero desde el `redirect("/login")` de la
  página y no desde el proxy. `test-e2e-protected-unauthorized` distingue los dos casos por el
  `content-type`: el 307 del proxy no lo trae, y la respuesta que pasó el proxy es `text/html`. Si
  cambia el nombre de la cookie, el test falla en esa aserción. — orquestador — 2026-11-17 —
  Block 4
- WebKit no arranca en este host (faltan bibliotecas del sistema): la suite E2E completa se corrió
  con `pnpm test:e2e:docker`. — orquestador — 2026-11-17 — Block 4
