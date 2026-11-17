# Spec FEAT-003b: Grilla y mi selección sin conexión

| Field | Value |
|-------|-------|
| Ticket | FEAT-003b |
| PRD | docs/daw/prd/prd-FEAT-003b.md |
| Tier | FEATURE |
| Date | 2026-11-17 |
| Spec loops | 0 |
| Loops since last human decision | 0 |

## Summary
Los datos sin conexión viven en el dispositivo (`localStorage`), no en las cachés del service worker
(ADR-004; R-17 de FEAT-001 sigue en pie). Cada vez que `/` se muestra con conexión, la pantalla
guarda una **copia del dispositivo** (grilla, id y nombre del usuario, selección confirmada). Si
"Guardar" no recibe respuesta, la selección queda como **selección pendiente de sincronizar** bajo
la clave de su dueño, con un aviso; se sincroniza sola al abrir la app con conexión y al volver la
señal, a través de `saveSelectionAction(showIds, expectedUserId)`, que rechaza con `USER_MISMATCH` si
la sesión es de otra cuenta. Sin señal, el service worker sigue respondiendo con el `/~offline`
precacheado, que ahora arma la grilla desde la copia del dispositivo cuando la URL que falló es `/`,
y si no hay copia muestra la pantalla "Sin conexión" de siempre. Son 4 bloques: almacenamiento del
dispositivo; guardar y sincronizar en la pantalla; la grilla sin conexión; E2E. Incorpora R-01 a
R-08 de `docs/daw/security/threat-FEAT-003b.md`, los 10 gaps del Impact Check y los 18 hallazgos de
la auditoría de arquitectura de PLAN.

### Decisiones aplicadas
- **Del usuario (2026-11-17, PLAN):** la copia del dispositivo se conserva hasta cerrar sesión o
  hasta que entre otra cuenta; no vence. El remanente (sesión vencida sola y sin señal) es el riesgo
  aceptado R-03 del threat model.
- **Técnica — ADR-004:** `localStorage` y la pantalla `/~offline` precacheada, no la caché del
  service worker ni Background Sync (no existe en iOS). `src/app/sw.ts`,
  `src/app/serwist/[path]/route.ts` y `src/components/serwist-provider.tsx` no cambian.
- **Técnica — dónde vive el I/O de cliente:** la validación pura en `src/lib/offline-selection.ts`;
  el acceso a `localStorage` en `src/components/device-store.ts` y el estado de conexión en
  `src/components/use-online-status.ts`. AGENTS.md (estructura de carpetas) se actualiza para decir
  que `src/components/` admite helpers de cliente con acceso al almacenamiento del navegador.
- **Técnica — cuándo un guardado es "sin conexión":** si `navigator.onLine` es `false`, o si la
  llamada a `saveAction` lanza (no hubo respuesta del servidor). En ambos casos la selección se
  guarda como pendiente: guardarla de más nunca pierde datos y la sincronización la lleva a la
  cuenta. Una respuesta del servidor con `ok: false` no es "sin conexión": muestra su mensaje como en
  FEAT-003a.
- **Técnica — guardar con conexión borra la pendiente.** Un "Guardar" o una sincronización con
  `{ ok: true }` borran la pendiente de ese usuario, para que una vieja no pise una nueva (R-05).
  Una sola sincronización corre a la vez (guarda en un `ref`) y "Guardar" está deshabilitado
  mientras corre.
- **Técnica — qué se muestra al abrir con conexión y con pendiente.** Si al montar hay una
  pendiente del `userId`, la guardada y el borrador arrancan en la pendiente (FR-01: es el último
  guardado del usuario), se muestra el aviso y se sincroniza. La copia del dispositivo guarda solo la
  selección confirmada por el servidor; la pendiente va aparte.
- **Técnica — `INVALID_SELECTION` al sincronizar** descarta la pendiente (nunca podría entrar) y
  muestra el mensaje del catálogo; las demás fallas la conservan (AC-24, R-07).
