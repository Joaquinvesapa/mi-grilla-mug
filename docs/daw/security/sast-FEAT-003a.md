# SAST FEAT-003a

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| Tools | revisión estática del diff `main..e1b1a63` (grep + lectura de `src/`, `prisma/`, `data/`, `.github/`), `pnpm audit` y `pnpm audit --prod` (pnpm 12.18.0), `pnpm why picomatch` |
| Date | 2026-11-17 |

Alcance: los archivos que agregó o cambió FEAT-003a — `prisma/seed.ts`, `prisma/schema.prisma` y la migración `20261117185304_schedule`, `data/schedule.json`, `src/lib/{festival-time,schedule-types,schedule-layout,clashes,selection-messages,database-url}.ts`, `src/server/{schedule,selection,database-url}.ts`, `src/app/{selection-actions.ts,page.tsx,globals.css}`, `src/components/{schedule-grid,schedule-screen,day-picker,pending-bar,app-menu}.tsx`, `src/components/ui/{tabs,alert-dialog,drawer}.tsx`, `.github/workflows/ci.yml` — y el árbol de dependencias completo.

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos embebidos: el seed lee `DATABASE_URL` del entorno o de `.env` (gitignored, `git check-ignore .env`) y nunca la imprime (`prisma/seed.ts:286` imprime solo el código) |
| F-SAST-02 | ✅ | el seed usa `pg` con SQL parametrizado `$1..$7` y `ANY($1::text[])` (`prisma/seed.ts:194-231`); `src/server/selection.ts:85,111,116,118` usa los tagged templates `$queryRaw`/`$executeRaw`, que parametrizan; no hay `*Unsafe` ni concatenación fuera del cliente generado |
| F-SAST-03 | ✅ | nada llega a exec/spawn/child_process |
| F-SAST-04 | ✅ | sin `eval`, `new Function` ni deserialización insegura; `JSON.parse` solo sobre `data/schedule.json` versionado, validado antes de escribir (`prisma/seed.ts:181`) |
| F-SAST-05 | ✅ | el seed lee una ruta fija (`data/schedule.json`); ningún input del usuario forma rutas |
| F-SAST-06 | ✅ | nombres de artista, subtítulos y mensajes se renderizan como texto de React; no hay `dangerouslySetInnerHTML` ni `innerHTML` (R-07) |
| F-SAST-07 | ✅ | no hay fetch saliente guiado por input del usuario |
| F-SAST-08 | ✅ | el ticket no agrega criptografía; sin MD5/SHA1 |
| F-SAST-09 | ✅ | sin modo debug nuevo; la página sigue dinámica con `no-store` (R-11, `test-e2e-grid-no-store`) |
| F-SAST-10 | ✅ | los logs nuevos llevan solo código y hora (`src/server/schedule.ts:26`, `src/server/selection.ts:42`, `prisma/seed.ts:286,333`); sin ids de usuario, URL de la base ni mensajes de `pg` |
| F-SAST-11 | ✅ | no hay superficie de subida de archivos |
| F-SAST-12 | ✅ | el guardado es una Server Action (POST con chequeo de `Origin` de Next 16) y la cookie es `SameSite=Lax` (R-03) |
| F-SAST-13 | ✅ | `pnpm audit --prod`: 0 vulnerabilidades en las dependencias de producción. En el árbol completo hay un High solo en dependencias de desarrollo — `picomatch` ≤ 4.0.7, ReDoS (GHSA-fc5q-39xc-vjpf), sin versión parcheada, vía `shadcn` 4.23.0 y `vitest`/`vite` (`pnpm-lock.yaml:1`) — que no se puede corregir ni, según el catálogo, suprimir: queda como excepción aceptada por el usuario, abajo |
| F-SAST-14 | ✅ | `saveSelection` valida arreglo, largo, patrón, repetidos y existencia antes de escribir (`src/server/selection.ts:46-65`, R-02); el seed valida la forma del JSON (`SCHEDULE_INVALID`) |
| F-SAST-15 | ✅ | catálogo cerrado de códigos (`INVALID_SELECTION`, `UNAUTHENTICATED`, `SERVICE_UNAVAILABLE`, `NETWORK_ERROR`, `SCHEDULE_UNAVAILABLE`); nunca `error.message` al cliente (R-05) |
| F-SAST-16 | ✅ | `@radix-ui/react-tabs` 1.2.1, `@radix-ui/react-alert-dialog` 1.2.1 y `vaul` 1.1.2 sin CVE conocidas; sigue `minimatch` 10.2.6 vía `shadcn>ts-morph>@ts-morph/common` (GHSA-g3hv-75wg-m249, moderada), suprimida abajo como en FEAT-001 y FEAT-002 |
| F-SAST-17 | ✅ | sin rutas de código dinámico |

