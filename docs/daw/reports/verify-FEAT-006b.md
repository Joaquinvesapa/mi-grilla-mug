# Verification FEAT-006b

Verificación del módulo completo sobre `8aa06ee` (rama `feat/FEAT-006b-administrar-grupos`). El
código no cambió desde la corrida del cierre de CODE (`dca7e0c`; entre los dos commits solo hay
`docs/`), así que esa corrida es la evidencia de los E2E (AGENTS.md, "Testing"):
`docs/daw/reports/tests-FEAT-006b.md`. Verificación cruzada independiente con
`daw-module-verifier`, que volvió a correr unit (588) e integración (103, contra la base de tests).

| Field | Value |
|---|---|
| Module | src/server/groups.ts, src/app/group-actions.ts, src/app/grupos/[groupId]/page.tsx, src/components/{group-members,rename-group-form,group-danger-zone,use-connection-guard,create-group-form,join-group-form,invite-link}, src/lib/{group-messages,group-rules}.ts |
| Line coverage | 100% |
| Branch coverage | 95.5% |
| Function coverage | 100% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint --type-aware) — clean, 0 findings; `pnpm typecheck` — 0 errores; `pnpm format:check` — OK |

La cobertura es la del código nuevo o modificado que instrumenta la suite unitaria (10 archivos de
`src/` del diff, sumados desde `coverage/coverage-final.json`). `src/app/group-actions.ts` y
`src/app/grupos/[groupId]/page.tsx` no se instrumentan en unit: los cubren
`tests/integration/group-actions.test.ts`, `tests/unit/app/group-page.test.tsx` y los E2E. Suite
entera: 99,59 % líneas, 97,25 % ramas, 99,5 % funciones.

## Acceptance criteria
- ✅ AC-14 — `src/server/groups.ts:removeMember`, `removeMemberAction`, `RemoveMemberForm` → `test-remove-member-ac14`, `test-action-remove-member`, `test-e2e-remove-member`
- ✅ AC-15 — `groups.ts:deleteGroup`, `deleteGroupAction`, `GroupDangerZone` → `test-delete-group-ac15`, `test-action-delete-redirects`, `test-delete-needs-confirmation`, `test-e2e-delete-group`
- ✅ AC-16 — `page.tsx` (isAdmin), `group-members.tsx` (`isAdmin && !isSelf`), `group-danger-zone.tsx` → `test-page-member-no-controls`, `test-e2e-member-no-controls`; el servidor lo respalda con `test-non-admin-rejected`
- ✅ AC-17 — `groups.ts:leaveGroup` (DELETE … RETURNING is_admin y promoción por joined_at, user_id) → `test-admin-leaves-ac17`, `test-concurrent-leaves`, `test-e2e-admin-leaves`
- ✅ AC-18 — `groups.ts:leaveGroup` (con 0 integrantes borra el grupo) → `test-last-member-leaves-ac18`, `test-e2e-last-leaves`
- ✅ AC-19 — `getGroup` y `listGroups` filtran por membresía; salir y borrar con `RedirectType.replace` → `test-left-member-rejected-ac19`, `test-action-leave-redirects`, `test-e2e-back-after-leave`. La parte "selección de sus integrantes" no tiene pantalla en este ticket (llega con FEAT-006c, decisión de la spec); ningún otro módulo de `src/` lee `group_members`.
- ✅ AC-28 — `src/components/use-connection-guard.ts` en los 7 formularios → `test-guard-offline-blocks`, `test-forms-offline-ac28`, `test-e2e-offline-ac28`

## Spec blocks
- ✅ Block 1 — servicio: renombrar, sacar, borrar y salir; `regenerateInvite` con el patrón de dos sentencias (Vuelta 1). 15/15 tests requeridos.
- ✅ Block 2 — acciones y pantalla del grupo, con W3 y W6 de la Vuelta 1. 11/11 tests requeridos.
- ✅ Block 3 — sin conexión en las 7 acciones de grupos, con W4 y W7. 7/7 tests requeridos.
- ✅ Block 4 — E2E de administrar y salir. 8/8 tests requeridos.

## Tests
Los 41 ids requeridos por la spec existen en `tests/` (grep) y pasan en la corrida del cierre de CODE:

- ✅ `test-remove-member-ac14`
- ✅ `test-delete-group-ac15`
- ✅ `test-admin-leaves-ac17`
- ✅ `test-last-member-leaves-ac18`
- ✅ `test-left-member-rejected-ac19`
- ✅ `test-rejoin-after-leave`
- ✅ `test-rename-group`
- ✅ `test-member-leaves-keeps-admin`
- ✅ `test-non-admin-rejected`
- ✅ `test-foreign-group-rejected`
- ✅ `test-invalid-name-rejected`
- ✅ `test-member-not-found-rejected`
- ✅ `test-service-unavailable`
- ✅ `test-concurrent-leaves`
- ✅ `test-regenerate-after-leave-rejected`
- ✅ `test-page-admin-controls`
- ✅ `test-page-member-no-controls`
- ✅ `test-delete-needs-confirmation`
- ✅ `test-leave-needs-confirmation`
- ✅ `test-action-remove-member`
- ✅ `test-action-leave-redirects`
- ✅ `test-action-delete-redirects`
- ✅ `test-action-rename`
- ✅ `test-action-unauthenticated-rejected`
- ✅ `test-action-not-admin-rejected`
- ✅ `test-rename-form-invalid-rejected`
- ✅ `test-guard-offline-blocks`
- ✅ `test-guard-online-clears`
- ✅ `test-guard-rejected-offline`
- ✅ `test-guard-rejected-online`
- ✅ `test-guard-redirect-rethrown`
- ✅ `test-guard-message-priority`
- ✅ `test-forms-offline-ac28`
- ✅ `test-e2e-remove-member`
- ✅ `test-e2e-member-no-controls`
- ✅ `test-e2e-admin-leaves`
- ✅ `test-e2e-last-leaves`
- ✅ `test-e2e-delete-group`
- ✅ `test-e2e-back-after-leave`
- ✅ `test-e2e-rename`
- ✅ `test-e2e-offline-ac28`

- ✅ Sad-path tests: cada función y acción con entrada tiene casos rechazados — NOT_FOUND (grupo ajeno, inexistente o mal formado), NOT_ADMIN, INVALID_NAME, MEMBER_NOT_FOUND (uno mismo, ausente, id inválido o con inyección), SERVICE_UNAVAILABLE en el servicio, UNAUTHENTICATED en las acciones, y sin conexión o con la acción rechazada en el hook.

## Threat model
R-01 a R-12 implementados y probados (detalle en la verificación cruzada): identidad desde la
sesión, `is_admin` leído bajo el lock del grupo, ids validados antes de la base, filtro por
membresía, NOT_FOUND para grupos ajenos, promoción en el servidor, borrado del grupo vacío,
confirmación en salir y borrar, `listGroups` sin `userId`, `RedirectType.replace` y
`unstable_rethrow`.

## Warnings (no bloquean)
- W-1 (F-VER-04, parcial): ningún test pasa por la rama de `leaveGroupAction` y `deleteGroupAction` cuando el servicio responde SERVICE_UNAVAILABLE (devolver el mensaje sin redirigir). Las dos acciones tienen otros casos rechazados probados.
- W-2 (texto): con conexión, si la red corta el envío de "Unirme", el hook muestra el genérico de SERVICE_UNAVAILABLE ("No pudimos guardar…") y no el propio de unirse ("No pudimos unirte…"). Cumple la spec al pie de la letra.
- W-3 (NFR-01): `test-e2e-back-after-leave` prueba un solo "Atrás", como pide la spec; un segundo "Atrás" hacia la entrada de "Unirme" (otro documento, bfcache de WebKit) no está probado.
- W-4 (W-VER-03): `waitUntilWaiting` de `tests/integration/groups.test.ts` cuenta cualquier proceso que espera un lock; seguro hoy con `fileParallelism: false`.
- W-5 (TDD): el rojo previo de los Blocks 1-3 quedó en los informes de cada bloque y lo reprodujeron los verifiers por bloque contra el commit anterior; los E2E del Block 4 no tuvieron rojo (aceptado en `decisions-FEAT-006b.md`).

Result: PASSED
