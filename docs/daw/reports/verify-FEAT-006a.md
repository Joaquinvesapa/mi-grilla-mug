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
