# Spec FEAT-002: Cuentas

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| PRD | docs/daw/prd/prd-FEAT-002.md |
| Tier | FEATURE |
| Date | 2026-11-17 |
| Spec loops | 1 |
| Loops since last human decision | 1 |

## Summary
Cuentas con email y contraseña sobre Better Auth 1.7.25 (ADR-003, decisión del usuario), con
Prisma y PostgreSQL. No se monta el handler HTTP de Better Auth: registro, inicio y cierre de sesión
son Server Actions delgadas que llaman a `src/server/accounts.ts`, y ese módulo llama a `auth.api`.
Lo que Better Auth no cubre lo resuelve el proyecto: las reglas de email, contraseña y nombre
(`src/lib/account-rules.ts`) y el bloqueo por email, con una reserva atómica en una tabla propia
(`src/server/login-throttle.ts`). La pantalla principal `/` pasa a requerir sesión: el proxy de
Next 16 redirige de forma optimista sin cookie, y la página verifica de verdad. Son 4 bloques:
esquema y configuración; servicios; pantallas; protección, E2E, CI y documentación. Incorpora las
mitigaciones R-01 a R-18 de `docs/daw/security/threat-FEAT-002.md` y los 9 gaps del Impact Check y
los 13 hallazgos de la auditoría de arquitectura de PLAN.

### Decisiones del usuario aplicadas (2026-11-17)
- Los 14 AC en un solo ticket (Scope Check de DEFINE).
- Better Auth en lugar de una implementación propia (ADR-003).
- Riesgos aceptados: tokens de sesión sin hashear y datos de cuenta sin cifrado de columna en la
  base (R-04); sin límite por IP para ráfagas sobre muchos emails (R-03).

### Dependencias nuevas (versión exacta)
- `better-auth` 1.7.25 (ADR-003). Publicada el 2026-11-14. Si pnpm 12 la rechaza por la ventana de
  antigüedad, se agrega una excepción por versión exacta en `minimumReleaseAgeExclude` de
  `pnpm-workspace.yaml`, con su motivo, como se hizo con Serwist.
- `@radix-ui/react-label`, la que trae `label` de shadcn (new-york), en la última estable el día del
  Block 3. AGENTS.md pide los componentes reales de shadcn.

### Catálogo de códigos (`src/server`) y mensajes (`src/lib/account-messages.ts`)
| Código | Mensaje en la UI |
|---|---|
| `INVALID_EMAIL` | "Ese email no es válido." |
| `PASSWORD_TOO_SHORT` | "La contraseña tiene que tener al menos 8 caracteres." |
| `PASSWORD_TOO_LONG` | "La contraseña puede tener hasta 128 caracteres." |
| `PASSWORD_NEEDS_LETTER` | "La contraseña tiene que incluir al menos una letra." |
| `PASSWORD_NEEDS_NUMBER` | "La contraseña tiene que incluir al menos un número." |
| `NAME_EMPTY` | "Escribí tu nombre." |
| `NAME_TOO_LONG` | "El nombre puede tener hasta 40 caracteres." |
| `EMAIL_TAKEN` | "Ese email ya está registrado." |
| `INVALID_CREDENTIALS` | "Email o contraseña incorrectos" |
| `LOGIN_LOCKED` | "Bloqueamos el acceso a este email por 15 minutos por demasiados intentos. Probá más tarde." |
| `SERVICE_UNAVAILABLE` | "No pudimos completar el pedido. Probá de nuevo en un rato." |

Todo error que no esté en esta tabla (un `APIError` de Better Auth con otro código, un error de
Prisma o de `pg`) se convierte en `SERVICE_UNAVAILABLE` y se registra solo con el código y la hora
(`[accounts] SERVICE_UNAVAILABLE at=…`). El `body.message` de Better Auth, que viene en inglés,
nunca llega al cliente (R-08).

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 1 (reglas y esquema), Block 2 (`registerAccount`), Block 3 (pantalla de registro) |
| FR-02 | Block 1 (email normalizado y `@unique`), Block 2 (`EMAIL_TAKEN`) |
| FR-03 | Block 1 (`validatePassword`), Block 2 (revalidación en el servidor), Block 3 (mensajes) |
| FR-04 | Block 1 (`validateName`), Block 2, Block 3 |
| FR-05 | Block 2 (`autoSignIn`), Block 3 (redirección a `/`) |
| FR-06 | Block 2 (`signIn`), Block 3 (pantalla de inicio de sesión) |
| FR-07 | Block 1 (`expiresIn` 30 días, `disableSessionRefresh`), Block 2 (`rememberMe: true`) |
| FR-08 | Block 2 (`signOut`), Block 4 (botón "Cerrar sesión") |
| FR-09 | Block 4 (`src/proxy.ts` y verificación en `src/app/page.tsx`) |
| FR-10 | Block 1 (tabla `login_throttles`), Block 2 (`login-throttle.ts`) |
| FR-11 | Block 3 (`password-input.tsx`) |
| NFR-01 | Block 1 (scrypt de Better Auth, logger propio), Block 2 (test de integración: hash en la base y ningún log ni resultado con la contraseña) |
| NFR-02 | Block 2: test de integración con 20 registros y 20 inicios de sesión, p95 ≤ 1000 ms |
| NFR-03 | Block 3 (input de 44 px y 16 px), Block 4 (E2E en 360 y 430 px sin scroll horizontal y cada tocable ≥ 44×44) |
| NFR-04 | Block 2 (mensaje y código idénticos, test de integración), Block 4 (E2E) |

