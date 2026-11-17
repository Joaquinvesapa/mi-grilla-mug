# SAST FEAT-001

| Field | Value |
|-------|-------|
| Ticket | FEAT-001 |
| Tools | revisión manual + `git grep` de patrones (secretos, exec/eval, HTML, SQL crudo, fetch/fs, logs), `pnpm audit` (pnpm 12.18.0), triage de `daw-sec-auditor` |
| Date | 2026-11-17 |
| Alcance | `src/` (sin `src/server/generated/`), `next.config.ts`, `.github/workflows/ci.yml`, `scripts/test-e2e-docker.sh`, `docker-compose.yml`, `.env.example`, dependencias de `package.json` |

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos embebidos; `ci-only-password` en `ci.yml` es la credencial descartable del service efímero de la CI, documentada como no secreta; `.env.example` solo tiene marcadores; `docker-compose.yml` exige `POSTGRES_PASSWORD` desde `.env`; `.gitignore` excluye `.env*` |
| F-SAST-02 | ✅ | el único SQL es `$queryRaw` con el template fijo `SELECT 1` (`src/server/health.ts:26`); sin `*Unsafe` |
| F-SAST-03 | ✅ | sin `child_process` en `src/`; `scripts/test-e2e-docker.sh` pasa `"$@"` como argumentos posicionales de `bash -c`, sin interpolarlos |
| F-SAST-04 | ✅ | sin deserialización insegura |
| F-SAST-05 | ✅ | `/icons/[size]` con lista blanca, `dynamicParams = false` y `force-static`; `/serwist/[path]` es un lookup en un `Map` con `dynamicParams = false`, sin tocar el filesystem |
| F-SAST-06 | ✅ | sin `dangerouslySetInnerHTML` ni `innerHTML`; el iframe de `/demo` tiene `src="/"` fijo; `X-Frame-Options: SAMEORIGIN` y `frame-ancestors 'self'` en todas las rutas (R-08) |
| F-SAST-07 | ✅ | sin `fetch` de servidor; `DATABASE_URL` sale del entorno y la valida `src/server/database-url.ts` (rechaza `host`/`hostaddr` en la query, exige TLS para hosts remotos) |
| F-SAST-08 | ✅ | sin criptografía de seguridad; `randomUUID()` solo como revisión de precache |
| F-SAST-09 | ✅ | `ignoreBuildErrors` es la decisión de ADR-001 (los tipos se chequean con `pnpm typecheck` en la CI); el service worker se desactiva fuera de producción |
| F-SAST-10 | ✅ | `src/server/health.ts` y `src/server/db.ts` registran solo un código genérico y la hora; nunca la URL ni el error |
| F-SAST-11 | ✅ | no hay superficie de subida de archivos |
| F-SAST-12 | ✅ | no hay operaciones que cambien estado; `/api/health` solo responde `GET` y devuelve 405 al resto |
| F-SAST-13 | ✅ | `pnpm audit`: ninguna vulnerabilidad crítica ni alta |
| F-SAST-14 | ✅ | las únicas entradas externas son `params.size` (lista blanca) y `params.path` (lookup + `dynamicParams = false`) |
| F-SAST-15 | ✅ | `/api/health` arma la respuesta campo por campo; un `DATABASE_URL` ausente o inseguro termina en un 500 genérico de Next, sin el mensaje |
| F-SAST-16 | ✅ | corregido: `glob` 13.0.6 (GHSA-3g3m-2fjr-6pw4) y `minimatch` 10.2.6 (GHSA-g3hv-75wg-m249) vía `@serwist/build`, al subir `serwist` y `@serwist/turbopack` a 9.5.15 (`glob` 14.0.6, `minimatch` 11.0.8). Queda `minimatch` 10.2.6 vía `shadcn>ts-morph>@ts-morph/common` (`pnpm-lock.yaml`), suprimido abajo como ACCEPTED_RISK |
| F-SAST-17 | ✅ | sin `eval`, `new Function` ni `exec` |

Nota: `pnpm audit` no corre en la CI; se propone sumar `pnpm audit --audit-level=high` al job `quality`
en un ticket aparte (informativo).

## Suppressions

### Suppression: F-SAST-16 — minimatch 10.2.6 (GHSA-g3hv-75wg-m249) vía shadcn

| Field | Value |
|---|---|
| File | pnpm-lock.yaml:1 (ruta `.>shadcn>ts-morph>@ts-morph/common>minimatch`); declarada en package.json, devDependencies `shadcn: 4.23.0` |
| Category | F-SAST-16 — CVE Medium en una dependencia (DoS por amplificación de globparts en minimatch) |
| Disposition | ACCEPTED_RISK |
| Reviewer | usuario (dueño del repo) |
| Date | 2026-11-17 |
| Justification | minimatch llega solo a través de la CLI de shadcn (devDependency, 4.23.0 es la última versión, sin arreglo upstream), que no se importa desde src/, no corre en la CI ni en el build y no forma parte del runtime de producción. Los patrones que evalúa salen del tsconfig y de rutas locales del repo, no de un input no confiable: el peor caso es colgar la CLI en la máquina de quien la invoca. |
| Compensating control | La CLI se ejecuta solo a mano contra el registry oficial de shadcn/ui; ningún script de package.json ni job de .github/workflows/ci.yml la invoca; el código que agrega queda en src/components/ui/ y pasa por revisión, lint y tests; `pnpm audit` se repite en cada cierre de CODE y la supresión se borra cuando shadcn publique una versión con minimatch arreglado. |
| Review by | 2027-03-17 |

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
