# Verification FEAT-003b

Verificación del módulo completo (Blocks 1–4 y Spec loop 1) sobre `5a979b7`, con
`/daw-verify-module` y una verificación cruzada independiente (`daw-module-verifier`) contra el
PRD, la spec, las decisiones, el threat model, el reporte de tests y el SAST. Ronda 1.

| Field | Value |
|---|---|
| Module | src/lib/offline-selection.ts, src/components/{device-store,use-online-status}.ts, src/components/{schedule-screen,app-menu,offline-app,offline-card,offline-pending-notice,forget-device-copy}.tsx, src/app/selection-actions.ts, src/app/~offline/page.tsx |
| Line coverage | 98.84% |
| Branch coverage | 97.48% |
| Function coverage | 98.68% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (`oxlint --type-aware`) — clean; `pnpm format:check` — 150 archivos OK; `pnpm typecheck` — 0 errores |

La cobertura es la de los archivos nuevos o modificados en `src/lib` y `src/components` (suite
unitaria, v8; global 99,43 / 98,19 / 99,03). `src/app/selection-actions.ts` queda fuera del
`include` de cobertura desde FEAT-001; tiene tests unitarios y de integración para todas sus ramas.
Corridas de la verificación cruzada: `pnpm test` 354/354, `pnpm test:integration` 48/48, E2E
`offline.spec.ts` + `pwa.spec.ts` en `mobile-chromium` 25/25; WebKit y `mobile-360` según
`docs/daw/reports/tests-FEAT-003b.md` (suite completa en Docker, 229 pasan y 1 skip preexistente).

## Acceptance criteria
- ✅ AC-20 — `test-offline-app-grid`, `test-screen-writes-snapshot`, `test-screen-sync-on-mount`, `test-offline-snapshot-roundtrip`, E2E `test-e2e-offline-grid` (src/components/offline-app.tsx:decideView)
- ✅ AC-21 — `test-offline-app-missing-copy`, `test-offline-app-invalid-copy`, E2E `test-e2e-offline-after-logout` (src/components/offline-app.tsx:decideView)
- ✅ AC-22 — `test-screen-save-offline-pending`, `test-screen-save-offline-skips-call`, `test-device-store-persists`, `test-offline-app-pending-first`, E2E `test-e2e-offline-save-reopen` (src/components/schedule-screen.tsx:save)
- ✅ AC-23 — `test-screen-sync-on-mount`, `test-screen-sync-on-online`, E2E `test-e2e-offline-sync` (src/components/schedule-screen.tsx:sync); ver H-01, aceptado
- ✅ AC-24 — los tests de reintento de la sincronización (unit y E2E, nombrados abajo en "Tests"): la pendiente se conserva y el siguiente `online` la sube
- ✅ AC-25 — `test-notice-content`, `test-screen-save-offline-pending`, `test-offline-app-pending-first`, E2E `test-e2e-offline-save-reopen` (src/components/offline-pending-notice.tsx)
- ✅ AC-26 — integración `test-selection-sync-overwrites-other-device`, E2E `test-e2e-offline-last-write-wins`
- ✅ AC-27 — `test-offline-pending-other-user-rejected`, `test-device-store-pending-by-user`, `test-action-user-mismatch-rejected`, `test-screen-other-user-pending-ignored`, `test-screen-sync-mismatch-kept`, `test-app-menu-logout-clears-copy`, `test-forget-device-copy`, E2E `test-e2e-offline-other-account-rejected` (src/app/selection-actions.ts:isSameUser)
- ✅ NFR-01 — integración `test-selection-latency` (p95 ≤ 1000 ms) y E2E con `request.timing()` (21–74 ms)
- ✅ NFR-02 — E2E `test-e2e-offline-notice-width` a 360 y 430 px, con y sin conexión

