# SAST FEAT-003b

| Field | Value |
|-------|-------|
| Ticket | FEAT-003b |
| Tools | revisión estática del diff `main...62867a4` (grep + lectura de `src/` y `tests/`), `pnpm audit` y `pnpm audit --prod` (pnpm 12.18.0) |
| Date | 2026-11-17 |

Alcance: los archivos que agregó o cambió FEAT-003b — `src/lib/{offline-selection,selection-messages}.ts`, `src/components/{device-store,use-online-status}.ts`, `src/components/{schedule-screen,app-menu,offline-pending-notice,forget-device-copy,offline-app,offline-card}.tsx`, `src/app/{selection-actions.ts,page.tsx}`, `src/app/{login,register,~offline}/page.tsx` y sus tests — y el árbol de dependencias completo (sin cambios en `package.json` ni `pnpm-lock.yaml` en este ticket).

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos en el diff; `localStorage` guarda solo id y nombre del usuario, la grilla y ids de shows, nunca la cookie de sesión (`httpOnly`); `.env*` sigue en `.gitignore:31` |
| F-SAST-02 | ✅ | sin SQL nuevo: la sincronización usa `saveSelection` de `src/server/selection.ts`, con tagged templates parametrizados de FEAT-003a |
| F-SAST-03 | ✅ | nada llega a exec/spawn |
| F-SAST-04 | ✅ | sin `eval` ni `new Function`; lo leído de `localStorage` se parsea con `JSON.parse` y se valida campo por campo en `src/lib/offline-selection.ts` (R-02) |
| F-SAST-05 | ✅ | no hay rutas de archivo con input del usuario |
| F-SAST-06 | ✅ | sin `dangerouslySetInnerHTML` ni `innerHTML`; el nombre y los textos de la copia se renderizan como texto de React |
| F-SAST-07 | ✅ | sin `fetch` saliente con input del usuario; la única llamada de red nueva es la Server Action al mismo origen |
| F-SAST-08 | ✅ | sin criptografía nueva |
| F-SAST-09 | ✅ | sin modos debug; el service worker sigue registrándose solo en producción |
| F-SAST-10 | ✅ | no se registra nada nuevo; `USER_MISMATCH` no dice de quién es la sesión |
| F-SAST-11 | ✅ | no hay superficie de subida de archivos |
| F-SAST-12 | ✅ | `saveSelectionAction` y el logout son Server Actions: POST con chequeo de origen de Next; la cookie sigue `SameSite=Lax` |
| F-SAST-13 | ✅ | `pnpm audit --prod`: 0 vulnerabilidades. En el árbol completo sigue el High de desarrollo `picomatch` ≤ 4.0.7 (GHSA-fc5q-39xc-vjpf, sin parche) ya aceptado por el usuario en FEAT-003a (abajo); este ticket no lo introduce ni cambia dependencias |
| F-SAST-14 | ✅ | `expectedUserId` validado en `src/app/selection-actions.ts:25` (string de 1 a 64, igual al id de la sesión); `showIds` validado en el servidor; lo leído del dispositivo validado en `src/lib/offline-selection.ts` |
| F-SAST-15 | ✅ | errores como códigos tipados del catálogo (`USER_MISMATCH`, `STORAGE_UNAVAILABLE`); los `catch` de `src/components/device-store.ts:24,34,43` y `src/components/schedule-screen.tsx:150` devuelven resultados tipados, sin `error.message` al usuario |
| F-SAST-16 | ✅ | sin paquetes nuevos; sigue `minimatch` 10.2.6 vía `shadcn>ts-morph>@ts-morph/common` (GHSA-g3hv-75wg-m249, moderada), suprimida abajo como en FEAT-001 a FEAT-003a |
| F-SAST-17 | ✅ | sin rutas de código dinámicas |

## Excepción aceptada por el usuario (fuera del protocolo de supresión)

Arrastrada sin cambios de FEAT-003a. El catálogo no permite suprimir un High, y este no se puede
corregir porque no existe versión parcheada.

- **Hallazgo:** `picomatch` ≤ 4.0.7 — ReDoS por extglobs repetidos (GHSA-fc5q-39xc-vjpf), High, sin
  versión parcheada, vía `shadcn>fast-glob>micromatch>picomatch` (devDependency).
- **Aceptado por:** el usuario (dueño del repo), 2026-11-17, en el cierre de CODE de FEAT-003a.
- **Motivo:** no llega al runtime de producción (`pnpm audit --prod`: 0); las herramientas que lo
  traen evalúan patrones del propio repo; no lo introduce este ticket; no hay parche que aplicar.
- **Revisión:** en cada cierre de CODE (`pnpm audit`, repetido en este); a más tardar el 2027-03-17.

## Suppressions

### Suppression: F-SAST-16 — minimatch 10.2.6 (GHSA-g3hv-75wg-m249) vía shadcn

| Field | Value |
|---|---|
| File | pnpm-lock.yaml:1 (ruta `.>shadcn>ts-morph>@ts-morph/common>minimatch`); declarada en package.json, devDependencies `shadcn: 4.23.0` |
| Category | F-SAST-16 — CVE Medium en una dependencia (DoS por amplificación de globparts en minimatch) |
| Disposition | ACCEPTED_RISK |
| Reviewer | usuario (dueño del repo), en el cierre de CODE de FEAT-001 |
| Date | 2026-11-17 |
| Justification | Arrastrada sin cambios de FEAT-001 a FEAT-003a: minimatch llega solo a través de la CLI de shadcn (devDependency, sin arreglo upstream), que no se importa desde src/, no corre en la CI ni en el build y no forma parte del runtime de producción. FEAT-003b no usó la CLI. |
| Compensating control | La CLI se ejecuta solo a mano; ningún script de package.json ni job de .github/workflows/ci.yml la invoca; `pnpm audit` se repite en cada cierre de CODE y la supresión se borra cuando shadcn publique una versión con minimatch arreglado. |
| Review by | 2027-03-17 |

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high) en producción; 1 High de desarrollo aceptado por el usuario (arriba)
Result: PASSED