## Dependencies between blocks
Block 2 depende de 1 (esquema, `getAuth()` y reglas). Block 3 depende de 2 (las Server Actions
llaman a `accounts.ts`). Block 4 depende de 3 (protege `/` y redirige a `/login`, que ya existe).
Orden: 1 → 2 → 3 → 4.

## Mobile guides applied (AGENTS.md → Code conventions)
Para `/login`, `/register` y el botón "Cerrar sesión" de `/`:
- `mobile-native` fix 1: el hover solo dentro de `@media (hover: hover)`.
- `mobile-native` fix 2: sin destello al tocar (ya es global en `globals.css`, FEAT-001).
- `mobile-native` fix 3: las pantallas viven en `.app-shell` (`100dvh` y safe areas); con el teclado
  abierto, el formulario hace scroll dentro del documento y el botón de enviar queda alcanzable.
- `mobile-native` fix 4:
  - inputs a 16 px fijos (`text-base`, sin `md:text-sm`);
  - email con `type="email"`, `inputMode="email"`, `autoCapitalize="none"`, `autoCorrect="off"`,
    `spellCheck={false}` y `autoComplete="email"`;
  - contraseña con `autoComplete="current-password"` en `/login` y `"new-password"` en `/register`;
  - nombre con `autoComplete="nickname"`;
  - `enterKeyHint` en `next` o `go`, según corresponda.
  - Sin `maximum-scale`.
- `mobile-native` fix 5: estado presionado por `pointerdown` con el `usePressed` de
  `src/components/pressable.ts` en el control de la contraseña y en los botones, y
  `touch-action: manipulation`.
- `mobile-native` fixes 7 y 8: safe areas por `.app-shell`, y sin selección de texto en los
  botones.
- `mobile-native` "Baseline" y "Never Ship": se respetan tal cual en estas pantallas.
- `gestures`: N/A. Estas pantallas no tienen gestos: ni sheets, ni swipe, ni scroll horizontal.
- `design-taste-frontend`:
  - un solo sistema: los tokens Rosé Pine, foam como acento, `Button` e `Input` de shadcn;
  - copy propio en español, sin "Welcome back" ni textos de plantilla;
  - sin hero ni fotos, porque son formularios de app.

## Block 1 — Esquema, Better Auth y reglas de cuenta

**Files**
- `package.json`, `pnpm-lock.yaml` (modified) — `better-auth` 1.7.25 exacta.
- `pnpm-workspace.yaml` (modified, solo si pnpm rechaza la versión por antigüedad) — excepción por
  versión exacta, con su motivo.
- `prisma/schema.prisma` (modified) — modelos de abajo; se quita el comentario "sin modelos".
- `prisma/migrations/<timestamp>_accounts/migration.sql` (new) — se genera con
  `prisma migrate dev --create-only --name accounts` y se revisa a mano.
- `prisma/migrations/migration_lock.toml` (new) — lo crea Prisma con la primera migración.
- `src/lib/account-rules.ts` (new) — sin I/O:
  - `normalizeEmail(raw)` hace trim y minúsculas;
  - `validateEmail(email)` devuelve `INVALID_EMAIL` o `null`;
  - `validatePassword(pw)` devuelve la lista de códigos que fallan, entre `PASSWORD_TOO_SHORT`,
    `PASSWORD_TOO_LONG`, `PASSWORD_NEEDS_LETTER` y `PASSWORD_NEEDS_NUMBER`;
  - `validateName(raw)` devuelve `{ name: trimmed }` o el código, `NAME_EMPTY` o `NAME_TOO_LONG`;
  - `readFormFields(formData, keys)` devuelve un `Record<key, string>`: cualquier valor que no sea
    string, como `File` o `null`, se lee como `""`.
- `src/server/session-cookie.ts` (new) — `import "server-only"`:
  - `sessionCookieOptions(baseUrl)` define el prefijo y si la cookie es segura;
  - `hasSessionCookie(request)` usa `getSessionCookie` de `better-auth/cookies` con esas mismas
    opciones.
  - Es la única fuente del nombre de la cookie, para `auth.ts` y para el proxy (R-15).
- `src/server/auth.ts` (new) — `import "server-only"`:
  - `readAuthEnv(env)` valida `BETTER_AUTH_SECRET` (≥ 32 caracteres) y `BETTER_AUTH_URL` (`http:`
    o `https:`). Si algo falla, lanza `AuthConfigError` con `code = "AUTH_CONFIG_INVALID"`, sin el
    valor (R-13).
  - `createAuthOptions({ db, secret, baseUrl, log })` es pura y recibe la base inyectada. Fija:
    - `database: prismaAdapter(db, { provider: "postgresql", transaction: true })`;
    - `emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8,
      maxPasswordLength: 128 }`;
    - `session: { expiresIn: 2_592_000, disableSessionRefresh: true, cookieCache: { enabled:
      false } }`;
    - `telemetry: { enabled: false }`;
    - `logger: { disabled: false, level: "error", log: (level, message) => log(code) }`: emite
      solo `[auth] AUTH_INTERNAL_ERROR at=…`, nunca `message` (R-08);
    - `advanced: { useSecureCookies: baseUrl.startsWith("https:") }`;
    - `plugins: [nextCookies()]`, como último plugin.
  - `getAuth()` es perezosa y vive en `globalThis` (patrón de `getDb()`). Lee `readAuthEnv`.