- **Técnica — `/~offline` con grilla solo para `/`.** El service worker responde cualquier documento
  con `/~offline`, también `/login` y `/register`; la grilla solo se pinta si `location.pathname` es
  `/` (R-08). En la pantalla con grilla no hay recarga automática al volver la señal (perdería el
  borrador): se sincroniza ahí mismo. La tarjeta "Sin conexión" sigue recargando sola.
- **Técnica — sin destello ni desajuste de hidratación.** `OfflineApp` renderiza en el servidor y en
  el primer render del cliente una pantalla vacía (`aria-busy`), y decide en un efecto qué mostrar.
- **Técnica — las Server Actions en `/~offline`.** La página precacheada recibe
  `saveSelectionAction` y `logoutAction` como props; sus ids son los del build, y como cada build
  reemplaza el precache (`skipWaiting`, R-05 de FEAT-001) nunca queda una página con ids de otro
  build.
- **Técnica — el día inicial sin conexión** se calcula en el cliente con `festivalDayFor(new Date(),
  days)` de `src/lib/festival-time.ts`, con el reloj real (el reloj simulado sigue solo en `/demo`).

### Catálogo de códigos (`src/app/selection-actions.ts`) y mensajes (`src/lib/selection-messages.ts`)
| Código | Origen | Mensaje |
|---|---|---|
| `USER_MISMATCH` | `saveSelectionAction`: la sesión no es de `expectedUserId` | "Entraste con otra cuenta. Recargá la grilla para seguir." |
| `STORAGE_UNAVAILABLE` | `device-store.ts`: no se pudo escribir en el dispositivo | "No pudimos guardar: no hay conexión y este celular no dejó guardar los cambios." |

Los demás códigos (`INVALID_SELECTION`, `UNAUTHENTICATED`, `SERVICE_UNAVAILABLE`, `NETWORK_ERROR`,
`SCHEDULE_UNAVAILABLE`) quedan como en FEAT-003a. Textos nuevos del aviso: título "Guardado solo en
este celular" y cuerpo "Tus cambios se suben solos cuando vuelva la conexión. Mientras tanto,
descargá la grilla como fondo de pantalla para tenerla a mano." (FR-04; el fondo de pantalla es el
PRD 04: mientras no exista, el aviso solo informa).

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 1 (copia y pendiente), Block 2 (escritura de la copia; arranque con la pendiente), Block 3 (`OfflineApp`), Block 4 (E2E sin conexión) |
| FR-02 | Block 1 (`writePending`), Block 2 (`save()` sin respuesta → pendiente), Block 4 (E2E: cerrar y volver a abrir sin conexión) |
| FR-03 | Block 2 (sincronización al montar y con `online`), Block 3 (sincroniza también en `/~offline`), Block 4 (E2E al volver la señal) |
| FR-04 | Block 2 (`offline-pending-notice.tsx`), Block 4 (E2E del aviso) |
| FR-05 | Block 2 (la sincronización reemplaza la selección entera), Block 4 (integración y E2E con otro dispositivo) |
| FR-06 | Block 1 (clave por `userId`), Block 2 (`USER_MISMATCH`; copia borrada al cerrar sesión y en `/login`/`/register`), Block 4 (E2E con dos cuentas) |
| NFR-01 | Strategy: la sincronización es el mismo `saveSelection` de FEAT-003a, una sola llamada; `test-selection-save-p95` (integración, 20 guardados, p95 ≤ 1000 ms) sigue cubriéndolo y Block 4 mide la llamada en el E2E de sincronización |
| NFR-02 | Block 2 (el aviso hace wrap, sin anchos fijos), Block 4 (E2E en 360 y 430 px: sin scroll horizontal con el aviso visible) |

## Dependencies between blocks
Block 2 depende de 1 (`device-store` y `offline-selection`). Block 3 depende de 2 (`ScheduleScreen`
con `userId`, `mode` y la sincronización). Block 4 depende de 3. Orden: 1 → 2 → 3 → 4.

## Mobile guides applied (AGENTS.md → Code conventions)
Para el aviso de pendiente, el menú y la grilla sin conexión:
- `mobile-native` fix 3: la pantalla sin conexión con grilla usa la misma `.app-fixed-screen` de `/`
  (`100dvh`); el aviso es una fila más del flex, entre la barra y los días, así que la grilla sigue
  ocupando el resto y scrolleando sola.
