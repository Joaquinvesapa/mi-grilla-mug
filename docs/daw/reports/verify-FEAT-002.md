# Verification FEAT-002

Verificación del módulo completo (Blocks 1–4) de FEAT-002 "Cuentas" contra
`docs/daw/prd/prd-FEAT-002.md` y `docs/daw/specs/spec-FEAT-002.md`, sobre HEAD `b6b77d9` de
`feat/FEAT-002-cuentas`. Verificación cruzada de `daw-module-verifier` (agente que no escribió el
código) y evidencia manual del usuario en un iPhone real, 2026-11-17. Ronda 1.

| Field | Value |
|---|---|
| Module | Cuentas: `src/server/{auth,accounts,login-throttle,session-cookie}.ts`, `src/lib/{account-rules,account-messages}.ts`, `src/app/{auth-actions.ts,page.tsx,login,register}`, `src/proxy.ts`, `src/components/{login-form,register-form,password-input,form-feedback}.tsx`, `prisma/` |
| Line coverage | 99.67% |
| Branch coverage | 98.08% |
| Function coverage | 98.73% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean, 0 findings; `pnpm typecheck` — 0 errores; `pnpm format:check` — 95 archivos OK |

Corridas del verificador sobre `b6b77d9`: `pnpm test` 196/196; `pnpm test:integration` 31/31
contra `postgres:17.12`. Los E2E (130/130 en `iphone-webkit`, `mobile-chromium`, `mobile-360` y
`desktop`, con `CI=1 pnpm test:e2e:docker`) salen del cierre de CODE sobre `65e5ca7`; entre ese
commit y `b6b77d9` solo se agregaron los reportes de tests y SAST.

## Evidencia manual (iPhone real)

Servido por HTTPS con ngrok sobre `pnpm build && pnpm start`, con `BETTER_AUTH_URL` en la URL https
del túnel. Confirmado por el usuario el 2026-11-17, sin capturas adjuntas: "funciona todo lo que
vimos".

- Sin sesión, la URL abre `/login`; registro desde Safari → pantalla principal con "Hola, {nombre}"
  (AC-01, AC-11).
- "Cerrar sesión" lleva a `/login`, y el inicio de sesión con email y contraseña vuelve a la
  pantalla principal (AC-06, AC-10).
- Instalada con "Agregar a pantalla de inicio": la sesión sigue después de cerrar la app del todo y
  volver a abrirla (AC-08).
- Teclado de email sin mayúscula automática, sin zoom al enfocar los campos, y el control muestra y
  oculta la contraseña (AC-14, NFR-03, guía `mobile-native` fix 4).
- Observación del usuario: con `pnpm dev` los botones no mostraban el estado presionado al tocar;
  con `pnpm build && pnpm start` sí. No es un defecto: es el modo de desarrollo (hidratación más
  lenta), no lo que se despliega.

## Acceptance criteria
- ✅ AC-01 — `registerAccount` / `registerAction`; `test-register-ok`, `test-e2e-register-home`; evidencia manual
- ✅ AC-02 — `normalizeEmail`, `registerAccount` (`EMAIL_TAKEN`); `test-email-normalized`, `test-register-duplicate-rejected`, `test-register-form-duplicate-rejected`, `test-e2e-register-duplicate-rejected`
- ✅ AC-03 — `validatePassword` + revalidación; `test-password-rules-invalid`, `test-register-invalid-rejected`, `test-register-form-errors-invalid`, `test-e2e-register-invalid-rejected`
- ✅ AC-04 — `validateName`; `test-name-invalid`, `test-register-invalid-rejected`, `test-register-form-errors-invalid`
- ✅ AC-05 — `validateEmail`; `test-email-invalid`, `test-register-invalid-rejected`, `test-register-form-errors-invalid`
- ✅ AC-06 — `signIn` / `loginAction`; `test-signin-ok`, `test-e2e-login-ok`; evidencia manual
- ✅ AC-07 — `signIn` (`INVALID_CREDENTIALS` idéntico); `test-signin-invalid-identical`, `test-login-form-invalid-message`, `test-e2e-login-invalid-identical`
- ✅ AC-08 — `createAuthOptions` (30 días, `disableSessionRefresh`) + `rememberMe: true`; `test-auth-options-session`, `test-signin-ok`, `test-session-expired-invalid`, `test-e2e-session-persists`; evidencia manual con la app instalada
- ✅ AC-09 — `createAuthOptions`, `getCurrentUser`; `test-session-expired-invalid`, `test-auth-options-session`
- ✅ AC-10 — `signOut`, `logoutAction`, `src/app/page.tsx`; `test-signout-deletes-session`, `test-e2e-logout`; evidencia manual
- ✅ AC-11 — `src/proxy.ts` + verificación real en `src/app/page.tsx`; `test-e2e-protected-unauthorized`; evidencia manual
- ✅ AC-12 — `login-throttle.ts` (`reserve`, `recordFailure`) + `signIn`; `test-lockout-after-five-failures`, `test-lockout-concurrent-rejected`, `test-login-form-locked-rejected`, `test-e2e-lockout-rejected`
- ✅ AC-13 — `reserve` reinicia la ventana al vencer el bloqueo; `test-lockout-expires`, `test-lockout-window-resets`
- ✅ AC-14 — `src/components/password-input.tsx`; `test-password-toggle`, `test-e2e-password-toggle`; evidencia manual