- `.env.example` (modified) — `BETTER_AUTH_SECRET=` y `BETTER_AUTH_URL=http://localhost:3000`,
  con el comando para generar el secreto (`openssl rand -base64 32`).
- `tests/unit/lib/account-rules.test.ts`, `tests/unit/server/auth.test.ts`,
  `tests/unit/server/session-cookie.test.ts` (new)

**Logic**
Implementa la base de FR-01 a FR-04, FR-07 y FR-10.
- El esquema declara las cuatro tablas que exige Better Auth y la tabla propia del bloqueo.
- Las reglas viven en `src/lib` y se reusan en el servidor (Block 2) y en los mensajes de la UI
  (Block 3).
- `getAuth()` no se crea durante `next build`: la primera llamada ocurre al renderizar o en una
  Server Action.

**Data model**
- `User` → tabla `users`:
  - `id` String `@id` (lo genera Better Auth, 32 caracteres);
  - `name` String, NOT NULL;
  - `email` String, NOT NULL, `@unique`, siempre guardado en minúsculas;
  - `emailVerified` Boolean, `@default(false)`;
  - `image` String?;
  - `createdAt` DateTime, `@default(now())`;
  - `updatedAt` DateTime, `@updatedAt`.
- `Session` → `sessions`:
  - `id` String `@id`;
  - `token` String, NOT NULL, `@unique`;
  - `expiresAt` DateTime, NOT NULL;
  - `ipAddress` String? y `userAgent` String?;
  - `userId` String, FK a `users.id` con `onDelete: Cascade` y `@@index([userId])`;
  - `createdAt` y `updatedAt`.
- `Account` → `accounts`:
  - `id` String `@id`;
  - `accountId` String y `providerId` String, NOT NULL;
  - `userId` String, FK con cascade y `@@index([userId])`;
  - `password` String? (hash scrypt `sal:clave`);
  - `accessToken`, `refreshToken`, `idToken` y `scope` String?, sin uso en el MVP;
  - `accessTokenExpiresAt` y `refreshTokenExpiresAt` DateTime?;
  - `createdAt` y `updatedAt`.
- `Verification` → `verifications`:
  - `id` String `@id`;
  - `identifier` String con `@@index([identifier])`;
  - `value` String;
  - `expiresAt` DateTime;
  - `createdAt` y `updatedAt`.
  - Better Auth la exige aunque el MVP no la use.
- `LoginThrottle` → `login_throttles`:
  - `email` String `@id` (normalizado);
  - `attempts` Int, NOT NULL, `@default(0)`: intentos reservados en la ventana, en vuelo o fallidos;
  - `windowStartedAt` DateTime, NOT NULL;
  - `lockedUntil` DateTime?;
  - `@@index([windowStartedAt])` para la purga.
- Campos de Prisma en camelCase con `@map` a columnas en snake_case.
- Rollback: `prisma migrate` no genera la migración inversa. Revertir el bloque es revertir el commit
  y, en local, `docker compose down -v`. No hay datos de producción que migrar.

**Input validation**
- `BETTER_AUTH_SECRET`: string, obligatoria, de 32 caracteres o más.
- `BETTER_AUTH_URL`: URL absoluta `http:` o `https:`, obligatoria.
- Email: después del trim y las minúsculas, hasta 254 caracteres, con formato `local@dominio.tld`
  (sin espacios, una sola `@`, dominio con al menos un punto y sin puntos en los extremos).
- Contraseña: de 8 a 128 caracteres (unidades UTF-16, como las cuenta Better Auth), con al menos una
  letra (`\p{L}`) y al menos un dígito (`\p{Nd}`). No se recorta.
- Nombre: después del trim, de 1 a 40 caracteres.

**Error handling**
- `BETTER_AUTH_SECRET` ausente o de menos de 32 caracteres: `readAuthEnv` lanza `AuthConfigError`
  con `AUTH_CONFIG_INVALID`, y el mensaje no incluye el valor.
- `BETTER_AUTH_URL` ausente o inválida: el mismo error, con el mismo código.
- Email con formato inválido (`ana@`, `ana.mail.com`): `validateEmail` devuelve `INVALID_EMAIL`.
- Contraseña que no cumple una o más reglas: `validatePassword` devuelve todos los códigos que
  fallan, no solo el primero.
- Nombre vacío después del trim, o de más de 40 caracteres: `validateName` devuelve `NAME_EMPTY` o
  `NAME_TOO_LONG`.
- Un valor del `FormData` que no es string: `readFormFields` lo lee como `""`, así que la
  validación lo rechaza como campo faltante.

**Required tests**
- [ ] `test-email-normalized` — `account-rules.test.ts`: `"  Ana@Mail.com "` → `"ana@mail.com"` —
      validates AC-02.
- [ ] `test-email-invalid` — `account-rules.test.ts`: `ana@`, `ana.mail.com`, `a b@c.com`,
      `ana@mail.`, `""` y uno de 255 caracteres son rechazados con `INVALID_EMAIL`; `ana@mail.com`
      se acepta — validates AC-05.