- `mobile-native` fixes 7 y 8: el aviso va debajo de la barra superior, que ya respeta
  `safe-area-inset-top`; sin selección de texto en botones.
- `mobile-native` "Baseline" y "Never Ship": "Cerrar sesión" deshabilitado sin conexión mantiene
  44 × 44; el aviso no agrega controles tocables; el test de 360 y 430 px de `/~offline`
  (`tests/e2e/pwa.spec.ts`, NFR-01 de FEAT-001) sigue valiendo.
- `gestures`: no hay gestos nuevos; el menú sigue siendo el drawer de Vaul.
- `design-taste-frontend`: el aviso es una franja plana sobre `--card` con el ícono `CloudOff` de
  lucide en foam (`--primary`); gold sigue reservado para la marca de choque e iris no se usa; copy
  propio en español, sin textos de plantilla.

## Block 1 — Copia y pendiente en el dispositivo

**Files**
- `src/lib/offline-selection.ts` (new) — puro: tipos `DeviceSnapshot` (`version: 1`, `userId`,
  `userName`, `schedule: Schedule`, `savedShowIds: string[]`) y `PendingSelection` (`version: 1`,
  `userId`, `showIds: string[]`, `savedAt` ISO); claves `SNAPSHOT_KEY = "mi-grilla:snapshot"` y
  `pendingKey(userId) = "mi-grilla:pending:<userId>"`; `parseSnapshot(raw)` y
  `parsePending(raw, userId)`, que devuelven el objeto o `null`.
- `src/components/device-store.ts` (new) — sin `"use client"` propio (lo importan componentes
  cliente): `readSnapshot()`, `writeSnapshot(snapshot)`, `clearSnapshot()`, `readPending(userId)`,
  `writePending(pending)`, `clearPending(userId)`. Cada escritura devuelve `{ ok: true }` o
  `{ ok: false, code: "STORAGE_UNAVAILABLE" }`; cada lectura devuelve el objeto o `null`.
- `tests/unit/setup.ts` (modified) — `afterEach(() => localStorage.clear())`, para que una pendiente
  escrita en un test no aparezca en el siguiente.
- `tests/unit/lib/offline-selection.test.ts`, `tests/unit/components/device-store.test.ts` (new).

**Logic**
Implementa la base de FR-01, FR-02 y FR-06: dónde y cómo se guardan la copia y la pendiente. La
pendiente se guarda bajo la clave de su dueño, así que leer la de otro usuario exige pedir su clave.
`parsePending` además exige que el `userId` guardado coincida con el pedido.

**Data model**
- Sin cambios en la base. Dos entidades en `localStorage` del origen de la app, ambas JSON:
  - `DeviceSnapshot`, clave `mi-grilla:snapshot` (unique: una sola, la del último usuario que vio
    `/` con conexión): `version` (NOT NULL, exactamente 1), `userId` (NOT NULL, 1–64), `userName`
    (NOT NULL, 1–100), `schedule` (NOT NULL, `days`/`stages`/`shows` no vacíos), `savedShowIds`
    (NOT NULL, default `[]`, ids unique y presentes en `schedule.shows`).
  - `PendingSelection`, clave `mi-grilla:pending:<userId>` (unique por `userId`): `version` (NOT
    NULL, exactamente 1), `userId` (NOT NULL, igual al de la clave), `showIds` (NOT NULL, ids
    unique), `savedAt` (NOT NULL, ISO 8601).
- Rollback / cambio de formato: un formato futuro usa `version: 2`; `parseSnapshot`/`parsePending`
  descartan cualquier versión distinta, así que revertir el ticket o cambiar el formato deja las
  claves viejas sin efecto (se pisan en la próxima visita con conexión), sin migración.