## Spec blocks
- ✅ Block 1 — Copia y pendiente en el dispositivo: 4/4 tareas, sus 6 tests nombrados pasan
- ✅ Block 2 — Guardar sin conexión y sincronizar: 11/11 tareas, sus 22 tests nombrados pasan
- ✅ Block 3 — La grilla sin conexión (con el Spec loop 1): 4/4 tareas, sus 5 tests nombrados pasan
- ✅ Block 4 — E2E sin conexión: 1/1 tarea, sus 8 tests nombrados pasan en los tres proyectos mobile

## Tests
- ✅ Reintento de la sincronización: `test-screen-sync-error-retry` y E2E `test-e2e-offline-sync-error-retry` pasan
- ✅ Resto de los tests nombrados por bloque, todos pasan: `test-offline-snapshot-invalid`, `test-device-store-unavailable-error` (Block 1); `test-action-expected-user-invalid`, `test-action-unauthorized-before-mismatch`, `test-screen-save-storage-error`, `test-screen-sync-invalid-discarded`, `test-screen-online-save-clears-pending`, `test-app-menu-offline-disabled`, `test-online-status`, `test-messages-new-codes`, `test-home-page-user-id` (Block 2); `test-offline-app-other-path-rejected` (Block 3)
- ✅ Los 41 tests de "Required tests" de la spec existen y pasan (`test-screen-save-network-error` se reescribió como `test-screen-save-offline-pending`, como pide la spec)
- ✅ Sad-path tests: `parseSnapshot` (20 casos inválidos), `parsePending` (11 y el de otro dueño), `device-store` con `setItem`/`getItem`/`removeItem` que lanzan, `saveSelectionAction` con `expectedUserId` inválido y sin sesión, `ScheduleScreen` con `STORAGE_UNAVAILABLE`/`INVALID_SELECTION`/`USER_MISMATCH`/excepción, `OfflineApp` con copia inválida y ruta ajena

## Threat model
R-01, R-02, R-04, R-05, R-06, R-07 y R-08 tienen su mitigación en el código; R-03 es el riesgo
aceptado por el usuario en PLAN, con las mitigaciones parciales presentes (copia borrada al cerrar
sesión y en `/login`/`/register`, "Cerrar sesión" deshabilitado sin conexión con su motivo).

## Warnings (no bloquean)
- **H-01 (aceptado por el usuario, 2026-11-17):** la sincronización corre al montar la pantalla y
  con el evento `online`. Con "lie-fi" (`navigator.onLine` en `true` y los pedidos fallando), la
  pendiente queda guardada, pero al volver la señal no llega `online`, y una PWA que vuelve del
  segundo plano no se vuelve a montar: no se sincroniza hasta reabrir o recargar la app, mientras el
  aviso dice "se suben solos". Cumple la spec, que nombra esos dos disparadores. El usuario decidió
  cerrar FEAT-003b así y dejarlo para un ticket nuevo (sincronizar también en `visibilitychange` o
  `pageshow`, y reintentar cada ~30 s mientras haya pendiente).
- **H-02 (W-VER-01):** `NETWORK_ERROR` sin uso en `src/` (`src/lib/selection-messages.ts`), conservado
  por decisión registrada; el comentario de cabecera tiene una línea de 121 columnas.
- **H-03:** la fila NFR-01 de la spec y un comentario de `tests/e2e/offline.spec.ts:334` citan
  `test-selection-save-p95`; el test se llama `test-selection-latency`
  (`tests/integration/selection.test.ts:109`).
- **H-04:** las ramas inválidas de día y escenario de `parseSnapshot`
  (`src/lib/offline-selection.ts:101`, `:113`) no tienen test propio.
- **H-05 (W-VER-03):** en WebKit el E2E inyecta la falla sobre el `fetch` de la página filtrando por
  el header `next-action`; un cambio interno de Next lo haría fallar de forma visible
  (`aborted > 0`), no en silencio. Documentado en las decisiones.
- **H-06:** `tests/e2e/pwa.spec.ts` cambió solo para usar el helper compartido; documentado.
- **H-07:** la evidencia TDD por bloque está en las revisiones de CODE (`.daw-work/review-block-*.md`
  y las decisiones), no es re-verificable desde VERIFY.

Result: PASSED