- [ ] `test-password-rules-invalid` — `account-rules.test.ts`: `abc1` → `PASSWORD_TOO_SHORT`;
      `abcdefgh` → `PASSWORD_NEEDS_NUMBER`; `12345678` → `PASSWORD_NEEDS_LETTER`; `abc` →
      `[PASSWORD_TOO_SHORT, PASSWORD_NEEDS_NUMBER]`; 129 caracteres → `PASSWORD_TOO_LONG`;
      `festival2026` y `ñandú123` se aceptan — validates AC-03.
- [ ] `test-name-invalid` — `account-rules.test.ts`: `"   "` → `NAME_EMPTY`; 41 caracteres →
      `NAME_TOO_LONG`; `"  Ana  "` → `"Ana"`; exactamente 40 caracteres se acepta — validates AC-04.
- [ ] `test-form-fields-missing` — `account-rules.test.ts`: un `File` y una clave faltante se leen
      como `""`.
- [ ] `test-auth-options-session` — `auth.test.ts`: `createAuthOptions` fija `expiresIn` en
      2 592 000, `disableSessionRefresh: true`, `cookieCache.enabled: false`, `autoSignIn: true` y
      `telemetry.enabled: false`, y `nextCookies` es el último plugin — validates AC-08, AC-09.
- [ ] `test-auth-secret-invalid` — `auth.test.ts`: un secreto ausente o de 31 caracteres es
      rechazado con `AUTH_CONFIG_INVALID`, y el mensaje no contiene el secreto (R-13).
- [ ] `test-auth-url-invalid` — `auth.test.ts`: una URL ausente o `ftp:` es rechazada con
      `AUTH_CONFIG_INVALID`.
- [ ] `test-auth-logger-no-message` — `auth.test.ts`: el `log` configurado, llamado con un mensaje
      con una URL de base y una contraseña, emite solo el código y la hora (R-08).
- [ ] `test-session-cookie-name` — `session-cookie.test.ts`: con `https:` el nombre lleva
      `__Secure-` y la cookie es segura; con `http:`, ninguna de las dos cosas. `hasSessionCookie`
      encuentra la cookie con el nombre correcto y devuelve `false` sin ella (R-15).

**Completion criterion**
`pnpm db:migrate` aplica la migración sobre una base vacía, y `pnpm test`, `pnpm typecheck` y
`pnpm lint` pasan con los pisos de cobertura.

## Block 2 — Servicios de cuentas y bloqueo por email

**Files**
- `src/server/login-throttle.ts` (new) — `import "server-only"`. `createLoginThrottle({ db, now })`
  (fábrica inyectable, patrón `createHealthChecker`) ofrece:
  - `reserve(email)` devuelve `{ ok: true }` o `{ ok: false, code: "LOGIN_LOCKED" }`;
  - `recordFailure(email)`;
  - `clear(email)`.
  - Le sigue `getLoginThrottle()`, el singleton.
- `src/server/accounts.ts` (new) — `import "server-only"`. `createAccounts({ auth, throttle, log })`
  ofrece:
  - `registerAccount(fields)`;
  - `signIn(fields)`;
  - `signOut(headers)`;
  - `getCurrentUser(headers)`.
  - Le sigue `getAccounts()`, el singleton sobre `getAuth()` y `getLoginThrottle()`.
- `tests/unit/server/login-throttle.test.ts`, `tests/unit/server/accounts.test.ts` (new) — con un
  `db` y un `auth` simulados e inyectados.
- `tests/integration/accounts.test.ts`, `tests/integration/login-throttle.test.ts` (new) — contra
  PostgreSQL real. `next/headers` se simula con un jar de cookies en memoria, porque `nextCookies()`
  escribe ahí.
- `tests/integration/setup.ts` (modified) — limpia `users` (en cascada) y `login_throttles` entre
  tests, y fija `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` de prueba si no vienen del entorno.

**Logic**
Implementa FR-01, FR-02, FR-05, FR-06, FR-07, FR-08 y FR-10, y NFR-01, NFR-02 y NFR-04.
- `registerAccount({ email, password, name })`:
  - Normaliza y revalida con `account-rules` en el servidor (R-07).
  - Llama a `auth.api.signUpEmail({ body: { email, password, name }, headers })` con esos tres
    campos y ningún otro.
  - Si sale bien, devuelve `{ ok: true }`: `autoSignIn` dejó la cookie vía `nextCookies()`.
  - `APIError` con `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` → `EMAIL_TAKEN`. Los errores de reglas
    → `{ ok: false, code: "INVALID_INPUT", fieldErrors }`.
- `signIn({ email, password })`:
  - Normaliza el email. Con un formato inválido o una contraseña vacía o de más de 128 caracteres
    devuelve `INVALID_CREDENTIALS` sin reservar ni hashear.
  - Pide `throttle.reserve(email)`; si responde `LOGIN_LOCKED`, devuelve eso sin verificar la
    contraseña.
  - Llama a `auth.api.signInEmail({ body: { email, password, rememberMe: true }, headers })`. Si
    sale bien, llama a `throttle.clear(email)`; con `INVALID_EMAIL_OR_PASSWORD`, a
    `throttle.recordFailure(email)` y devuelve `INVALID_CREDENTIALS`.
- `signOut(headers)` llama a `auth.api.signOut`, que borra la fila de la sesión y la cookie.
- `getCurrentUser(headers)` devuelve `{ id, name, email }` o `null` (sin sesión, firma inválida o
  sesión vencida; Better Auth borra la vencida). No redirige: la redirección es de la página
  (hallazgo 2 de la auditoría).