**Input validation**
- Todo lo leído de `localStorage` es no confiable (R-02): JSON válido; `version` exactamente `1`;
  `userId` string de 1 a 64 caracteres; `userName` string de 1 a 100; `savedShowIds`/`showIds`
  arreglo de strings sin repetidos, cada uno con el patrón `^[a-z0-9-]+$` y hasta 64 caracteres (los
  mismos límites que `src/server/selection.ts`), y todos presentes en `schedule.shows` en la copia;
  `schedule` con `days`, `stages` y `shows` como arreglos no vacíos; `savedAt` fecha ISO válida.

**Error handling**
- JSON malformado, versión distinta o campo inválido en `localStorage` — `parseSnapshot` /
  `parsePending` devuelven `null` y la app se comporta como si no hubiera copia; nunca lanza.
- `localStorage` no disponible o lleno (modo privado, cuota) — el `try/catch` de cada acceso devuelve
  `{ ok: false, code: "STORAGE_UNAVAILABLE" }` en las escrituras y `null` en las lecturas; el error
  no se propaga ni se silencia: el código llega a la pantalla (Block 2).

**Required tests**
- [ ] `test-offline-snapshot-roundtrip` — `offline-selection.test.ts`: una copia válida serializada
      vuelve igual con `parseSnapshot` — validates AC-20.
- [ ] `test-offline-snapshot-invalid` — `offline-selection.test.ts`: JSON inválido, `version: 2`, id
      con mayúsculas, id repetido o id fuera de la grilla dan `null` (inválido, rechazado).
- [ ] `test-offline-pending-other-user-rejected` — `offline-selection.test.ts`: una pendiente
      guardada para `user-a` leída como `user-b` da `null` (rechazado) — validates AC-27.
- [ ] `test-device-store-pending-by-user` — `device-store.test.ts`: `writePending` de A y B quedan
      en claves distintas; `clearPending(A)` no toca la de B — validates AC-27.
- [ ] `test-device-store-persists` — `device-store.test.ts`: lo escrito con `writePending` se lee
      igual con `readPending` en una lectura nueva — validates AC-22.
- [ ] `test-device-store-unavailable-error` — `device-store.test.ts`: con `setItem` que lanza
      (`QuotaExceededError`), `writePending` devuelve `STORAGE_UNAVAILABLE` (error) y `readPending`
      con `getItem` que lanza devuelve `null`.

**Completion criterion**
Los tests de arriba pasan y `src/lib/offline-selection.ts` no importa nada con I/O.

## Block 2 — Guardar sin conexión y sincronizar

**Files**
- `src/app/selection-actions.ts` (modified) — `saveSelectionAction(showIds: unknown,
  expectedUserId: unknown)`; `SaveSelectionActionResult` suma `USER_MISMATCH`.
- `src/lib/selection-messages.ts` (modified) — códigos `USER_MISMATCH` y `STORAGE_UNAVAILABLE`, y
  los textos del aviso (`OFFLINE_PENDING_TITLE`, `OFFLINE_PENDING_BODY`).
- `src/components/use-online-status.ts` (new) — `useOnlineStatus()` con `useSyncExternalStore` sobre
  `online`/`offline` y `navigator.onLine`; en el servidor, `true`.
- `src/components/offline-pending-notice.tsx` (new) — `role="status"` con `CloudOff`, el título y el
  cuerpo del aviso.
- `src/components/schedule-screen.tsx` (modified) — props nuevas `userId: string` y
  `mode: "online" | "offline"`; `SaveSelection` pasa a `(showIds, expectedUserId) => Promise<…>`;
  copia del dispositivo, pendiente, sincronización y aviso (Logic).
- `src/components/app-menu.tsx` (modified) — los dos `<form action={logoutAction}>` (el directo y el
  de "Salir sin guardar") llaman a `clearSnapshot()` en `onSubmit`; sin conexión
  (`useOnlineStatus()` falso) "Cerrar sesión" queda deshabilitado con el texto "Necesitás conexión
  para cerrar sesión." debajo. `AppBar`/`AppMenu` no suman props.
- `src/components/forget-device-copy.tsx` (new) — `"use client"`, renderiza `null` y llama a
  `clearSnapshot()` al montar (las pendientes no se tocan).
