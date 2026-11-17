# SAST FEAT-002

| Field | Value |
|-------|-------|
| Ticket | FEAT-002 |
| Tools | revisión estática del diff `main..65e5ca7` (grep + lectura de `src/`, `prisma/`, `scripts/`, `.github/`), `pnpm audit` (pnpm 12.18.0) |
| Date | 2026-11-17 |

Alcance: los archivos que agregó o cambió FEAT-002 — `src/server/{auth,accounts,login-throttle,session-cookie}.ts`, `src/lib/{account-rules,account-messages}.ts`, `src/app/{auth-actions.ts,page.tsx,login/page.tsx,register/page.tsx}`, `src/proxy.ts`, `src/components/{login-form,register-form,password-input,form-feedback}.tsx`, `src/components/ui/{input,label}.tsx`, `prisma/schema.prisma` y la migración `20261117151501_accounts`, `.github/workflows/ci.yml`, `scripts/test-e2e-docker.sh`, `playwright.config.ts` — y el árbol de dependencias completo.

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos embebidos: `BETTER_AUTH_SECRET` y `DATABASE_URL` salen del entorno (`.env`, cubierto por `.env*` en `.gitignore:31`); `.env.example` deja el secreto vacío; el valor de la CI (`.github/workflows/ci.yml:78,115`) es descartable y comentado como tal, y el script de Docker pasa las variables solo por nombre |
| F-SAST-02 | ✅ | el único SQL crudo (`src/server/login-throttle.ts:54,78,84,92`, `tests/integration/setup.ts:34-35`) usa los tagged templates `$queryRaw`/`$executeRaw`, que parametrizan; no hay `*Unsafe` ni concatenación fuera del cliente generado |
| F-SAST-03 | ✅ | nada llega a exec/spawn/child_process en `src/` |
| F-SAST-04 | ✅ | sin `eval`, `new Function` ni deserialización insegura |
| F-SAST-05 | ✅ | ningún input del usuario forma rutas de archivo |
| F-SAST-06 | ✅ | React escapa el nombre visible y los mensajes; no hay `dangerouslySetInnerHTML` ni `innerHTML` |
| F-SAST-07 | ✅ | no hay fetch saliente guiado por input del usuario; las redirecciones van siempre a `/` o `/login` (R-16) |
| F-SAST-08 | ✅ | contraseñas con scrypt de Better Auth (N=16384, r=16, p=1, sal de 16 bytes); cookie firmada con HMAC-SHA256; sin MD5/SHA1 |
| F-SAST-09 | ✅ | sin modo debug; telemetría de Better Auth apagada (`src/server/auth.ts`) |
| F-SAST-10 | ✅ | los logs nuevos (`src/server/auth.ts:52`, `src/server/accounts.ts:90`) emiten solo `[auth] AUTH_INTERNAL_ERROR at=…` / `[accounts] SERVICE_UNAVAILABLE at=…`, sin email, contraseña ni mensaje del error (test `test-password-hashed` y `test-auth-logger-no-message`) |
| F-SAST-11 | ✅ | no hay superficie de subida de archivos; un `File` en el `FormData` se lee como `""` (`readFormFields`) |
| F-SAST-12 | ✅ | registro, inicio y cierre de sesión son Server Actions (POST con el chequeo de origen de Next); el handler HTTP de Better Auth no se monta; la cookie es `SameSite=Lax` |
| F-SAST-13 | ✅ | `pnpm audit --prod`: 0 vulnerabilidades; `pnpm audit` completo: ninguna crítica ni alta |
| F-SAST-14 | ✅ | validación en el servidor con `account-rules` (email, contraseña 8–128 con letra y número, nombre 1–40), lista cerrada de campos hacia `auth.api`, `rememberMe` fijo |
| F-SAST-15 | ✅ | errores con catálogo cerrado de códigos y mensajes; `AccountsUnavailableError` sin causa; `AuthConfigError` sin el valor de las variables; nunca `error.message` al cliente |
| F-SAST-16 | ✅ | `better-auth` 1.7.25 y `@radix-ui/react-label` 2.1.17 sin CVE conocidas; queda `minimatch` 10.2.6 vía `shadcn>ts-morph>@ts-morph/common` (GHSA-g3hv-75wg-m249, moderada), la misma de FEAT-001, suprimida abajo como ACCEPTED_RISK |
| F-SAST-17 | ✅ | sin rutas de código dinámico |

## Suppressions

### Suppression: F-SAST-16 — minimatch 10.2.6 (GHSA-g3hv-75wg-m249) vía shadcn

| Field | Value |
|---|---|
| File | pnpm-lock.yaml:1 (ruta `.>shadcn>ts-morph>@ts-morph/common>minimatch`); declarada en package.json, devDependencies `shadcn: 4.23.0` |
| Category | F-SAST-16 — CVE Medium en una dependencia (DoS por amplificación de globparts en minimatch) |
| Disposition | ACCEPTED_RISK |
| Reviewer | usuario (dueño del repo), en el cierre de CODE de FEAT-001 |
| Date | 2026-11-17 |
| Justification | Arrastrada sin cambios de FEAT-001: minimatch llega solo a través de la CLI de shadcn (devDependency, 4.23.0 sigue siendo la última versión, sin arreglo upstream), que no se importa desde src/, no corre en la CI ni en el build y no forma parte del runtime de producción. En FEAT-002 la CLI se usó una vez, a mano, para `input` y `label`. |
| Compensating control | La CLI se ejecuta solo a mano contra el registry oficial de shadcn/ui; ningún script de package.json ni job de .github/workflows/ci.yml la invoca; el código que agrega queda en src/components/ui/ y pasa por revisión, lint y tests; `pnpm audit` se repite en cada cierre de CODE y la supresión se borra cuando shadcn publique una versión con minimatch arreglado. |
| Review by | 2027-03-17 |

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