- `login-throttle.ts`:
  - `reserve` es una sola sentencia `INSERT … ON CONFLICT (email) DO UPDATE … RETURNING`:
    - si `lockedUntil > now`, no suma nada y devuelve "bloqueado";
    - si la ventana venció (`windowStartedAt <= now − 15 min`) y no hay bloqueo vigente, reinicia
      con `attempts = 1`, `windowStartedAt = now` y `lockedUntil = null`;
    - si no, suma 1 solo si `attempts < 5`. Si ya había 5 intentos en la ventana, devuelve
      "bloqueado".
    - Por ser atómica por fila, nunca hay más de 5 intentos por ventana, ni siquiera en paralelo
      (R-02).
  - `recordFailure`: si `attempts >= 5`, fija `lockedUntil = now + 15 min`. Antes purga
    (`DELETE … WHERE windowStartedAt <= now − 15 min AND (lockedUntil IS NULL OR lockedUntil <=
    now)`) para que la tabla no crezca sin límite (R-12).
  - `clear` borra la fila del email.
  - Cuenta también los emails inexistentes (R-09).
  - Al pasar `lockedUntil`, la siguiente `reserve` reinicia la ventana (AC-13).

**Data model**
- Reusa `users`, `sessions`, `accounts` y `login_throttles` del Block 1, sin cambio de esquema.
  Constraints tal como se declararon ahí:
  - `users.email`: NOT NULL y `@unique`;
  - `sessions.token`: NOT NULL y `@unique`;
  - `sessions.userId` y `accounts.userId`: FK con cascade;
  - `login_throttles.email`: `@id`, `attempts` con `@default(0)`, `windowStartedAt` NOT NULL e
    índice en `windowStartedAt`.

**Input validation**
- `fields` llega de `readFormFields` y se trata como no confiable: `email`, `password` y `name` son
  strings posiblemente vacíos.
- Registro: email con `validateEmail` después de `normalizeEmail`; contraseña con
  `validatePassword`; nombre con `validateName`.
- Inicio de sesión: email normalizado, con formato válido y hasta 254 caracteres; contraseña de 1 a
  128 caracteres. Fuera de eso, la respuesta es `INVALID_CREDENTIALS`, idéntica a la de una
  contraseña incorrecta.

**Error handling**
- Email ya registrado, aunque cambien las mayúsculas: `EMAIL_TAKEN`, y no se crea una segunda
  cuenta.
- Campos de registro inválidos: `INVALID_INPUT` con `fieldErrors` por campo. No se llama a Better
  Auth.
- Email inexistente o contraseña incorrecta: `INVALID_CREDENTIALS`, y el fallo se registra en
  `login_throttles`.
- Email bloqueado: `LOGIN_LOCKED`, sin verificar la contraseña aunque sea correcta.
- Base caída o error no reconocido: `SERVICE_UNAVAILABLE`, con log `[accounts]
  SERVICE_UNAVAILABLE at=…` sin `error.message`. En `getCurrentUser` el error se relanza como
  `AccountsUnavailableError` (código `SERVICE_UNAVAILABLE`, sin causa expuesta) y lo atiende la
  página de error de Next (R-08).

**Required tests**
- [ ] `test-register-ok` — `accounts.test.ts` (integración): registro válido → `{ ok: true }`,
      usuario con email en minúsculas y nombre recortado, y cookie de sesión en el jar — validates
      AC-01.
- [ ] `test-register-duplicate-rejected` — `accounts.test.ts` (integración): registrar
      `ana@mail.com` y después `Ana@Mail.com` → la segunda es rechazada con `EMAIL_TAKEN` y queda
      una sola fila en `users` — validates AC-02.
- [ ] `test-register-invalid-rejected` — `accounts.test.ts` (unit): contraseña `abcdefgh`, nombre
      vacío y email `ana@` → `INVALID_INPUT` con los códigos de cada campo, y `signUpEmail` no se
      llama — validates AC-03, AC-04, AC-05.
- [ ] `test-register-extra-fields-ignored` — `accounts.test.ts` (unit): con `image`, `callbackURL`
      y `emailVerified` en los campos, `signUpEmail` recibe solo `email`, `password` y `name`
      (campos inválidos rechazados, R-07).
- [ ] `test-password-hashed` — `accounts.test.ts` (integración): `accounts.password` cumple
      `^[0-9a-f]{32}:[0-9a-f]{128}$`, no contiene la contraseña, y ningún log capturado ni resultado
      serializado contiene la contraseña — validates NFR-01.
- [ ] `test-signin-ok` — `accounts.test.ts` (integración): email y contraseña correctos, con el
      email en otras mayúsculas → `{ ok: true }` y sesión con `expiresAt` = ahora + 30 días (±5 s) —
      validates AC-06, AC-08.
- [ ] `test-signin-invalid-identical` — `accounts.test.ts` (integración): un email inexistente y
      una contraseña incorrecta devuelven exactamente el mismo resultado (`INVALID_CREDENTIALS`) —
      validates AC-07, NFR-04.
- [ ] `test-session-expired-invalid` — `accounts.test.ts` (integración): con `vi.setSystemTime` a
      30 días + 1 s después del inicio de sesión (solo `Date` simulado), `getCurrentUser` devuelve
      `null` y la fila de la sesión ya no existe; a los 29 días todavía devuelve el usuario —
      validates AC-09, AC-08.