NFR: NFR-01 `test-password-hashed`; NFR-02 `test-accounts-latency`; NFR-03
`test-e2e-auth-screens-mobile`, `test-form-attributes` y evidencia manual; NFR-04
`test-signin-invalid-identical`, `test-e2e-login-invalid-identical`.

## Spec blocks
- ✅ Block 1 — esquema y migración `20261117151501_accounts`, `account-rules.ts`, `session-cookie.ts`, `auth.ts`, `.env.example`; todas las tareas hechas
- ✅ Block 2 — `login-throttle.ts`, `accounts.ts`, setup de integración y jar de cookies; todas las tareas hechas
- ✅ Block 3 — `input`, `label`, `password-input`, formularios, `account-messages.ts`, `auth-actions.ts`, `/login` y `/register` (más `form-feedback.tsx`, registrado en decisions); todas las tareas hechas
- ✅ Block 4 — `proxy.ts`, `page.tsx` con "Hola" y "Cerrar sesión", E2E, `playwright.config.ts`, `ci.yml`, script de Docker, README y AGENTS.md; todas las tareas hechas

Desvíos de la spec registrados en `docs/daw/specs/decisions-FEAT-002.md`.

## Required tests de la spec
- ✅ Block 1: `test-email-normalized`, `test-email-invalid`, `test-password-rules-invalid`, `test-name-invalid`, `test-form-fields-missing`, `test-auth-options-session`, `test-auth-secret-invalid`, `test-auth-url-invalid`, `test-auth-logger-no-message`, `test-session-cookie-name`
- ✅ Block 2: `test-register-ok`, `test-register-duplicate-rejected`, `test-register-invalid-rejected`, `test-register-extra-fields-ignored`, `test-password-hashed`, `test-signin-ok`, `test-signin-invalid-identical`, `test-session-expired-invalid`, `test-signout-deletes-session`, `test-lockout-after-five-failures`, `test-lockout-expires`, `test-lockout-concurrent-rejected`, `test-lockout-window-resets`, `test-throttle-branches`, `test-accounts-db-down-error`, `test-accounts-latency`
- ✅ Block 3: `test-password-toggle`, `test-register-form-errors-invalid`, `test-register-form-duplicate-rejected`, `test-login-form-invalid-message`, `test-login-form-locked-rejected`, `test-form-attributes`, `test-messages-unknown-code-error`
- ✅ Block 4: `test-workflow-auth-env`, `test-e2e-register-home`, `test-e2e-register-duplicate-rejected`, `test-e2e-register-invalid-rejected`, `test-e2e-login-ok`, `test-e2e-login-invalid-identical`, `test-e2e-session-persists`, `test-e2e-logout`, `test-e2e-protected-unauthorized`, `test-e2e-lockout-rejected`, `test-e2e-password-toggle`, `test-e2e-auth-screens-mobile`, `test-e2e-no-cache-auth-pages`

## Tests
- ✅ Sad-path tests: cada función que recibe input tiene al menos uno — validadores (`test-email-invalid`, `test-password-rules-invalid`, `test-name-invalid`, `test-form-fields-missing`), `readAuthEnv` (`test-auth-secret-invalid`, `test-auth-url-invalid`), `registerAccount` (`test-register-invalid-rejected`, `test-register-duplicate-rejected`, `test-accounts-db-down-error`), `signIn` (`test-signin-invalid-identical`, `test-lockout-after-five-failures`), `login-throttle` (`test-lockout-concurrent-rejected`), Server Actions y proxy por E2E (`test-e2e-register-invalid-rejected`, `test-e2e-protected-unauthorized`, `test-e2e-lockout-rejected`)

## Warnings (no bloquean)
- W-VER-01: 17 tipos exportados que solo se usan dentro de su módulo (`accounts.ts`, `auth.ts`, `login-throttle.ts`, `session-cookie.ts`, `account-messages.ts`); no es código muerto, el `export` sobra.
- W-VER-03: `test-accounts-latency` mide scrypt real con p95 ≤ 1000 ms (lo pide NFR-02); en un runner lento puede ser intermitente.
- `src/app/auth-actions.ts`, `src/proxy.ts` y las páginas quedan fuera del `include` de cobertura y solo los ejercitan los E2E (la spec no exige unit para ellos).
- W-VER-03: `waitForTimeout(1500)` en `tests/e2e/pwa.spec.ts:192`, heredado de FEAT-001.
- Los E2E no se re-ejecutaron en VERIFY; el 130/130 es del cierre de CODE sobre `65e5ca7` (solo documentación agregada encima).

## Para CLOSEOUT
- Que la CI quede en verde en el PR con los tres jobs (`quality`, `integration`, `e2e`), parte del criterio del Block 4.

Result: PASSED