- `src/app/login/page.tsx`, `src/app/register/page.tsx` (modified) — renderizan
  `<ForgetDeviceCopy />`.
- `src/app/page.tsx` (modified) — pasa `userId={user.id}` y `mode="online"` a `ScheduleScreen`; la
  rama de error no cambia (AppBar no suma props).
- `AGENTS.md` (modified) — en "Folder structure", que `src/components/` admite helpers de cliente
  con acceso al almacenamiento del navegador (ADR-004).
- `tests/unit/server/selection.test.ts` (modified) — las 4 llamadas a `saveSelectionAction` pasan el
  segundo argumento; tests nuevos de `USER_MISMATCH`.
- `tests/unit/components/schedule-screen.test.tsx` (modified) — `renderScreen` pasa `userId` y
  `mode`; la expectativa de la llamada pasa a dos argumentos; `test-screen-save-network-error` se
  reescribe (ahora guarda como pendiente); tests nuevos de abajo.
- `tests/unit/components/app-menu.test.tsx`, `tests/unit/lib/selection-messages.test.ts`,
  `tests/unit/app/home-page.test.tsx` (modified); `tests/unit/components/offline-pending-notice.test.tsx`,
  `tests/unit/components/forget-device-copy.test.tsx`,
  `tests/unit/components/use-online-status.test.ts` (new).
- `tests/integration/selection.test.ts` (modified) — `test-selection-sync-overwrites-other-device`.

**Logic**
Implementa FR-02, FR-03, FR-04, FR-05 y FR-06, y la parte de FR-01 con conexión.
- `saveSelectionAction`: primero la sesión (`SERVICE_UNAVAILABLE` / `UNAUTHENTICATED` como antes);
  después, si `expectedUserId` no es un string igual a `user.id`, `{ ok: false, code:
  "USER_MISMATCH" }` sin llamar a `saveSelection`; si coincide, `saveSelection(user.id, showIds)`.
- `ScheduleScreen` al montar: con `mode="online"` escribe la copia (`userId`, `userName`,
  `schedule`, `savedShowIds` confirmados). Si hay pendiente del `userId`, la guardada y el borrador
  pasan a ser la pendiente, se muestra el aviso y arranca la sincronización. Nunca lee la pendiente
  de otro `userId`.
- `save()`: si `navigator.onLine` es falso, no llama a la acción. Si llama y responde `ok: true`,
  borra la pendiente del usuario, actualiza la copia y la guardada. Si responde `ok: false`, muestra
  el mensaje (como FEAT-003a). Si lanza, o no llamó por estar sin conexión, `writePending`: con
  `ok: true` la guardada pasa a ser el borrador y se muestra el aviso (no hay error); con
  `STORAGE_UNAVAILABLE`, su mensaje en `role="alert"` y el borrador queda como estaba.
- `sync()`: al montar y en cada evento `online`; corre si hay pendiente del `userId`, hay conexión y
  no hay otra en curso. "Guardar" se deshabilita mientras corre. `ok: true` → borra la pendiente,
  actualiza la copia, quita el aviso (AC-23). `INVALID_SELECTION` → borra la pendiente, vuelve a la
  selección confirmada y muestra el mensaje. Cualquier otro resultado o una excepción → la conserva
  para la próxima (AC-24); con `USER_MISMATCH` no se muestra ni se sincroniza en esa cuenta (AC-27).
- Gana el último guardado (FR-05): la sincronización reemplaza la selección entera, como cualquier
  guardado (R-10 de FEAT-003a).

**API contract**
- Method + path: Server Action `saveSelectionAction` (POST de Next a la ruta que la invoca, `/` o
  `/~offline`, con el header `Next-Action`).
- Request: `showIds: string[]`, `expectedUserId: string`.
- Response: `{ ok: true }` o `{ ok: false, code }`.
- Error codes: `INVALID_SELECTION`, `UNAUTHENTICATED`, `SERVICE_UNAVAILABLE`, `USER_MISMATCH`.
- Auth: sesión de Better Auth (cookie `httpOnly`) verificada en el servidor; `expectedUserId` es una
  guarda extra, nunca la identidad. Origen chequeado por Next (R-03 de FEAT-003a).