- [ ] `test-signout-deletes-session` — `accounts.test.ts` (integración): después de `signOut`, la
      fila de la sesión no existe y `getCurrentUser` con la cookie anterior devuelve `null` —
      validates AC-10.
- [ ] `test-lockout-after-five-failures` — `login-throttle.test.ts` (integración, reloj
      inyectado): 5 fallos en 15 minutos → el 6.º intento, con la contraseña correcta, devuelve
      `LOGIN_LOCKED`. También bloquea un email inexistente — validates AC-12.
- [ ] `test-lockout-expires` — `login-throttle.test.ts` (integración): 15 minutos después del
      bloqueo se vuelve a aceptar la contraseña correcta, y 14 min 59 s después todavía no —
      validates AC-13.
- [ ] `test-lockout-concurrent-rejected` — `login-throttle.test.ts` (integración): 10 `reserve` en
      paralelo para el mismo email → exactamente 5 aceptadas y 5 rechazadas (R-02).
- [ ] `test-lockout-window-resets` — `login-throttle.test.ts` (integración): 4 fallos, 16 minutos
      sin intentos y otros 4 fallos no bloquean, y la purga borra la fila vencida (R-12).
- [ ] `test-throttle-branches` — `login-throttle.test.ts` (unit): con un `db` simulado, `reserve`
      mapea las filas devueltas a ok o bloqueado, y `clear` y `recordFailure` emiten las sentencias
      esperadas.
- [ ] `test-accounts-db-down-error` — `accounts.test.ts` (unit): un `auth.api` que lanza un error
      de conexión → `SERVICE_UNAVAILABLE`, log con el código sin el mensaje, y `getCurrentUser`
      lanza `AccountsUnavailableError`.
- [ ] `test-accounts-latency` — `accounts.test.ts` (integración): 2 de calentamiento, después 20
      registros y 20 inicios de sesión medidos → p95 de cada uno ≤ 1000 ms — validates NFR-02.

**Completion criterion**
`pnpm test` y `pnpm test:integration` pasan, con los pisos de cobertura incluyendo
`accounts.ts`, `login-throttle.ts` y `auth.ts`.

## Block 3 — Pantallas de registro e inicio de sesión

**Files**
- `src/components/ui/input.tsx` (new, shadcn new-york adaptado) — `h-11` (44 px) y `text-base`
  (16 px) fijos, sin `md:text-sm`, con el motivo comentado como en `button.tsx` (NFR-03,
  `mobile-native` fix 4).
- `src/components/ui/label.tsx` (new, shadcn new-york) — más `@radix-ui/react-label` en
  `package.json`, en versión exacta.
- `src/components/password-input.tsx` (new, `"use client"`) — `Input` más un botón `type="button"`
  `size-11` con `aria-label` ("Mostrar contraseña" u "Ocultar contraseña"), `aria-pressed`, el ícono
  `Eye` o `EyeOff` de lucide y `usePressed`. Alterna `type` entre `password` y `text`.
- `src/components/login-form.tsx`, `src/components/register-form.tsx` (new, `"use client"`) —
  `useActionState` sobre la Server Action. Muestran el error general y los de cada campo
  (`aria-invalid` y `aria-describedby`), conservan el email y el nombre ya escritos (nunca la
  contraseña), y deshabilitan el botón mientras está pendiente. Cada uno tiene un link a la otra
  pantalla.
- `src/lib/account-messages.ts` (new) — `messageFor(code)` según el catálogo de arriba, y
  `toFormState(result, values)`, que arma el estado del formulario sin la contraseña (hallazgo 4 de
  la auditoría).
- `src/app/auth-actions.ts` (new, `"use server"`) — `registerAction(prev, formData)`,
  `loginAction(prev, formData)` y `logoutAction()`:
  - leen con `readFormFields`, llaman a `getAccounts()` y devuelven `toFormState(...)`;
  - si sale bien, `redirect("/")`; `logoutAction` termina en `redirect("/login")`;
  - `redirect` nunca va dentro de un `try/catch`.
- `src/app/login/page.tsx`, `src/app/register/page.tsx` (new) — server components:
  - si `getCurrentUser` devuelve un usuario, `redirect("/")`;
  - `/login` muestra el `h1` "Mi Grilla", el formulario y `InstallGuide` ("Cómo instalarla");
  - `/register` muestra el `h1` "Creá tu cuenta" y el formulario.
- `tests/unit/components/password-input.test.tsx`, `tests/unit/components/login-form.test.tsx`,
  `tests/unit/components/register-form.test.tsx`, `tests/unit/lib/account-messages.test.ts` (new)

**Logic**
Implementa FR-01, FR-05, FR-06 y FR-11, y la parte de UI de FR-02, FR-03, FR-04 y NFR-03.
- Las Server Actions son delgadas: leen campos, delegan y redirigen.
- Next rechaza una Server Action de otro origen (R-06).
- No hay parámetro de destino: siempre se redirige a `/` (R-16).

**Input validation**
- Formulario de registro: `email` (`type="email"`, `required`, `maxLength=254`), `password`
  (`required`, `minLength=8`, `maxLength=128`) y `name` (`required`, `maxLength=40`).
- Formulario de inicio de sesión: `email` y `password` con `required`.
- La validación del navegador es solo ayuda: el servidor revalida todo (Block 2).

