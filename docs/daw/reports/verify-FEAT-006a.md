# Verification FEAT-006a

## Ronda 1 — 2026-11-18 (sin el usuario: pendiente de 3 decisiones humanas)

Verificación automatizada completa con la verificación cruzada de `daw-module-verifier` (un agente que
no escribió el código). El código no cambió desde la corrida del cierre de CODE (`bd98d78`;
`git diff bd98d78 HEAD -- src tests prisma` vacío), así que esa corrida es la evidencia de los E2E
(regla de FIX-001 en `AGENTS.md`). Unit (508/508) e integración (80/80) re-corridas en VERIFY.

| Field | Value |
|---|---|
| Module | src/server/groups.ts, src/server/invite-crypto.ts, src/lib/group-rules.ts, src/lib/group-messages.ts, src/lib/return-path.ts, src/app/group-actions.ts, src/app/grupos/*, src/app/invitacion/[token]/page.tsx, src/app/auth-actions.ts, src/proxy.ts, componentes de grupos, login y registro, migración 20261118055108_groups |
| Line coverage | 99.6% |
| Branch coverage | 97.16% |
| Function coverage | 99.39% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint --type-aware) — clean; `pnpm typecheck` — 0 errores; `pnpm format:check` — OK |

## Acceptance criteria
- ✅ AC-01 — `groups: crear "Los del Lolla" deja al usuario como único integrante y administrador`; `group-actions: crear un grupo redirige a su pantalla`; E2E `groups e2e: crear un grupo y ver su link con vencimiento`
- ✅ AC-02 — `groups: nombre vacío, de 41 puntos de código o con emojis que pasan de 40 es inválido`; `create-group-form: nombre inválido muestra el largo permitido y conserva lo escrito`
- ✅ AC-03 — `groups: el grupo nace con un link que vence a las 72 h`
- ✅ AC-04 — `invite-link: muestra el link, el vencimiento y Compartir`; `invite-link: Compartir usa la hoja del sistema y si no copia el link`; E2E
- ✅ AC-05 — `groups: generar un link nuevo invalida el anterior`; E2E `groups e2e: el link reemplazado deja de funcionar y el no administrador no lo regenera`
- ✅ AC-06 — `groups: un integrante común que genera un link es rechazado (NOT_ADMIN)`; `group-actions: un integrante común que regenera el link es rechazado`; `invite-link: el administrador ve Generar link nuevo con confirmación y el integrante común no`
- ✅ AC-07 — `groups: unirse con un link vigente suma al usuario`; `group-actions: Unirme suma al usuario y redirige al grupo`; E2E `groups e2e: unirse con sesión y volver a la invitación sin sesión`
- ✅ AC-08 — `proxy: sin cookie, /invitacion/<token> va a /login con next y /grupos sin next`; `auth-actions: entrar con next válido vuelve a la invitación`; `login-page: con sesión y next válido redirige a la invitación`; E2E (registro y login)
- ✅ AC-09 — `groups: un link de hace 72 h es inválido y no une; a las 71 h 59 min todavía vale`; `invitation-page: un link vencido o reemplazado muestra el mensaje de link inválido`
- ✅ AC-10 — `groups: con 20 integrantes el grupo está completo y unirse es rechazado`; `join-group-form: grupo completo y máximo de grupos muestran cuál límite se alcanzó`
- ✅ AC-11 — `groups: con 10 grupos unirse y crear son rechazados`; `create-group-form: con 10 grupos crear es rechazado y muestra el máximo`
- ✅ AC-12 — `groups: el integrante que abre su propio link, vigente o vencido, no se duplica`; `invitation-page: un integrante que abre su link va al grupo sin duplicarse`; E2E
- ⚠️ AC-13 — `groups: la lista trae los grupos con integrantes, iniciales y administrador, en orden`, `group-members: nombre, iniciales y marca de administrador`, `groups-page: lista todos los grupos del usuario`, E2E. Pendiente de decisión (H-1): la lista "Grupos" muestra iniciales y cantidad; nombre visible y "Administrador" se ven en la pantalla del grupo.
- ✅ AC-29 — `groups: un no integrante es rechazado y no recibe nombre ni integrantes`; `group-page: un grupo ajeno responde not found sin nombre ni integrantes`; E2E `groups e2e: un no integrante no ve el grupo` (la parte de "selecciones" se cumple porque no existe forma de leer la de otro: H-2)
- ✅ AC-31 — `invite-crypto: el generador por defecto usa 32 bytes de randomBytes y 1000 tokens no se repiten`

## Spec blocks
- ✅ Block 1 — 24/24 tests de la spec
- ✅ Block 2 — 15/15 tests de la spec
- ✅ Block 3 — 16/16 tests de la spec
- ✅ Block 4 — 5/5 tests de la spec

## Tests
- ✅ Sad-path tests: `groups: token mal formado es inválido sin consultar la base`, `groups: id de grupo mal formado es rechazado sin consultar la base`, `return-path: rechaza URLs externas, //, otras rutas, arrays y tokens inválidos`, `auth-actions: un next inválido es rechazado y el destino es /`, `group-actions: sin sesión crear es rechazado (no autorizado)`, `group-actions: Unirme sin sesión es rechazado (no autorizado)`
- ✅ Corrida del cierre de CODE: 857 tests, 854 pasan, 3 salteados con motivo (`docs/daw/reports/tests-FEAT-006a.md`).
- ✅ Mitigaciones R-01 a R-16 del modelo de amenazas presentes en el código.
- Evidencia TDD por bloque en `.daw-work/review-block-{1..4}.md` (fuera de git).

## Warnings
- W1 — W-VER-01: exports de tipos sin consumidores fuera de su archivo (mismo patrón que `selection.ts`).
- W2 — W-VER-02: `group-rules.ts` con 81,25 % de ramas (fallbacks `?? ""` inalcanzables).
- W3 — W-VER-03: los tests de concurrencia miran `pg_stat_activity` y dependen de que nadie más use la base mientras corren.
- W4 — W-VER-03: `cardName` del E2E tolera un espacio antes de la coma.
- W5 — `GROUP_FULL` y `USER_GROUP_LIMIT` en "Unirme" cubiertos por partes, sin un test de punta a punta.
- W6 — AC-09 en E2E solo por reemplazo; el vencimiento a las 72 h en integración (estrategia de la spec).
- W7 — el 404 de un grupo ajeno es el de Next, en inglés y fuera del tema (no filtra nada).
- W8 — el nombre accesible de cada tarjeta de "Grupos" lleva un espacio antes de la coma.
- W9 — el primer cambio de `schema.prisma` se escribió por shell (revisado en el diff).
- W10 — la cobertura no mide `src/app/**` ni `src/proxy.ts` (configuración previa).
- W11 — la evidencia TDD vive en `.daw-work/`, fuera de git.

## Pendiente para cerrar VERIFY
1. **H-1 — AC-13:** confirmar que la lista "Grupos" con iniciales y cantidad, y el nombre visible con
   "Administrador" en la pantalla de cada grupo, cumple el criterio; o pedir que la lista muestre
   también los nombres y la marca (vuelve a CODE, cambio en `src/app/grupos/page.tsx`).
2. **H-2 — AC-29:** dejar explícito que "las selecciones de sus integrantes" se prueba con un test real
   en FEAT-006c, cuando exista una forma de verlas.
3. **H-3 — decisiones tomadas en `minimal`:** la clave del token derivada de `BETTER_AUTH_SECRET`
   (rotarlo invalida los links), el integrante con link vencido que va al grupo, y la confirmación de
   "Generar link nuevo".

Result: PENDING — ronda 1 sin FAIL automatizado; el gate `verify` no se reclama hasta las 3
decisiones de arriba.

## Ronda 2 — 2026-11-18 (con las decisiones del usuario, tras la vuelta 3 de la spec)

Decisiones del usuario sobre los pendientes de la ronda 1:
1. **H-1 (AC-13):** cumple con la lista "Grupos" actual.
2. **H-2 (AC-29):** la parte de las selecciones se prueba en FEAT-006c.
3. **H-3:** confirmadas la clave del token derivada de `BETTER_AUTH_SECRET` y que un integrante con un
   link vencido de su grupo vaya al grupo. **No** confirmada la confirmación de "Generar link nuevo":
   volvió a CODE y a PLAN (vuelta 3 de la spec, `b80e604`: sin confirmación, R-14 aceptado, y cada
   test de la spec con su id `test-…` para que F-VER-06 los lea).

El cambio (`086f3c5`) quita el `AlertDialog` de `src/components/invite-link.tsx` y la constante
`REGENERATE_CONFIRM`. Lo revisaron `daw-module-verifier` (PASS: spec, AC-05, AC-06, el test exigido y
la evidencia TDD: 3 de 10 tests de `invite-link.test.tsx` en rojo antes del cambio, en
`expect(screen.queryByRole("alertdialog")).toBeNull()`) y `daw-arch-auditor` (PASS, 3 warnings
menores). Re-cierre de CODE con la suite completa en verde (`ad9f268`,
`docs/daw/reports/tests-FEAT-006a.md`).

| Field | Value |
|---|---|
| Module | igual que la ronda 1 (cambia `src/components/invite-link.tsx` y `src/lib/group-messages.ts`) |
| Line coverage | 99.6% |
| Branch coverage | 97.13% |
| Function coverage | 99.39% |
| Coverage floor | 80% líneas, 70% ramas, 80% funciones (AGENTS.md, "Testing") |
| Lint | `pnpm lint` (oxlint --type-aware) — clean; `pnpm typecheck` — 0 errores; `pnpm format:check` — OK |

### Acceptance criteria
- ✅ AC-01 — igual que la ronda 1
- ✅ AC-02 — igual que la ronda 1
- ✅ AC-03 — igual que la ronda 1
- ✅ AC-04 — igual que la ronda 1
- ✅ AC-05 — igual que la ronda 1; el E2E ahora genera el link nuevo sin pasar por un diálogo
- ✅ AC-06 — igual que la ronda 1, con el unit renombrado `invite-link: el administrador genera un link nuevo sin confirmación y el integrante común no lo ve`
- ✅ AC-07 — igual que la ronda 1
- ✅ AC-08 — igual que la ronda 1
- ✅ AC-09 — igual que la ronda 1
- ✅ AC-10 — igual que la ronda 1
- ✅ AC-11 — igual que la ronda 1
- ✅ AC-12 — igual que la ronda 1
- ✅ AC-13 — mismos tests que la ronda 1; el usuario confirmó (H-1) que la lista "Grupos" con iniciales y cantidad, más el nombre visible y "Administrador" en la pantalla del grupo, cumple el criterio
- ✅ AC-29 — igual que la ronda 1; por decisión del usuario (H-2), la parte de "las selecciones de sus integrantes" se prueba con un test real en FEAT-006c
- ✅ AC-31 — igual que la ronda 1

### Spec blocks
- ✅ Block 1 — 24/24 tests de la spec
- ✅ Block 2 — 15/15 tests de la spec (con el test de "Generar link nuevo" sin confirmación)
- ✅ Block 3 — 16/16 tests de la spec
- ✅ Block 4 — 5/5 tests de la spec

### Tests de la spec (F-VER-06), en verde en la corrida del re-cierre de CODE
- ✅ `test-groups-crear-los-del-lolla-deja-al-usuario-como-unico`
- ✅ `test-groups-nombre-vacio-de-41-puntos-de-codigo-o-con-emojis`
- ✅ `test-groups-el-grupo-nace-con-un-link-que-vence-a-las-72-h`
- ✅ `test-groups-generar-un-link-nuevo-invalida-el-anterior`
- ✅ `test-groups-un-integrante-comun-que-genera-un-link-es`
- ✅ `test-groups-unirse-con-un-link-vigente-suma-al-usuario`
- ✅ `test-groups-un-link-de-hace-72-h-es-invalido-y-no-une-a-las`
- ✅ `test-groups-con-20-integrantes-el-grupo-esta-completo-y`
- ✅ `test-groups-con-10-grupos-unirse-y-crear-son-rechazados`
- ✅ `test-groups-el-integrante-que-abre-su-propio-link-vigente-o`
- ✅ `test-groups-la-lista-trae-los-grupos-con-integrantes`
- ✅ `test-groups-un-no-integrante-es-rechazado-y-no-recibe-nombre`
- ✅ `test-invite-crypto-generador-32-bytes-y-1000-tokens-distintos`
- ✅ `test-groups-la-fila-de-la-invitacion-no-contiene-el-token-en`
- ✅ `test-groups-con-el-grupo-bloqueado-la-union-numero-21-espera`
- ✅ `test-groups-con-el-usuario-bloqueado-unirse-a-dos-grupos-en`
- ✅ `test-groups-unirse-con-el-link-viejo-mientras-se-regenera-es`
- ✅ `test-groups-token-mal-formado-es-invalido-sin-consultar-la`
- ✅ `test-groups-id-de-grupo-mal-formado-es-rechazado-sin`
- ✅ `test-groups-un-ciphertext-que-no-abre-muestra-el-grupo-sin`
- ✅ `test-groups-con-la-base-caida-devuelve-service-unavailable-y`
- ✅ `test-groups-un-segundo-administrador-en-el-mismo-grupo-es`
- ✅ `test-group-rules-iniciales-de-una-dos-y-mas-palabras-con`
- ✅ `test-group-messages-vencimiento-en-hora-de-argentina-y-texto`
- ✅ `test-create-group-form-nombre-invalido-muestra-el-largo`
- ✅ `test-create-group-form-con-10-grupos-crear-es-rechazado-y`
- ✅ `test-group-actions-crear-un-grupo-redirige-a-su-pantalla`
- ✅ `test-group-actions-sin-sesion-crear-es-rechazado-no`
- ✅ `test-group-actions-crear-con-la-base-caida-devuelve-el-error`
- ✅ `test-group-actions-un-integrante-comun-que-regenera-el-link`
- ✅ `test-invite-link-muestra-el-link-el-vencimiento-y-compartir`
- ✅ `test-invite-link-compartir-usa-la-hoja-del-sistema-y-si-no`
- ✅ `test-invite-link-si-copiar-da-error-el-link-queda-visible`
- ✅ `test-invite-link-admin-genera-link-sin-confirmacion`
- ✅ `test-group-members-nombre-iniciales-y-marca-de-administrador`
- ✅ `test-groups-page-lista-todos-los-grupos-del-usuario`
- ✅ `test-group-page-un-grupo-ajeno-responde-not-found-sin-nombre`
- ✅ `test-group-page-sin-sesion-redirige-a-login`
- ✅ `test-app-menu-la-entrada-grupos-lleva-a-grupos`
- ✅ `test-invitation-page-con-sesion-y-link-vigente-muestra-el`
- ✅ `test-group-actions-unirme-suma-al-usuario-y-redirige-al`
- ✅ `test-invitation-page-sin-sesion-redirige-a-login-con-next-de`
- ✅ `test-auth-actions-entrar-con-next-valido-vuelve-a-la`
- ✅ `test-login-form-lleva-next-oculto-y-el-link-a-registrarse-lo`
- ✅ `test-login-page-con-sesion-y-next-valido-redirige-a-la`
- ✅ `test-invitation-page-un-link-vencido-o-reemplazado-muestra`
- ✅ `test-join-group-form-grupo-completo-y-maximo-de-grupos`
- ✅ `test-invitation-page-un-integrante-que-abre-su-link-va-al`
- ✅ `test-return-path-rechaza-urls-externas-otras-rutas-arrays-y`
- ✅ `test-auth-actions-un-next-invalido-es-rechazado-y-el-destino`
- ✅ `test-login-page-un-next-invalido-no-llega-al-formulario`
- ✅ `test-proxy-sin-cookie-invitacion-token-va-a-login-con-next-y`
- ✅ `test-proxy-un-token-mal-formado-no-se-lleva-en-next`
- ✅ `test-group-actions-unirme-sin-sesion-es-rechazado-no`
- ✅ `test-group-actions-unirme-con-la-base-caida-devuelve-el`
- ✅ `test-groups-e2e-crear-un-grupo-y-ver-su-link-con-vencimiento`
- ✅ `test-groups-e2e-unirse-con-sesion-y-volver-a-la-invitacion`
- ✅ `test-groups-e2e-el-link-reemplazado-deja-de-funcionar-y-el`
- ✅ `test-groups-e2e-abrir-el-link-propio-no-duplica-y-la-lista`
- ✅ `test-groups-e2e-un-no-integrante-no-ve-el-grupo`

### Tests
- ✅ Sad-path tests: los 6 de la ronda 1 (token mal formado, id de grupo mal formado, `return-path`, `next` inválido y las dos acciones sin sesión)
- ✅ Corrida del re-cierre de CODE: 857 tests, 854 pasan, 3 salteados con motivo

### Warnings
- W1 a W11 de la ronda 1 siguen igual.
- W12 — `tests/e2e/groups.spec.ts:152`: afirmar que no hay `alertdialog` justo después del toque es débil; el unit `invite-link.test.tsx:128` lo cubre.
- W13 — `tests/unit/components/invite-link.test.tsx:219-232` reusa la referencia al botón tomada antes del envío.
- W14 — `docs/daw/specs/decisions-FEAT-006a.md` conserva las decisiones de PLAN con el diálogo como registro histórico; la sección "Vuelta 3" las reemplaza.

Result: PASSED