**Data model**
- Reuses `selected_shows` from FEAT-003a through `src/server/selection.ts` — no schema change;
  constraints as declared there: PK `(user_id, show_id)`, FK a `users` on delete cascade, FK a
  `shows` on delete restrict. En el dispositivo, las claves de Block 1.

**Input validation**
- `expectedUserId`: string de 1 a 64 caracteres; cualquier otro tipo o largo es `USER_MISMATCH`.
- `showIds`: validado por `src/server/selection.ts` como en FEAT-003a (arreglo de ids existentes, sin
  repetidos, hasta 64 caracteres cada uno).

**Error handling**
- La sesión no es de `expectedUserId` (o falta) — `USER_MISMATCH`; nada se guarda; la pendiente se
  conserva para su dueño.
- La sincronización falla (`SERVICE_UNAVAILABLE`, `UNAUTHENTICATED` o excepción de red) — la
  pendiente se conserva y se reintenta en el próximo montaje o evento `online`.
- La sincronización recibe `INVALID_SELECTION` — se descarta la pendiente y se muestra su mensaje.
- No se pudo escribir la pendiente (`STORAGE_UNAVAILABLE`) — mensaje en `role="alert"`, borrador
  intacto, sin aviso de "guardado en el celular".
- No se pudo escribir la copia al montar — se ignora con el resultado tipado (la pantalla con
  conexión no depende de ella); la próxima visita reintenta.

**Required tests**
- [ ] `test-action-user-mismatch-rejected` — `tests/unit/server/selection.test.ts`: con sesión de A y
      `expectedUserId` de B devuelve `USER_MISMATCH` (rechazado) y no llama a `saveSelection` —
      validates AC-27.
- [ ] `test-action-expected-user-invalid` — `tests/unit/server/selection.test.ts`: `expectedUserId`
      número, vacío o de 65 caracteres da `USER_MISMATCH` (inválido).
- [ ] `test-action-unauthorized-before-mismatch` — sin sesión devuelve `UNAUTHENTICATED` (no
      autorizado) aunque falte `expectedUserId`.
- [ ] `test-screen-save-offline-pending` — `schedule-screen.test.tsx` (reescribe
      `test-screen-save-network-error`): si la acción lanza (error de red), la selección queda en
      `mi-grilla:pending:<userId>`, el aviso aparece y no hay `role="alert"` — validates AC-22,
      AC-25.
- [ ] `test-screen-save-offline-skips-call` — con `navigator.onLine` falso no se llama a la acción y
      queda la pendiente — validates AC-22.
- [ ] `test-screen-save-storage-error` — con `setItem` que lanza, muestra el mensaje de
      `STORAGE_UNAVAILABLE` (error) y conserva el borrador.
- [ ] `test-screen-sync-on-mount` — con una pendiente del usuario al montar, arranca con esa
      selección, llama a la acción con `(ids, userId)` y con `ok: true` borra la pendiente y quita el
      aviso — validates AC-20, AC-23.
- [ ] `test-screen-sync-on-online` — con la pendiente y sin conexión, el evento `online` dispara la
      sincronización una sola vez aunque llegue dos veces seguidas — validates AC-23.
- [ ] `test-screen-sync-error-retry` — con `SERVICE_UNAVAILABLE` (error) o una excepción la pendiente
      queda y el siguiente `online` reintenta — validates AC-24.
- [ ] `test-screen-sync-invalid-discarded` — con `INVALID_SELECTION` (inválido) la pendiente se borra
      y se muestra su mensaje.
- [ ] `test-screen-sync-mismatch-kept` — con `USER_MISMATCH` (rechazado) la pendiente queda y no se
      muestra como selección de esa cuenta — validates AC-27.
- [ ] `test-screen-other-user-pending-ignored` — con una pendiente de `user-a` y la pantalla de
      `user-b`, no hay aviso, no se llama a la acción y la pendiente de A sigue — validates AC-27.