**Error handling**
- Respuesta `INVALID_INPUT`: el mensaje de cada código inválido queda bajo su campo, y para la
  contraseña se listan todas las reglas que fallan.
- `EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `LOGIN_LOCKED` y `SERVICE_UNAVAILABLE`: un único mensaje
  general (`role="alert"`) con el texto del catálogo.
- Código desconocido: `messageFor` cae en el mensaje de `SERVICE_UNAVAILABLE`.

**Required tests**
- [ ] `test-password-toggle` — `password-input.test.tsx`: tocar el control cambia `type` a `text`
      con `aria-pressed="true"`, y volver a tocarlo lo vuelve a `password`. El botón es
      `type="button"` y no envía el formulario — validates AC-14.
- [ ] `test-register-form-errors-invalid` — `register-form.test.tsx`: con un estado
      `INVALID_INPUT`, se muestran los mensajes de la contraseña inválida (las reglas que fallan),
      el nombre y el email bajo cada campo, con `aria-invalid` — validates AC-03, AC-04, AC-05.
- [ ] `test-register-form-duplicate-rejected` — `register-form.test.tsx`: un estado `EMAIL_TAKEN`
      muestra "Ese email ya está registrado." en `role="alert"` y conserva el email y el nombre —
      validates AC-02.
- [ ] `test-login-form-invalid-message` — `login-form.test.tsx`: `INVALID_CREDENTIALS` muestra
      exactamente "Email o contraseña incorrectos" — validates AC-07.
- [ ] `test-login-form-locked-rejected` — `login-form.test.tsx`: `LOGIN_LOCKED` muestra el aviso
      de bloqueo temporal — validates AC-12.
- [ ] `test-form-attributes` — `login-form.test.tsx` y `register-form.test.tsx`: los
      `autocomplete`, el `type="email"`, `autocapitalize="none"` y el `enterkeyhint` coinciden con
      la sección de guías mobile.
- [ ] `test-messages-unknown-code-error` — `account-messages.test.ts`: cada código del catálogo
      tiene su texto; un código desconocido cae en el de `SERVICE_UNAVAILABLE`; y `toFormState`
      nunca incluye la contraseña (R-08).

**Completion criterion**
`pnpm test` pasa. `/login` y `/register` se renderizan en `next start`, y un registro válido
termina en `/`.

## Block 4 — Protección de `/`, cierre de sesión, E2E, CI y documentación

**Files**
- `src/proxy.ts` (new, convención de Next 16):
  - `export function proxy(request)` redirige a `/login` si `hasSessionCookie(request)` es `false`;
  - `export const config = { matcher: ["/"] }`, solo `/`: no toca `/api/health`, `/serwist/*`,
    `/~offline`, `/demo` ni los estáticos;
  - la verificación real es la de la página (R-15).
- `src/app/page.tsx` (modified) — al empezar, `getCurrentUser(await headers())`; si da `null`,
  `redirect("/login")`. Muestra "Hola, {name}" y un `<form action={logoutAction}>` con el botón
  "Cerrar sesión" (`Button`, ≥ 44 px). El resto de la pantalla no cambia.
- `tests/e2e/auth.ts` (new) — helpers:
  - `uniqueEmail(testInfo)`, con el proyecto, el worker, el intento, la hora y un número al azar;
  - `signUp(page, testInfo)`, que registra por la UI;
  - `TEST_PASSWORD`.
  - Así no chocan los tests en paralelo ni los reintentos, y ningún test bloquea el email de otro.
- `tests/e2e/auth.spec.ts` (new) — el flujo de cuentas.
- `tests/e2e/home.spec.ts` (modified) — se registra con `signUp` antes de abrir `/`.
- `tests/e2e/demo.spec.ts` (modified):
  - el `h1` y la guía de instalación del marco se ven en `/login`;
  - el test de scroll se registra dentro del marco antes de scrollear `/`;
  - el de clickjacking suma `/login` y `/register`.
- `tests/e2e/performance.spec.ts` (modified) — mide `/login` sin sesión, y `/` con sesión: primero
  se registra sin throttling y después se emula 4G. Los dos con `load` ≤ 3 s.
- `tests/e2e/pwa.spec.ts` (modified) — la URL de los tests sin conexión pasa a ser
  `/login?desde=sin-conexion`, y `openControlledHome` abre `/login`. Suma un assert: ninguna caché
  guarda `/`, `/login` ni `/register` (R-17).
- `playwright.config.ts` (modified) — `webServer.env.BETTER_AUTH_URL = "http://127.0.0.1:3100"`.
- `.github/workflows/ci.yml` (modified):
  - los jobs `integration` y `e2e` reciben `BETTER_AUTH_SECRET` (un valor descartable de CI con su
    comentario, como `ci-only-password`) y `BETTER_AUTH_URL`;
  - `e2e` corre `pnpm db:migrate` antes de `pnpm test:e2e`;
  - `quality` sigue sin variables.
- `tests/unit/ci/workflow.test.ts` (modified) — asserts de lo anterior.
- `scripts/test-e2e-docker.sh` (modified) — `--network host` (solo Linux, documentado en el script
  y en el README) y `-e DATABASE_URL -e BETTER_AUTH_SECRET` sin imprimir sus valores.
- `README.md` (modified) — variables nuevas en el `.env`; `pnpm test:e2e` necesita la base
  levantada y migrada; el job `e2e` migra.
- `AGENTS.md` (modified):
  - Stack: Better Auth 1.7.25 (ADR-003);
  - Testing: E2E con base y `db:migrate`;
  - estructura: `src/proxy.ts` y `src/app/auth-actions.ts`.

**Logic**
Implementa FR-08 y FR-09, y cubre con E2E AC-01, AC-06, AC-07, AC-08, AC-10, AC-11, AC-12, AC-14 y
NFR-03. Además deja la CI y la documentación al día con el nuevo requisito de base y secretos.

**Data model**
- Reusa `users` y `sessions` del Block 1, sin cambio de esquema. Constraints tal como se declararon
  ahí: `users.email` NOT NULL y `@unique`, `sessions.token` NOT NULL y `@unique`, y
  `sessions.userId` como FK con cascade.

**Input validation**
- `src/proxy.ts` solo lee el header `cookie` del pedido: su ausencia equivale a "sin sesión".
- Una cookie mal formada o con firma inválida la rechaza `getCurrentUser` en la página.

**Error handling**
- Sin cookie de sesión, el proxy redirige a `/login` (307) sin renderizar.
- Con una cookie inválida, vencida o de una sesión ya cerrada, la página redirige a `/login` sin
  mostrar contenido protegido.
- Si la base está caída, `getCurrentUser` lanza `AccountsUnavailableError` y Next muestra su página
  de error genérica, sin detalles.

**Required tests**
- [ ] `test-e2e-register-home` — `auth.spec.ts`: registro → `/` con "Hola, {nombre}" — validates
      AC-01.
- [ ] `test-e2e-register-duplicate-rejected` — `auth.spec.ts`: registrar dos veces el mismo email,
      con otras mayúsculas, muestra "Ese email ya está registrado." — validates AC-02.
- [ ] `test-e2e-register-invalid-rejected` — `auth.spec.ts`: la contraseña `abcdefgh` muestra la
      regla del número — validates AC-03.
- [ ] `test-e2e-login-ok` — `auth.spec.ts`: cerrar sesión e iniciarla de nuevo con email y
      contraseña → `/` — validates AC-06.
- [ ] `test-e2e-login-invalid-identical` — `auth.spec.ts`: un email inexistente y una contraseña
      incorrecta muestran el mismo texto, "Email o contraseña incorrectos" — validates AC-07,
      NFR-04.
- [ ] `test-e2e-session-persists` — `auth.spec.ts`: después de iniciar sesión, recargar, y abrir
      una página nueva en el mismo contexto, siguen mostrando `/`; la cookie tiene `expires` a 30
      días (±1 min) y es `httpOnly` — validates AC-08.
- [ ] `test-e2e-logout` — `auth.spec.ts`: "Cerrar sesión" → `/login`; después, `goto("/")` y
      `goBack()` terminan en `/login` sin mostrar "Hola" — validates AC-10.
- [ ] `test-e2e-protected-unauthorized` — `auth.spec.ts`: sin sesión, `goto("/")` termina en
      `/login` y la respuesta no contiene "Cerrar sesión" (acceso no autorizado redirigido). Con
      una cookie inventada con el nombre correcto pasa lo mismo — validates AC-11.
- [ ] `test-e2e-lockout-rejected` — `auth.spec.ts`: 5 contraseñas incorrectas y después la
      correcta → aviso de bloqueo y el usuario sigue en `/login` — validates AC-12.
- [ ] `test-e2e-password-toggle` — `auth.spec.ts`: el control muestra y oculta lo escrito en
      `/login` y en `/register` — validates AC-14.
- [ ] `test-e2e-auth-screens-mobile` — `auth.spec.ts`: en los proyectos de 360 px y 430 px,
      `/login` y `/register` no tienen scroll horizontal, y cada tocable mide ≥ 44×44 — validates
      NFR-03.
- [ ] `test-e2e-no-cache-auth-pages` — `pwa.spec.ts`: después de navegar con sesión, ninguna caché
      del service worker guarda `/`, `/login` ni `/register` (R-17).
- [ ] `test-workflow-auth-env` — `workflow.test.ts`: `e2e` corre `pnpm db:migrate` antes de
      `pnpm test:e2e`; `integration` y `e2e` tienen `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL`;
      `quality` no tiene ninguna de las dos (secreto faltante en quality, a propósito).

**Completion criterion**
`pnpm test`, `pnpm test:integration` y `pnpm test:e2e` (o `pnpm test:e2e:docker`) pasan en local
con la base migrada, y la CI queda en verde en el PR con los tres jobs.

## Final verification
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (pisos 80/70/80),
  `pnpm test:integration` y `pnpm test:e2e` en verde en local y en la CI.
- Cada AC del PRD tiene su test, según la tabla de cobertura y los `Required tests`.
- `validate_threat.py` pasa contra esta spec, y R-01, R-02, R-05 a R-09 y R-12 a R-17 tienen su
  mitigación implementada. R-03, R-04, R-10, R-11 y R-18 quedan como riesgos aceptados.
- **Verificación manual en iPhone real (VERIFY):** `next start` servido por HTTPS con ngrok
  (`BETTER_AUTH_URL` con la URL https del túnel). Se verifica:
  - registrarse e iniciar sesión desde Safari y desde la app instalada;
  - que la sesión siga después de cerrar y volver a abrir la app instalada (AC-08);
  - teclado de email, sin zoom en los campos y control de mostrar contraseña (AC-14);
  - cookie `__Secure-` sobre HTTPS.
