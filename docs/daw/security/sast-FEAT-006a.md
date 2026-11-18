# SAST FEAT-006a

| Field | Value |
|-------|-------|
| Ticket | FEAT-006a |
| Tools | grep sobre los 22 archivos de `src/` y `prisma/` del ticket (`git diff main...HEAD`), oxlint --type-aware, pnpm audit --prod |
| Date | 2026-11-18 |

Alcance: los archivos de `src/` y `prisma/` del ticket, sobre `bd98d78`.
Re-cierre de CODE sobre `086f3c5` (vuelta 3 de la spec): el único cambio de código es
`src/components/invite-link.tsx`, que quita el `AlertDialog` y envía el mismo `<form>` de la Server
Action de regenerar (con el chequeo de origen de Next, R-07), y `src/lib/group-messages.ts`, que
pierde la constante `REGENERATE_CONFIRM`. Solo se borra código: ningún sink nuevo (sin
`innerHTML`, `eval`, `fetch` ni logs), sin dependencias nuevas y `pnpm audit --prod` sin
vulnerabilidades conocidas. Los veredictos de abajo siguen vigentes.

- **Nuevos:** `prisma/migrations/20261118055108_groups/migration.sql`, `src/server/groups.ts`,
  `src/server/invite-crypto.ts`, `src/lib/group-rules.ts`, `src/lib/group-messages.ts`,
  `src/lib/return-path.ts`, `src/app/group-actions.ts`, `src/app/grupos/page.tsx`,
  `src/app/grupos/[groupId]/page.tsx`, `src/app/invitacion/[token]/page.tsx`,
  `src/components/create-group-form.tsx`, `group-members.tsx`, `invite-link.tsx`,
  `join-group-form.tsx`.
- **Modificados:** `prisma/schema.prisma`, `src/app/auth-actions.ts`, `src/app/login/page.tsx`,
  `src/app/register/page.tsx`, `src/components/login-form.tsx`, `register-form.tsx`,
  `app-menu.tsx`, `src/proxy.ts`.

El grep de `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`, `exec(`, `spawn(`,
`$queryRawUnsafe`, `$executeRawUnsafe`, `console.log`, MD5/SHA1 y ECB no encontró nada; los aciertos
de `password` y `secret` son nombres de campos del formulario y la derivación de claves de
`invite-crypto.ts`, sin valores.

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos en el código; `BETTER_AUTH_SECRET` se lee del entorno al usarse (`invite-crypto.ts:100`, `readAuthEnv`); `.env` sigue en `.gitignore` |
| F-SAST-02 | ✅ | todo el SQL de `groups.ts` va con plantillas etiquetadas de `$queryRaw`/`$executeRaw` (parametrizadas), sin `Unsafe` ni concatenación |
| F-SAST-03 | ✅ | nada llega a exec/spawn |
| F-SAST-04 | ✅ | sin `eval`, `new Function` ni deserialización insegura; el ciphertext se parsea con base64url estricto y largos fijos |
| F-SAST-05 | ✅ | no hay rutas de archivo |
| F-SAST-06 | ✅ | nombres de grupo e integrantes renderizados como texto de React, sin `dangerouslySetInnerHTML`; título de las pestañas fijo |
| F-SAST-07 | ✅ | sin pedidos salientes; el link se arma con `window.location.origin`, no con el header `Host` |
| F-SAST-08 | ✅ | token de 256 bits de `randomBytes`; HMAC-SHA256 y AES-256-GCM con IV de 12 bytes aleatorio, tag de 16 y AAD; claves HKDF-SHA256 (ADR-006) |
| F-SAST-09 | ✅ | sin modo debug |
| F-SAST-10 | ✅ | el único log es `[groups] SERVICE_UNAVAILABLE at=<ISO>`, sin el error, sin el token ni el secreto |
| F-SAST-11 | ✅ | no hay superficie de subida |
| F-SAST-12 | ✅ | las escrituras son Server Actions (POST con el chequeo de origen de Next); los GET no escriben |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found |
| F-SAST-14 | ✅ | nombre (1–40 puntos de código), `groupId` (UUID), token (43 base64url) y `next` (lista blanca exacta en `return-path.ts`) validados en el servidor antes de la base |
| F-SAST-15 | ✅ | errores como códigos con mensajes del catálogo; un grupo ajeno responde 404 igual que uno inexistente |
| F-SAST-16 | ✅ | sin dependencias nuevas (`package.json` y `pnpm-lock.yaml` sin cambios) |
| F-SAST-17 | ✅ | sin rutas de código dinámico; la redirección de vuelta solo acepta `/invitacion/<token>` (R-10) |

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