- [ ] `test-screen-online-save-clears-pending` — un "Guardar" con `ok: true` borra una pendiente
      vieja del usuario.
- [ ] `test-screen-writes-snapshot` — con `mode="online"` escribe la copia con la selección
      confirmada — validates AC-20.
- [ ] `test-notice-content` — `offline-pending-notice.test.tsx`: título, cuerpo con la sugerencia del
      fondo de pantalla y `role="status"` — validates AC-25.
- [ ] `test-app-menu-logout-clears-copy` — `app-menu.test.tsx`: los dos caminos de "Cerrar sesión"
      borran la copia y no las pendientes — validates AC-27.
- [ ] `test-app-menu-offline-disabled` — sin conexión "Cerrar sesión" está deshabilitado con su
      texto.
- [ ] `test-forget-device-copy` — `forget-device-copy.test.tsx`: al montar borra la copia y conserva
      las pendientes.
- [ ] `test-online-status` — `use-online-status.test.ts`: refleja `offline` y `online`.
- [ ] `test-messages-new-codes` — `selection-messages.test.ts`: textos de `USER_MISMATCH` y
      `STORAGE_UNAVAILABLE`.
- [ ] `test-home-page-user-id` — `home-page.test.tsx`: `page.tsx` pasa `userId` y `mode="online"`.
- [ ] `test-selection-sync-overwrites-other-device` — integración: con la cuenta guardada en `[x]`
      desde otro dispositivo, guardar la pendiente `[y]` deja exactamente `[y]` — validates AC-26.

**Completion criterion**
Los tests de arriba pasan, `pnpm typecheck` y `pnpm lint` pasan, y con conexión `/` sigue guardando
como en FEAT-003a.

## Block 3 — La grilla sin conexión

**Files**
- `src/components/offline-card.tsx` (new) — la tarjeta "Sin conexión" que hoy está en
  `src/app/~offline/page.tsx` (ícono, título, texto y `OfflineRetry`), sin cambios visibles.
- `src/components/offline-app.tsx` (new) — `"use client"`: decide entre la grilla y la tarjeta.
- `src/app/~offline/page.tsx` (modified) — renderiza `<OfflineApp saveAction={saveSelectionAction}
  logoutAction={logoutAction} />`; corrige el comentario ("the only client code is the retry").
- `tests/unit/components/offline-app.test.tsx` (new).

**Logic**
Implementa FR-01 sin conexión (AC-20, AC-21) y FR-03 desde esa pantalla. Primer render (servidor y
cliente): una `main.app-fixed-screen` vacía con `aria-busy="true"`. En un efecto: si
`location.pathname` no es `/` → la tarjeta. Si es `/`: `readSnapshot()`; sin copia válida → la
tarjeta (AC-21); con copia → `ScheduleScreen` con `mode="offline"`, `userId`/`userName`/`schedule`
de la copia, `savedShowIds` = la pendiente de ese usuario si existe o la confirmada de la copia, e
`initialDayId = festivalDayFor(new Date(), schedule.days)`. La pantalla con grilla no recarga al
volver la señal: `ScheduleScreen` sincroniza ahí (Block 2). La tarjeta sigue recargando sola.

**Data model**
- Reuses `DeviceSnapshot` and `PendingSelection` from Block 1 — no schema change; constraints as
  declared there: NOT NULL `version` (exactamente 1), NOT NULL `userId`, unique key per `userId`
  for the pending selection, unique show ids with the pattern of `src/server/selection.ts`.

**Input validation**
- La copia se lee solo a través de `readSnapshot()`/`parseSnapshot` (Block 1); nada sin validar
  llega a la pantalla.

**Error handling**
- Copia ausente, inválida o ilegible — la tarjeta "Sin conexión" con "Reintentar" (AC-21).
- URL distinta de `/` (por ejemplo `/login` sin señal) — la tarjeta, aunque haya copia (R-08).

**Required tests**
- [ ] `test-offline-app-grid` — `offline-app.test.tsx`: con copia válida y `pathname` `/`, se ve la
      grilla con la selección confirmada marcada — validates AC-20.
