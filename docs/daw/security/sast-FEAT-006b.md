# SAST FEAT-006b

| Field | Value |
|-------|-------|
| Ticket | FEAT-006b |
| Tools | revisión manual con grep sobre los 12 archivos de `src/` del diff (`git diff main...HEAD -- src`), oxlint 1.94.0 --type-aware, pnpm audit --prod |
| Date | 2026-11-18 |

Alcance: `src/server/groups.ts`, `src/app/group-actions.ts`, `src/app/grupos/[groupId]/page.tsx`,
`src/components/{create-group-form,group-danger-zone,group-members,invite-link,join-group-form,rename-group-form}.tsx`,
`src/components/use-connection-guard.ts`, `src/lib/group-messages.ts`, `src/lib/group-rules.ts`.

| Rule | Verdict | Notes |
|---|---|---|
| F-SAST-01 | ✅ | sin secretos en el código; `BETTER_AUTH_SECRET` y `DATABASE_URL` vienen de `.env`, que está en `.gitignore` (`git check-ignore .env`) |
| F-SAST-02 | ✅ | todas las sentencias nuevas de `src/server/groups.ts` son `$queryRaw`/`$executeRaw` con tagged template (parámetros, no concatenación); no hay `$queryRawUnsafe` ni `$executeRawUnsafe`; `groupId` y `memberUserId` pasan por `GROUP_ID_PATTERN` y `USER_ID_PATTERN` antes de la base |
| F-SAST-03 | ✅ | nada llega a exec/spawn; no se importa `child_process` |
| F-SAST-04 | ✅ | sin `eval`, `new Function` ni deserialización insegura |
| F-SAST-05 | ✅ | sin rutas de archivo armadas con input; `revalidatePath(`/grupos/${groupId}`)` en `src/app/group-actions.ts:94` y `:121` corre solo después de que el servicio aceptó el UUID |
| F-SAST-06 | ✅ | sin `dangerouslySetInnerHTML` ni `innerHTML`; nombres de grupo e integrantes se renderizan como texto de React (escapado) |
| F-SAST-07 | ✅ | no hay fetch saliente armado con input; las Server Actions no llaman a otros orígenes |
| F-SAST-08 | ✅ | sin cripto nueva; el link sigue con HMAC-SHA256 y AES-256-GCM de FEAT-006a (ADR-006), sin cambios |
| F-SAST-09 | ✅ | sin modo debug; ningún `console.log` en el código de producción |
| F-SAST-10 | ✅ | el único log es `[groups] SERVICE_UNAVAILABLE at=<fecha>` (`src/server/groups.ts:167`), sin error, ids ni nombres |
| F-SAST-11 | ✅ | no hay superficie de upload |
| F-SAST-12 | ✅ | las cuatro acciones nuevas son Server Actions de Next (POST con chequeo de origen, R-07 de FEAT-006a); ninguna mutación por GET |
| F-SAST-13 | ✅ | `pnpm audit --prod`: No known vulnerabilities found |
| F-SAST-14 | ✅ | validación en el borde del servicio: `GROUP_ID_PATTERN`, `USER_ID_PATTERN` (`^[A-Za-z0-9_-]{1,64}$`), `normalizeGroupName`; permisos con la fila de membresía de la sesión bajo el lock del grupo |
| F-SAST-15 | ✅ | al cliente solo llegan textos del catálogo de `src/lib/group-messages.ts`; `useConnectionGuard` muestra `OFFLINE_ACTION` o el genérico, nunca `error.message` |
| F-SAST-16 | ✅ | sin dependencias nuevas en este ticket (`package.json` y `pnpm-lock.yaml` sin cambios) |
| F-SAST-17 | ✅ | sin rutas de código dinámicas |

## Suppressions
None.

Total: 17 clean, 0 vulnerabilities (0 critical, 0 high)
Result: PASSED
