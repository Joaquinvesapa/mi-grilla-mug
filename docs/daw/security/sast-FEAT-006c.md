# SAST FEAT-006c

| Field | Value |
|-------|-------|
| Ticket | FEAT-006c |
| Tools | revisión del diff `origin/main...HEAD` (36 archivos de `src/` y `tests/`) con grep de patrones y lectura; `pnpm audit --prod`; oxlint 1.94.0 con tipos |
| Date | 2026-11-18 |

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos en el código; `.env` está en `.gitignore`. Las dos URLs con `user:secret` de `tests/unit/e2e/db.test.ts` son fixtures falsos de un test con `pg` mockeado (una remota para probar el rechazo y una local), sin credenciales reales |
| F-SAST-02 | ✅ | `listGroupPicks` (`src/server/groups.ts`) es un tagged template de `$queryRaw` con `${userId}` como parámetro; `tests/e2e/db.ts` usa `$1..$n` y `unnest($2::text[])`; no hay `$queryRawUnsafe` ni concatenación |
| F-SAST-03 | ✅ | nada llega a exec/spawn/child_process (el único `.exec(` es `RegExp.exec` en un test) |
| F-SAST-04 | ✅ | sin `eval` ni `new Function`; el JSON de `localStorage` pasa por `parseGroupChoice` y `groupPicksOf`, que validan forma y límites (R-04) |
| F-SAST-05 | ✅ | no hay rutas de archivos armadas con entrada del usuario |
| F-SAST-06 | ✅ | nombres de amigos y grupos se pintan como texto de React; sin `dangerouslySetInnerHTML` ni `innerHTML` |
| F-SAST-07 | ✅ | no hay pedidos salientes construidos con entrada del usuario |
| F-SAST-08 | ✅ | no se agrega criptografía; el token de invitación (ADR-006) no cambia |
| F-SAST-09 | ✅ | sin modo debug ni `console.log` nuevos en `src/` |
| F-SAST-10 | ✅ | el único log nuevo es `[groups] SERVICE_UNAVAILABLE at=…`, sin el error ni datos personales |
| F-SAST-11 | ✅ | no hay superficie de subida de archivos |
| F-SAST-12 | ✅ | no hay formularios ni Server Actions nuevos que cambien estado: `listGroupPicks` solo lee en el render de `/`, y el selector solo escribe en `localStorage` |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found; `package.json` y `pnpm-lock.yaml` sin cambios |
| F-SAST-14 | ✅ | `userId` sale de la sesión verificada; lo leído del dispositivo se valida con límites (≤ 10 grupos, ≤ 19 amigos, largos acotados, ids con patrón, shows conocidos, ids de grupo sin repetir); el valor del selector solo se acepta si es un grupo cargado o "Sin grupo" (R-05) |
| F-SAST-15 | ✅ | un fallo de la base devuelve `SERVICE_UNAVAILABLE` y la página muestra la grilla sin selector; ningún mensaje de infraestructura llega al cliente (R-06) |
| F-SAST-16 | ✅ | no hay paquetes nuevos: el `native-select` de shadcn se copió sin su dependencia `cn` (revertida) y usa `lucide-react`, que ya estaba |
| F-SAST-17 | ✅ | sin rutas de código dinámico |

Notas de diseño revisadas contra el modelo de amenazas (`docs/daw/security/threat-FEAT-006c.md`):
R-01 (consulta anclada en `group_members me WHERE me.user_id = ${userId}`, test de integración con un
tercero), R-02 (el resultado no lleva ids de cuenta de amigos, test unitario e integración), R-03 (la
copia con grupos se borra al cerrar sesión y en `/login`, tests de los dos caminos), R-07 (el helper
de E2E pasa por `assertTruncatableDatabaseUrl` antes de conectarse, test con `pg` mockeado y 0
conexiones).

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