- [ ] `test-offline-app-pending-first` — con copia y pendiente del mismo usuario, se ve la pendiente
      y el aviso — validates AC-22, AC-25.
- [ ] `test-offline-app-missing-copy` — sin copia (faltante) se ve "Sin conexión" — validates AC-21.
- [ ] `test-offline-app-invalid-copy` — con una copia inválida se ve "Sin conexión" — validates
      AC-21.
- [ ] `test-offline-app-other-path-rejected` — con copia y `pathname` `/login`, la grilla se rechaza
      y se ve la tarjeta.

**Completion criterion**
Los tests de arriba pasan, `pnpm build` termina y `/~offline` sigue en el precache.

## Block 4 — E2E sin conexión

**Files**
- `tests/e2e/offline.spec.ts` (new) — corre en `iphone-webkit`, `mobile-chromium` y `mobile-360`
  (playwright.config.ts no lo excluye); usa `context.setOffline`, `signUp`, `submitLogin` y los
  helpers de `tests/e2e/grid.ts`.

**Logic**
Prueba de punta a punta, con el service worker del build de producción, los criterios AC-20 a
AC-27. Para AC-24 y AC-27, `page.route` hace fallar la Server Action (POST con `Next-Action`) y
después se quita.

**Data model**
- Reuses `selected_shows` from FEAT-003a — no schema change; constraints as declared there: PK
  `(user_id, show_id)`, FK a `users` on delete cascade, FK a `shows` on delete restrict.

**Input validation**
- Sin entradas nuevas: solo la UI y las Server Actions de los bloques 2 y 3.

**Error handling**
- La sincronización falla en el E2E (la ruta abortada) — la pendiente y el aviso siguen; al quitar
  la ruta y volver `online`, se sincroniza.

**Required tests**
- [ ] `test-e2e-offline-grid` — con conexión guarda un show, sin conexión recarga `/` y lo ve
      elegido — validates AC-20.
- [ ] `test-e2e-offline-after-logout` — después de "Cerrar sesión", sin conexión `/` muestra "Sin
      conexión" (la copia faltante) — validates AC-21.
- [ ] `test-e2e-offline-save-reopen` — sin conexión elige un show, "Guardar", ve el aviso, recarga
      sin conexión y lo sigue viendo elegido con el aviso — validates AC-22, AC-25.
- [ ] `test-e2e-offline-sync` — al volver la señal el aviso desaparece, y otro contexto que entra con
      la misma cuenta ve ese show elegido — validates AC-23.
- [ ] `test-e2e-offline-sync-error-retry` — con la Server Action abortada (error) al volver la
      señal, el aviso sigue; sin la ruta, el siguiente `online` sincroniza — validates AC-24.
- [ ] `test-e2e-offline-last-write-wins` — el dispositivo A guarda `[x]` sin conexión, B guarda `[y]`
      con conexión, A vuelve y sincroniza: B recarga y ve `[x]` — validates AC-26.
- [ ] `test-e2e-offline-other-account-rejected` — con la pendiente de A sin sincronizar (ruta
      abortada), A cierra sesión y entra B: B no ve la selección de A ni el aviso, y su cuenta no
      cambia; al volver A, se sincroniza en A — validates AC-27.
- [ ] `test-e2e-offline-notice-width` — en 360 y 430 px, con el aviso visible, no hay scroll
      horizontal — validates NFR-02.

**Completion criterion**
`pnpm test:e2e` (o `pnpm test:e2e:docker` en hosts sin las bibliotecas de WebKit) pasa en los tres
proyectos mobile, y `tests/e2e/pwa.spec.ts` sigue verde sin cambios.

## Final verification
`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (con los pisos 80/70/80),
`pnpm test:integration` y `pnpm test:e2e` pasan. Los 8 AC (AC-20 a AC-27) tienen al menos un test.
R-17 sigue verde: ninguna caché guarda `/`, `/login` ni `/register`. A mano en un iPhone, con la app
instalada: modo avión, abrir la app, ver la grilla, guardar, cerrar y volver a abrir, sacar el modo
avión y ver que el aviso desaparece.