## Excepción aceptada por el usuario (fuera del protocolo de supresión)

El catálogo no permite suprimir un High, y este no se puede corregir porque no existe versión
parcheada. No se presenta como supresión: se deja a la vista como decisión del usuario.

- **Hallazgo:** `picomatch` ≤ 4.0.7 — ReDoS por extglobs repetidos (GHSA-fc5q-39xc-vjpf), severidad
  High, sin versión parcheada. Rutas (`pnpm why picomatch`): `shadcn>fast-glob>micromatch>picomatch`
  2.3.2, `shadcn>@shadcn/registry>@dotenvx/dotenvx>picomatch` 4.0.7 y
  `vitest>vite>tinyglobby>fdir>picomatch` 4.0.7. Todas son devDependencies.
- **Aceptado por:** el usuario (dueño del repo), 2026-11-17, en el cierre de CODE de FEAT-003a, entre
  las opciones "excepción dev-only", "sacar shadcn" y "esperar el parche".
- **Motivo:** no llega al runtime de producción (`pnpm audit --prod`: 0); las herramientas que lo
  traen evalúan patrones del propio repo (configuración de Vitest y Vite, rutas de shadcn), no input
  de usuarios; no lo introduce este ticket (está igual en `main`); y no hay parche que aplicar.
- **Revisión:** en cada cierre de CODE (`pnpm audit`), y se actualizan las dependencias en cuanto
  `picomatch` publique una versión arreglada; a más tardar el 2027-03-17.

## Suppressions

### Suppression: F-SAST-16 — minimatch 10.2.6 (GHSA-g3hv-75wg-m249) vía shadcn

| Field | Value |
|---|---|
| File | pnpm-lock.yaml:1 (ruta `.>shadcn>ts-morph>@ts-morph/common>minimatch`); declarada en package.json, devDependencies `shadcn: 4.23.0` |
| Category | F-SAST-16 — CVE Medium en una dependencia (DoS por amplificación de globparts en minimatch) |
| Disposition | ACCEPTED_RISK |
| Reviewer | usuario (dueño del repo), en el cierre de CODE de FEAT-001 |
| Date | 2026-11-17 |
| Justification | Arrastrada sin cambios de FEAT-001 y FEAT-002: minimatch llega solo a través de la CLI de shadcn (devDependency, 4.23.0 sigue siendo la última versión, sin arreglo upstream), que no se importa desde src/, no corre en la CI ni en el build y no forma parte del runtime de producción. En FEAT-003a la CLI se usó una vez, a mano, para `tabs`, `alert-dialog` y `drawer`. |
| Compensating control | La CLI se ejecuta solo a mano contra el registry oficial de shadcn/ui; ningún script de package.json ni job de .github/workflows/ci.yml la invoca; el código que agrega queda en src/components/ui/ y pasa por revisión, lint y tests; `pnpm audit` se repite en cada cierre de CODE y la supresión se borra cuando shadcn publique una versión con minimatch arreglado. |
| Review by | 2027-03-17 |

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high) en producción; 1 High de desarrollo aceptado por el usuario (arriba)
Result: PASSED
