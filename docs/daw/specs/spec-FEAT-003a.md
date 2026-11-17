# Spec FEAT-003a: Grilla y mi selección con conexión

| Field | Value |
|-------|-------|
| Ticket | FEAT-003a |
| PRD | docs/daw/prd/prd-FEAT-003a.md |
| Tier | FEATURE |
| Date | 2026-11-17 |
| Spec loops | 0 |
| Loops since last human decision | 0 |

## Summary
La grilla del festival se versiona como un JSON normalizado (`data/schedule.json`) convertido una
sola vez desde la fuente del repo anterior, y un seed lo carga en PostgreSQL (tablas
`festival_days`, `stages` y `shows`). La selección de cada usuario vive en `selected_shows`. La
pantalla principal `/` deja de ser la presentación y pasa a ser la grilla a pantalla completa:
selector de día, tabla escenarios × horarios con scroll x/y y encabezados fijos, bloques que se
marcan y desmarcan como cambios pendientes, aviso con "Guardar"/"Descartar", marca de choque y
confirmación al cerrar sesión con cambios sin guardar. El guardado es una Server Action delgada que
llama a `src/server/selection.ts`. Son 4 bloques: datos y seed; lógica y servidor; pantalla; E2E y
documentación. Incorpora R-01 a R-12 de `docs/daw/security/threat-FEAT-003a.md`, los 8 gaps del
Impact Check y los 13 hallazgos de la auditoría de arquitectura de PLAN.

### Decisiones aplicadas
- **Del usuario (2026-11-17, DEFINE):** el PRD de FEAT-003 se partió en FEAT-003a (este, 20 AC) y
  FEAT-003b (sin conexión y sincronización, 8 AC).
- **Del usuario (2026-11-17, PLAN):** `/` es la grilla a pantalla completa. Arriba, una barra con
  "Mi Grilla" y un botón de menú que abre una hoja desde abajo con el saludo ("Hola, {nombre}"), la
  guía "Cómo instalarla" (el `InstallGuide` actual) y "Cerrar sesión". Las tarjetas "Muy pronto" y
  sus previews decorativos se eliminan.
- **Técnica — claves del JSON en inglés.** El concepto nombraba el formato normalizado con claves en
  español (`dias`, `escenarios`, `orden`); AGENTS.md (posterior) pide identificadores en inglés. El
  formato es el que define el concepto (plano: festival con zona horaria, días con fecha, escenarios
  con orden y shows con id estable), con las claves traducidas: `festival.timeZone`, `days`,
  `stages[].position`, `shows`. No cambia ningún requisito del PRD.
- **Técnica — ids congelados.** Cada show tiene un id `{día}-{escenario}-{HHMM}` asignado una sola
  vez en la conversión (por ejemplo `fri-samsung-2330` para Peggy Gou). El id es un nombre, no un
  cálculo: si después se corrige una hora en el JSON, el id no cambia. El seed nunca deriva ids.
- **Técnica — instantes con zona.** Las columnas `starts_at`/`ends_at` son `TIMESTAMPTZ(3)`, a
  diferencia de las de FEAT-002 (`TIMESTAMP(3)` sin zona, que solo guardan instantes del reloj del
  servidor): un show es una hora de pared de Buenos Aires y un instante a la vez, y con zona la base
  no depende del `TimeZone` de la sesión.
- **Técnica — seed con `pg`, no con el cliente de Prisma.** AGENTS.md habla de "un seed de Prisma":
  se registra en `prisma.config.ts` (`migrations.seed`) y corre con `pnpm db:seed`, pero escribe con
  `pg` y SQL parametrizado. Motivo: el cliente generado (`src/server/generated/prisma/`) importa
  módulos sin extensión y no corre con el type stripping de Node 24, y oxlint prohíbe importarlo
  fuera de `src/server/`. El riesgo de que el SQL a mano se desincronice del esquema lo cubre
  `test-seed-idempotent` (integración, contra la base migrada).
- **Técnica — FR-12 y las salidas de la grilla.** La única salida dentro de la app es "Cerrar
  sesión": con cambios pendientes abre un AlertDialog, y solo confirma si el usuario lo pide. Eso es
  lo que cubre AC-16 en todos los navegadores. Recargar, cerrar la pestaña o ir hacia atrás disparan
  además `beforeunload`, que es un extra: iOS Safari y la PWA instalada no lo respetan siempre, así
  que su test corre solo en Chromium y no se cuenta como evidencia de AC-16 en iPhone.

### Dependencias nuevas (versión exacta)
- `@radix-ui/react-tabs` 1.2.1 — el `tabs` real de shadcn (new-york) para el selector de día;
  paquete Radix suelto, como los que ya están (`react-collapsible`, `react-label`, `react-slot`).
- `@radix-ui/react-alert-dialog` 1.2.1 — el `alert-dialog` de shadcn, para confirmar la salida con
  cambios pendientes (FR-12). Trae `@radix-ui/react-dialog` como transitiva.
- `vaul` 1.1.2 — el `drawer` de shadcn, para el menú desde abajo: la guía `gestures` pide Vaul para
  bottom sheets (sigue al dedo, se cierra deslizando, interrumpible). Publicada el 2024-12-14, sin
  versiones nuevas desde entonces; declara React 19 en sus `peerDependencies`. Se verifica en el
  Block 3 que `pnpm install` no reporte conflictos de peers con React 19.3.1; si los reporta, se
  frena y se vuelve a PLAN.
- Las tres superan la ventana de antigüedad de pnpm 12, así que no hace falta tocar
  `minimumReleaseAgeExclude`.

### Catálogo de códigos (`src/server`) y mensajes (`src/lib/selection-messages.ts`)
| Código | Mensaje en la UI |
|---|---|
| `INVALID_SELECTION` | "No pudimos guardar esa selección. Recargá la grilla y probá de nuevo." |
| `UNAUTHENTICATED` | "Tu sesión terminó. Volvé a iniciar sesión para guardar." |
| `SERVICE_UNAVAILABLE` | "No pudimos guardar. Probá de nuevo en un rato." |
| `NETWORK_ERROR` (solo cliente) | "No pudimos guardar. Revisá tu conexión y probá de nuevo." |
| `SCHEDULE_UNAVAILABLE` (pantalla) | "No pudimos cargar la grilla. Probá de nuevo en un rato." |

Un código que no esté en la tabla se muestra con el mensaje de `SERVICE_UNAVAILABLE`, como hace
`messageFor` en `account-messages.ts`. Ningún `message` de Prisma o de `pg` llega al cliente (R-05).

## Coverage: PRD → blocks
| Requirement | Covered by |
|---|---|
| FR-01 | Block 1 (JSON normalizado, esquema y seed), Block 2 (`getSchedule`), Block 3 (render), Block 4 (E2E de los 91 shows) |
| FR-02 | Block 1 (`stages.position`), Block 2 (`hourMarks`), Block 3 (`schedule-grid.tsx`) |
| FR-03 | Block 2 (`blockGeometry`), Block 3 (contenido del bloque) |
| FR-04 | Block 1 (`posterTimeToInstant`), Block 2 (eje extendido) |
| FR-05 | Block 3 (`day-picker.tsx`) |
| FR-06 | Block 3 (ancho de columna y scroll x/y) |
| FR-07 | Block 3 (encabezado y columna de horas `sticky`) |
| FR-08 | Block 1 (`festivalDayFor`), Block 3 (día inicial calculado en `page.tsx`) |
| FR-09 | Block 3 (`schedule-screen.tsx`: borrador) |
| FR-10 | Block 2 (`saveSelection`, `selection-actions.ts`), Block 3 (borrador por encima del día) |
| FR-11 | Block 3 (`pending-bar.tsx`) |
| FR-12 | Block 3 (AlertDialog al cerrar sesión; `beforeunload` como extra) |
| FR-13 | Block 3 (estilo y `aria-pressed` del bloque elegido) |
| FR-14 | Block 2 (`findClashes`), Block 3 (marca de choque) |
| FR-15 | Block 3 (`page.tsx` sigue verificando la sesión), Block 4 (E2E sin sesión) |
| NFR-01 | Block 4: E2E en Chromium con 4G simulado por CDP; la grilla se lee de una memoización en el proceso (Block 2) y `page.tsx` hace una sola consulta por pedido |
| NFR-02 | Block 2: test de integración con 20 guardados, p95 ≤ 1000 ms |
| NFR-03 | Block 2 (`MIN_BLOCK_HEIGHT` 44 px), Block 3 (columnas a `(100% − 3rem) / 3`), Block 4 (E2E en 360 y 430 px) |
| NFR-04 | Block 3 (texto a 13 px, corte de palabras largas), Block 4 (E2E en 360 px: bloques de 45 min o más con el nombre en 2 líneas o menos) |
| NFR-05 | Block 1: test unitario que compara `data/schedule.json` con la fuente versionada, show por show |

## Dependencies between blocks
Block 2 depende de 1 (tablas, seed y `festival-time.ts`). Block 3 depende de 2 (`getSchedule`,
`getSelection`, la Server Action, el layout y los choques). Block 4 depende de 3 (la pantalla
existe). Orden: 1 → 2 → 3 → 4.

## Mobile guides applied (AGENTS.md → Code conventions)
Para la pantalla de la grilla (`/`), su menú y su confirmación:
- `mobile-native` fix 1: el hover solo dentro de `@media (hover: hover)`; en los bloques el estado
  elegido no depende del hover.
- `mobile-native` fix 2: sin destello al tocar (global en `globals.css`, FEAT-001).
- `mobile-native` fix 3: la pantalla ocupa exactamente `100dvh` (`.app-shell` más una clase de
  pantalla fija con `height: 100dvh`): barra superior y selector de día arriba, el contenedor de la
  grilla con `flex: 1; min-height: 0` y scroll propio en x/y, y el aviso de pendientes abajo. El
  documento no scrollea; scrollea la grilla.
- `mobile-native` fix 5: estado presionado por `pointerdown` con `usePressed` de
  `src/components/pressable.ts` en los bloques de show, el botón de menú y los botones del aviso;
  `touch-action: manipulation` en todos.
- `mobile-native` fixes 7 y 8: safe areas con `env(safe-area-inset-*)` en la barra superior (top),
  en el aviso de pendientes (bottom) y en el contenido del drawer (bottom); sin selección de texto en
  bloques y botones (`user-select: none`).
- `mobile-native` scroll: `overscroll-behavior: contain` en el contenedor de la grilla, así el
  scroll de la grilla no arrastra la página (el documento ya tiene `none`, FEAT-001).
- `mobile-native` "Baseline" y "Never Ship": se respetan; sin `maximum-scale`, nada bajo 44 × 44
  tocable.
- `gestures`:
  - el menú es un bottom sheet de Vaul (`drawer` de shadcn): sigue al dedo 1:1 y se cierra
    deslizando hacia abajo o tocando afuera; `data-vaul-no-drag` en los botones de adentro para que
    un toque no inicie un arrastre;
  - curva y duración: las de Vaul por defecto (`cubic-bezier(0.32, 0.72, 0, 1)`, 500 ms);
  - el scroll x/y de la grilla es el nativo del navegador (inercia y rebote propios); no hay gestos
    propios encima.
- `design-taste-frontend`:
  - un solo sistema: tokens Rosé Pine; foam (`--primary`) es el acento del bloque elegido; gold
    (`--warning`) solo para la marca de choque; iris no se usa;
  - bloques planos con radio `--radius-md`, borde `--border` en los no elegidos y relleno foam con
    texto `--primary-foreground` en los elegidos; sin sombras ni degradés;
  - tipografía: nombre a 13 px semibold, subtítulo y horario a 12 px con números tabulares;
  - copy propio en español ("Guardar", "Descartar", "3 cambios sin guardar"), sin textos de
    plantilla; sin hero ni fotos, porque es una pantalla de app.

## Block 1 — Datos de la grilla, esquema y seed

**Files**
- `data/schedule-source-248dba3.json` (new) — `lollapalooza-schedule.json` de
  `joaquinvesapa/mi-grilla-app@248dba3`, con los mismos datos, formateado con `pnpm format`. Solo lo
  lee el test de NFR-05.
- `data/schedule.json` (new) — el formato normalizado (abajo), formateado con `pnpm format`.
- `prisma/schema.prisma` (modified) — modelos `FestivalDay`, `Stage`, `Show` y `SelectedShow`, y la
  relación inversa `selectedShows` en `User`.
- `prisma/migrations/<timestamp>_schedule/migration.sql` (new) — generada con
  `prisma migrate dev --create-only --name schedule` y revisada a mano.
- `src/lib/festival-time.ts` (new) — sin I/O, sin imports de valor (solo `import type` relativos) y
  solo sintaxis que el type stripping de Node puede borrar (sin `enum` ni parameter properties):
  - `FESTIVAL_TIME_ZONE = "America/Argentina/Buenos_Aires"` y `FESTIVAL_UTC_OFFSET = "-03:00"`
    (Argentina no tiene horario de verano desde 2009);
  - `posterTimeToInstant(date: "YYYY-MM-DD", time: "HH:MM")` → `Date`: una hora de 00:00 a 05:59 es
    del día calendario siguiente (FR-04);
  - `formatClock(instant)` → `"HH:MM"` en la zona del festival (`Intl.DateTimeFormat` con
    `hourCycle: "h23"`);
  - `festivalDayFor(now, days)` → id del día cuyo intervalo `[fecha 06:00, fecha+1 06:00)` contiene
    `now`; fuera de los tres, el día con `position` 1 (FR-08).
- `src/lib/schedule-types.ts` (new) — tipos `FestivalDay`, `Stage`, `Show` (instantes como string
  ISO, serializables a un componente cliente) y `Schedule`.
- `src/lib/database-url.ts` (new) — el chequeo puro que hoy vive en `src/server/database-url.ts`
  (`assertSafeDatabaseUrl`, `UnsafeDatabaseUrlError` y sus códigos), movido tal cual y sin
  `server-only`, para que el seed lo use.
- `src/server/database-url.ts` (modified) — conserva `import "server-only"` y re-exporta desde
  `@/lib/database-url`; `db.ts`, sus tests y `health.test.ts` no cambian.
- `prisma/seed.ts` (new) — corre con `node prisma/seed.ts` (type stripping de Node 24, sin
  transpilar). Importa solo `pg`, `node:fs`, `../src/lib/festival-time.ts` y
  `../src/lib/database-url.ts` (con extensión). Exporta `seedSchedule(client)` para los tests de
  integración y ejecuta `main()` solo si es el punto de entrada.
- `tsconfig.json` (modified) — `allowImportingTsExtensions: true` (válido con `noEmit`), para que
  `pnpm typecheck` acepte los imports con `.ts` del seed (TS5097).
- `prisma.config.ts` (modified) — `migrations.seed: "node prisma/seed.ts"`.
- `package.json` (modified) — script `db:seed`: `node prisma/seed.ts`.
- `.github/workflows/ci.yml` (modified) — `pnpm db:seed` después de `pnpm db:migrate` en los jobs
  `integration` y `e2e`.
- `tests/unit/ci/workflow.test.ts` (modified) — exige `pnpm db:seed` entre `pnpm db:migrate` y la
  suite en `integration` y en `e2e`.
- `scripts/test-e2e-docker.sh` (modified) — el requisito impreso pasa a
  `pnpm db:up && pnpm db:migrate && pnpm db:seed`.
- `AGENTS.md` (modified) — Folder structure: `data/` (la grilla versionada) y `prisma/seed.ts`;
  Testing: antes de `pnpm test:integration` y `pnpm test:e2e`, también `pnpm db:seed`; la CI corre
  el seed en `integration` y `e2e`.
- `README.md` (modified) — el setup local y la lista de scripts suman `pnpm db:seed`.
- `tests/unit/lib/festival-time.test.ts` (new), `tests/unit/lib/schedule-data.test.ts` (new),
  `tests/unit/lib/database-url.test.ts` (new), `tests/integration/seed.test.ts` (new).

**Logic**
Implementa FR-01, FR-04, FR-08 (cálculo del día) y NFR-05. La conversión de la fuente al JSON
normalizado se hace una sola vez en este bloque, con una herramienta descartable que no se versiona;
el resultado es `data/schedule.json`. Formato:

```json
{
  "festival": { "timeZone": "America/Argentina/Buenos_Aires" },
  "days": [{ "id": "fri", "name": "Viernes", "date": "2026-03-13", "position": 1 }],
  "stages": [{ "id": "flow", "name": "Flow", "position": 1 }],
  "shows": [
    { "id": "fri-samsung-2330", "dayId": "fri", "stageId": "samsung",
      "artist": "Peggy Gou", "start": "23:30", "end": "01:00" }
  ]
}
```

Días: `fri` Viernes 2026-03-13, `sat` Sábado 2026-03-14, `sun` Domingo 2026-03-15. Escenarios, en
este orden: `flow` "Flow", `samsung` "Samsung", `alternative` "Alternative", `perrys` "Perry's",
`kidzapalooza` "Kidzapalooza" (los nombres del glosario de AGENTS.md; la fuente dice "Flow Stage",
"KidzaPalooza", etc.). `subtitle` solo existe si la fuente tiene `subtitulo`.

El seed:
1. Lee `DATABASE_URL` y la pasa por `assertSafeDatabaseUrl` (local o TLS, como `db.ts`).
2. Lee y parsea `data/schedule.json` con `node:fs`.
3. En una transacción: upsert de días, escenarios y shows (`INSERT … ON CONFLICT (id) DO UPDATE`),
   con instantes de `posterTimeToInstant`.
4. Si en la base quedan shows cuyo id no está en el JSON, hace rollback y falla con
   `SCHEDULE_ORPHANED` (no borra: un show elegido por alguien no se puede borrar sin decidir qué
   pasa con esa selección).
5. Imprime `[seed] OK days=3 stages=5 shows=91` y sale con 0; ante un error imprime
   `[seed] <CÓDIGO>` sin la URL ni el mensaje de `pg` y sale con 1.

**Data model**
- `FestivalDay` → `festival_days`: `id` text PK; `name` text not null; `date` `DATE` not null;
  `position` int not null unique.
- `Stage` → `stages`: `id` text PK; `name` text not null; `position` int not null unique.
- `Show` → `shows`: `id` text PK; `dayId` → `day_id` text not null FK a `festival_days(id)`
  (restrict); `stageId` → `stage_id` text not null FK a `stages(id)` (restrict); `artist` text not
  null; `subtitle` text null; `startsAt` → `starts_at` `TIMESTAMPTZ(3)` not null; `endsAt` →
  `ends_at` `TIMESTAMPTZ(3)` not null; índice en `day_id`.
- `SelectedShow` → `selected_shows`: `userId` → `user_id` text FK a `users(id)` on delete cascade;
  `showId` → `show_id` text FK a `shows(id)` on delete restrict; `createdAt` → `created_at`
  `TIMESTAMP(3)` default now; PK `(user_id, show_id)`; índice en `show_id` (lo usa el chequeo del
  restrict y las consultas por show de los grupos, PRD 06).
- Campos en camelCase y tablas y columnas en snake_case con `@map`/`@@map`, como pide el
  comentario de `schema.prisma`.

**Input validation**
- `data/schedule.json` (entrada del seed): `days` con `id` no vacío, `date` `YYYY-MM-DD` y
  `position` entero; `stages` con `id`, `name` y `position`; cada show con `id` que cumple
  `^[a-z0-9-]{1,64}$`, `dayId` y `stageId` existentes, `artist` no vacío, `start` y `end` `HH:MM`.
  Cualquier otra forma da `SCHEDULE_INVALID` y no se escribe nada.
- `DATABASE_URL`: la valida `assertSafeDatabaseUrl` (`INVALID_URL`, `TLS_REQUIRED`).

**Error handling**
- JSON con forma inválida — `[seed] SCHEDULE_INVALID`, salida 1, nada escrito.
- `DATABASE_URL` faltante, inválida o remota sin TLS — `[seed] INVALID_URL` o
  `[seed] TLS_REQUIRED`, salida 1, sin conectarse.
- Shows en la base que no están en el JSON — rollback, `[seed] SCHEDULE_ORPHANED`, salida 1.
- La base no responde o falla una consulta — rollback, `[seed] SERVICE_UNAVAILABLE`, salida 1, sin
  el mensaje de `pg`.

**Required tests**
- [ ] `test-poster-time-after-midnight` — `festival-time.test.ts`: `("2026-03-13", "01:00")` →
      `2026-03-14T04:00:00.000Z`; `("2026-03-13", "23:30")` → `2026-03-14T02:30:00.000Z`;
      `"05:59"` es del día siguiente y `"06:00"` del mismo — validates AC-05.
- [ ] `test-format-clock` — `festival-time.test.ts`: `formatClock` de los dos instantes anteriores
      → `"01:00"` y `"23:30"` — validates AC-03.
- [ ] `test-festival-day-during` — `festival-time.test.ts`: sábado 2026-03-14 21:30 (hora del
      festival) → `sat`; domingo 2026-03-15 00:30 → `sat`; domingo 06:00 → `sun` — validates AC-09.
- [ ] `test-festival-day-outside` — `festival-time.test.ts`: 2026-11-17, 2026-03-13 05:59 y
      2026-03-16 06:00 → `fri` — validates AC-10.
- [ ] `test-schedule-data-matches-source` — `schedule-data.test.ts`: los 91 shows de
      `data/schedule.json` coinciden uno a uno con la fuente (día, escenario mapeado, artista,
      subtítulo, inicio y fin), sin sobrantes ni faltantes; 3 días, 5 escenarios en orden; ids
      únicos y con el formato válido — validates AC-01.
- [ ] `test-schedule-data-after-midnight` — `schedule-data.test.ts`: Peggy Gou (`fri`, `samsung`,
      23:30–01:00), Skrillex (`sat`, 23:45–01:00) y Kygo (`sun`, 23:20–00:35) — validates AC-05.
- [ ] `test-database-url-lib-invalid` — `database-url.test.ts`: el módulo de `src/lib` rechaza
      `mysql://…` con `INVALID_URL` y un host remoto sin `sslmode` con `TLS_REQUIRED`, y acepta
      `postgresql://u:p@127.0.0.1:5432/db`; el de `src/server` exporta las mismas funciones.
- [ ] `test-seed-idempotent` — `seed.test.ts` (integración): correr `seedSchedule` dos veces deja
      3 días, 5 escenarios y 91 shows, con Peggy Gou en `starts_at = 2026-03-14T02:30Z` — validates
      AC-01.
- [ ] `test-seed-invalid-schedule-rejected` — `seed.test.ts` (integración): un JSON con un show sin
      `artist` es rechazado con `SCHEDULE_INVALID` y la base queda como estaba.
- [ ] `test-seed-orphaned-rejected` — `seed.test.ts` (integración): con un show extra insertado a
      mano, el seed es rechazado con `SCHEDULE_ORPHANED`, hace rollback y no borra nada.
- [ ] `test-seed-unsafe-url-rejected` — `seed.test.ts` (integración): con una URL remota sin TLS,
      `main` sale con 1 e imprime `[seed] TLS_REQUIRED` sin la URL.
- [ ] `test-seed-db-error` — `seed.test.ts` (integración): con la consulta fallando (cliente
      simulado que lanza), el seed hace rollback e imprime `[seed] SERVICE_UNAVAILABLE` sin el
      mensaje de `pg`.
- [ ] `test-workflow-seed-step` — `workflow.test.ts`: en `integration` y en `e2e`,
      `pnpm db:seed` va después de `pnpm db:migrate` y antes de la suite; un workflow sin el paso es
      rechazado.

**Completion criterion**
Los tests de arriba pasan; `pnpm db:migrate && pnpm db:seed` en una base vacía imprime
`[seed] OK days=3 stages=5 shows=91`; `pnpm typecheck`, `pnpm lint` y `pnpm format:check` pasan.

## Block 2 — Lógica de la grilla y servicios de selección

**Files**
- `src/lib/schedule-layout.ts` (new) — sin I/O: `PX_PER_MINUTE = 2`, `MIN_BLOCK_HEIGHT = 44`;
  `dayAxis(shows)` → `{ start, end }` (hora entera anterior al primer inicio y hora entera posterior
  al último fin); `hourMarks(axis)` → instantes de cada hora; `blockGeometry(show, axis)` →
  `{ top, height }` con `height = max(duración × PX_PER_MINUTE, MIN_BLOCK_HEIGHT)`.
- `src/lib/clashes.ts` (new) — `findClashes(shows, selectedIds)` → `Set` de ids elegidos que
  comparten al menos un minuto con otro elegido del mismo día (`a.start < b.end && b.start <
  a.end`).
- `src/lib/selection-messages.ts` (new) — `selectionMessageFor(code)` con el catálogo de arriba y
  el respaldo a `SERVICE_UNAVAILABLE`.
- `src/server/schedule.ts` (new) — `import "server-only"`. `getSchedule()` →
  `{ ok: true, schedule } | { ok: false, code: "SERVICE_UNAVAILABLE" }`, con días y escenarios por
  `position` y shows por `startsAt`. Memoiza solo el éxito (un fallo no se guarda y la próxima
  llamada reintenta); registra `[schedule] SERVICE_UNAVAILABLE at=<ISO>` sin detalle.
- `src/server/selection.ts` (new) — `import "server-only"`:
  - `getSelection(userId)` → `{ ok: true, showIds } | { ok: false, code: "SERVICE_UNAVAILABLE" }`;
  - `saveSelection(userId, showIds: unknown)` → `{ ok: true } | { ok: false, code:
    "INVALID_SELECTION" | "SERVICE_UNAVAILABLE" }`: valida (abajo) contra `getSchedule()` y, en una
    transacción interactiva, toma `SELECT id FROM users WHERE id = $1 FOR UPDATE`, borra las filas
    del usuario y crea las nuevas (R-10);
  - errores de la base → `SERVICE_UNAVAILABLE` y `[selection] SERVICE_UNAVAILABLE at=<ISO>`.
- `src/app/selection-actions.ts` (new) — `"use server"`, delgada:
  `saveSelectionAction(showIds: unknown)` lee los headers, obtiene el usuario con
  `getAccounts().getCurrentUser(headers)` (si lanza `AccountsUnavailableError` →
  `SERVICE_UNAVAILABLE`; sin usuario → `UNAUTHENTICATED`) y llama a `saveSelection(user.id,
  showIds)`.
- `tests/unit/lib/schedule-layout.test.ts`, `tests/unit/lib/clashes.test.ts`,
  `tests/unit/lib/selection-messages.test.ts`, `tests/unit/server/schedule.test.ts`,
  `tests/unit/server/selection.test.ts`, `tests/integration/selection.test.ts` (new).

**Logic**
Implementa FR-03 y FR-04 (geometría y eje), FR-10 (guardado en la cuenta) y FR-14 (choques), y la
lectura de FR-01. La grilla es igual para todos y no cambia, por eso se memoiza; la selección es
del usuario y se lee siempre de la base (R-12).

**API contract**
- Method + path: Server Action `saveSelectionAction`, invocada por POST de Next al path de `/`
  (con el chequeo de `Origin` de Next 16).
- Request: `showIds` (`unknown`, se espera `string[]` de ids de shows).
- Response: `{ ok: true }` o `{ ok: false, code }`.
- Error codes: `INVALID_SELECTION`, `UNAUTHENTICATED`, `SERVICE_UNAVAILABLE`.
- Auth: sesión de Better Auth verificada en la acción; el `userId` sale de la sesión, nunca del
  cliente (R-01).

**Data model**
- Reuses `shows` and `selected_shows` from Block 1 — no schema change; constraints as declared
  there: PK `(user_id, show_id)`, FK a `users` on delete cascade, FK a `shows` on delete restrict,
  índice en `show_id`; `shows.starts_at`/`ends_at` `TIMESTAMPTZ(3)` not null.

**Input validation**
- `showIds`: arreglo (`Array.isArray`); largo ≤ cantidad de shows de la grilla; cada elemento string
  de 1 a 64 caracteres que cumple `^[a-z0-9-]+$`; sin repetidos; cada id existe en la grilla.
  Cualquier otra cosa → `INVALID_SELECTION`, sin tocar `selected_shows` (R-02).

**Error handling**
- `showIds` inválido (no arreglo, demasiado largo, repetido, id desconocido) — `INVALID_SELECTION`,
  no se escribe nada.
- Sin sesión o sesión vencida — `UNAUTHENTICATED`, no se llama a `saveSelection`.
- `getCurrentUser` lanza `AccountsUnavailableError` — `SERVICE_UNAVAILABLE`.
- La base falla al leer la grilla, leer la selección o guardar — `SERVICE_UNAVAILABLE`, rollback y
  log con código y hora, sin mensaje de infraestructura (R-05).

**Required tests**
- [ ] `test-layout-geometry` — `schedule-layout.test.ts`: un show de 60 min mide 120 px y uno de 45
      min 90 px; `top` = minutos desde el inicio del eje × 2 — validates AC-04.
- [ ] `test-layout-axis-after-midnight` — `schedule-layout.test.ts`: con los shows del viernes el
      eje va de 13:00 a 01:00 y la última marca es 01:00 — validates AC-05, AC-02.
- [ ] `test-layout-min-height` — `schedule-layout.test.ts`: un show de 15 min mide 44 px y uno de
      30 min, 60 px — validates AC-28.
- [ ] `test-clashes-overlap` — `clashes.test.ts`: dos elegidos que comparten un minuto → ambos en
      el set — validates AC-17.
- [ ] `test-clashes-edge-rejected` — `clashes.test.ts`: uno termina 18:00 y otro empieza 18:00 →
      choque rechazado, set vacío; tampoco choca un no elegido ni uno de otro día — validates AC-18.
- [ ] `test-selection-messages` — `selection-messages.test.ts`: cada código tiene su mensaje y un
      código desconocido (inválido) cae en el de `SERVICE_UNAVAILABLE`.
- [ ] `test-schedule-memo-error` — `schedule.test.ts` (unit, base simulada): un error de la base
      devuelve `SERVICE_UNAVAILABLE`, registra solo código y hora, no se memoiza y la llamada
      siguiente reintenta y memoiza el éxito.
- [ ] `test-selection-invalid-rejected` — `selection.test.ts` (unit): `"x"`, `[1]`, `["a","a"]`,
      `["NO_VALE"]`, un id desconocido y un arreglo de 92 → `INVALID_SELECTION` y la base no se
      toca.
- [ ] `test-selection-action-unauthorized` — `selection.test.ts` (unit): sin sesión la acción
      devuelve `UNAUTHENTICATED` (no autorizado) y no llama a `saveSelection`; con
      `AccountsUnavailableError` devuelve `SERVICE_UNAVAILABLE`.
- [ ] `test-selection-db-error` — `selection.test.ts` (unit): un error de la base al guardar o al
      leer → `SERVICE_UNAVAILABLE` y el log no incluye el mensaje original.
- [ ] `test-selection-save-replace` — `selection.test.ts` (integración): guardar `[a, b]` y después
      `[b, c]` deja exactamente `{b, c}` y `getSelection` lo devuelve — validates AC-12.
- [ ] `test-selection-isolated-users` — `selection.test.ts` (integración): la selección de una
      cuenta no aparece en `getSelection` de otra (R-04); borrar el usuario borra sus filas.
- [ ] `test-selection-concurrent` — `selection.test.ts` (integración): dos guardados simultáneos
      del mismo usuario terminan con exactamente uno de los dos conjuntos, sin mezcla (R-10).
- [ ] `test-selection-latency` — `selection.test.ts` (integración): p95 de 20 guardados de 10
      shows ≤ 1000 ms, después de 1 de calentamiento — validates NFR-02.

**Completion criterion**
Los tests de arriba pasan y `pnpm test` mantiene los pisos 80/70/80.

## Block 3 — Pantalla de la grilla

**Files**
- `package.json`, `pnpm-lock.yaml` (modified) — `@radix-ui/react-tabs` 1.2.1,
  `@radix-ui/react-alert-dialog` 1.2.1 y `vaul` 1.1.2, exactas.
- `src/components/ui/tabs.tsx`, `src/components/ui/alert-dialog.tsx`,
  `src/components/ui/drawer.tsx` (new) — generados con el CLI de shadcn 4.23.0 (new-york) y
  adaptados como en FEAT-002: imports de los paquetes `@radix-ui/react-*` sueltos y de
  `@/lib/utils`, con el motivo comentado.
- `src/components/day-picker.tsx` (new) — Tabs con "Viernes", "Sábado" y "Domingo"; triggers de
  44 px de alto como mínimo.
- `src/components/schedule-grid.tsx` (new) — contenedor con scroll x/y
  (`role="region"`, `aria-label="Grilla del {día}"`, `overscroll-behavior: contain`): fila de
  escenarios `sticky` arriba, columna de horas `sticky` a la izquierda (3rem) y la esquina fija
  sobre ambas; columnas de `calc((100% - 3rem) / 3)`; cada show es un `button` absoluto con
  `data-show-id`, `aria-pressed` y la geometría de `blockGeometry`; muestra artista, subtítulo y
  `"HH:MM – HH:MM"`; marca "sin guardar" en los que difieren de lo guardado; marca de choque con
  ícono (`TriangleAlert` de lucide) y texto accesible "Choca con otro show elegido".
- `src/components/pending-bar.tsx` (new) — `role="region"` "Cambios sin guardar" con
  "{N} cambio(s) sin guardar", "Descartar" y "Guardar"; mensaje de error en `role="alert"`.
- `src/components/app-menu.tsx` (new) — botón "Menú" (44 × 44) que abre el drawer de Vaul con
  "Hola, {nombre}", `InstallGuide` y "Cerrar sesión" (form con `logoutAction`); con cambios
  pendientes, "Cerrar sesión" abre el AlertDialog en lugar de enviar.
- `src/components/schedule-screen.tsx` (new) — `"use client"`: estado del día, de la selección
  guardada y del borrador; arma el aviso, el menú y la confirmación; guarda con
  `saveSelectionAction` dentro de `useTransition`; con pendientes registra `beforeunload`.
- `src/app/page.tsx` (modified) — conserva la verificación de sesión; carga `getSchedule()` y
  `getSelection(user.id)`; calcula el día inicial con `festivalDayFor(new Date(), days)`; renderiza
  `<ScheduleScreen>` o, si algo falló, la barra con el menú y el mensaje `SCHEDULE_UNAVAILABLE`. Se
  borran `FEATURES`, `GridPreview`, `LockScreenPreview` y `GroupPreview`.
- `src/app/globals.css` (modified) — la clase de pantalla fija (`height: 100dvh`) y los estilos de
  la grilla que Tailwind no cubre (`overscroll-behavior`, `user-select`).
- `tests/unit/components/schedule-grid.test.tsx`, `schedule-screen.test.tsx`,
  `day-picker.test.tsx`, `pending-bar.test.tsx`, `app-menu.test.tsx` (new).

**Logic**
Implementa FR-02, FR-03, FR-05, FR-06, FR-07, FR-09, FR-10 (borrador), FR-11, FR-12, FR-13, FR-14
(marca) y FR-15. El borrador es un `Set` de ids que vive por encima del día, así que cambiar de día
lo conserva (AC-13). Tocar un show lo agrega o lo quita del borrador. "Pendiente" es la diferencia
entre borrador y guardada; con diferencia hay aviso, `beforeunload` y confirmación al cerrar sesión.
"Guardar" manda el borrador completo; con `{ ok: true }` la guardada pasa a ser el borrador y el
aviso se va; con `{ ok: false }` o si la llamada lanza (`NETWORK_ERROR`) se muestra el mensaje y el
borrador se conserva. "Descartar" vuelve el borrador a la guardada. La página nunca se cachea:
sigue siendo dinámica y el service worker no cachea navegaciones (R-11).

**Data model**
- Reuses `shows` and `selected_shows` from Block 1 through Block 2's services — no schema change;
  constraints as declared there: PK `(user_id, show_id)`, FK a `users` on delete cascade, FK a
  `shows` on delete restrict.

**Input validation**
- El cliente solo manda ids que vinieron de la grilla del servidor; aun así el servidor revalida
  todo (Block 2, R-02). Los textos de la grilla se renderizan como texto de React, sin
  `dangerouslySetInnerHTML` (R-07).

**Error handling**
- `saveSelectionAction` devuelve un código de error — mensaje de `selectionMessageFor` en
  `role="alert"`, borrador intacto.
- La llamada lanza (sin conexión, red caída) — `NETWORK_ERROR` con su mensaje, borrador intacto.
- `getSchedule()` o `getSelection()` fallan al cargar `/` — pantalla con el menú y el mensaje
  `SCHEDULE_UNAVAILABLE`, sin la grilla y sin detalle del error.

**Required tests**
- [ ] `test-grid-render` — `schedule-grid.test.tsx`: con un día de prueba, columnas en el orden de
      `position` y una marca por hora — validates AC-02.
- [ ] `test-grid-block-content` — `schedule-grid.test.tsx`: Arjaus Crew muestra "Franco y Mateo
      Trocca - B2B" y "15:00 – 15:45" — validates AC-03.
- [ ] `test-grid-clash-mark` — `schedule-grid.test.tsx`: los ids del set de choques llevan el ícono
      y el texto "Choca con otro show elegido" — validates AC-17.
- [ ] `test-day-picker-switch` — `day-picker.test.tsx`: elegir "Sábado" llama a `onChange("sat")`
      y marca el trigger activo — validates AC-06.
- [ ] `test-screen-toggle` — `schedule-screen.test.tsx`: tocar un show pone `aria-pressed="true"` y
      tocarlo de nuevo `"false"` — validates AC-11.
- [ ] `test-screen-pending-across-days` — `schedule-screen.test.tsx`: marcar en viernes, ir a
      sábado y volver lo mantiene elegido y pendiente — validates AC-13.
- [ ] `test-screen-pending-bar` — `schedule-screen.test.tsx`: con un cambio aparece "1 cambio sin
      guardar" con "Guardar" y "Descartar"; sin cambios no hay aviso — validates AC-14.
- [ ] `test-screen-discard` — `schedule-screen.test.tsx`: "Descartar" vuelve exactamente a la
      guardada — validates AC-15.
- [ ] `test-screen-save-ok` — `schedule-screen.test.tsx`: "Guardar" llama a la acción con el
      borrador y, con `{ ok: true }`, el aviso desaparece — validates AC-12.
- [ ] `test-screen-save-error` — `schedule-screen.test.tsx`: con `SERVICE_UNAVAILABLE` muestra su
      mensaje de error y conserva el borrador.
- [ ] `test-screen-save-network-error` — `schedule-screen.test.tsx`: si la acción lanza, muestra
      el mensaje de `NETWORK_ERROR` (red caída) y conserva el borrador.
- [ ] `test-screen-leave-confirm` — `schedule-screen.test.tsx`: con pendientes, "Cerrar sesión"
      abre el diálogo; "Seguir editando" lo cierra sin salir y "Salir sin guardar" envía el logout;
      sin pendientes, envía directo — validates AC-16.
- [ ] `test-screen-beforeunload` — `schedule-screen.test.tsx`: el handler está registrado solo
      mientras hay pendientes — validates AC-16.
- [ ] `test-app-menu` — `app-menu.test.tsx`: el botón "Menú" (44 × 44) abre el drawer con
      "Hola, Ana", "Cómo instalarla" y "Cerrar sesión".
- [ ] `test-page-load-error` — `schedule-screen.test.tsx` o test de la página con servicios
      simulados: si la grilla no carga, se ve el mensaje `SCHEDULE_UNAVAILABLE` (error) y no hay
      grilla.

**Completion criterion**
Los tests de arriba pasan, `pnpm install` no reporta conflictos de peers, `pnpm build` termina y, a
mano en 360 px, `/` muestra la grilla del viernes con 3 columnas y el menú.

## Block 4 — E2E, tests existentes y documentación

**Files**
- `tests/e2e/grid.spec.ts` (new) — E2E de la grilla en los proyectos mobile (`iphone-webkit`,
  `mobile-chromium`, `mobile-360`).
- `tests/e2e/grid.ts` (new) — helpers: abrir el menú, elegir día, ubicar un show por id.
- `tests/e2e/performance.spec.ts` (modified) — NFR-01 con 4G simulado (ya es solo Chromium en
  `playwright.config.ts`).
- `tests/e2e/home.spec.ts` (modified) — sin las tarjetas "Muy pronto" ni el scroll del documento;
  h1 "Mi Grilla" en la barra; la guía de instalación (AC-18 a AC-20 de FEAT-001) se abre desde el
  menú; sin scroll horizontal del documento y tocables ≥ 44 × 44 fuera de la grilla.
- `tests/e2e/auth.spec.ts` (modified) — `logoutButton()` abre el menú antes de buscar "Cerrar
  sesión"; el saludo "Hola, {nombre}" se busca dentro del menú.
- `tests/e2e/demo.spec.ts` (modified) — AC-07 de FEAT-001: la rueda scrollea el contenedor de la
  grilla dentro del iframe (ya no el documento) y el saludo y "Cómo instalarla" se buscan en el
  menú.
- `tests/e2e/pwa.spec.ts` — sin cambios (verificado en el Impact Check).

**Logic**
Cierra la evidencia de punta a punta de los 20 AC y de NFR-01, NFR-03 y NFR-04, y adapta los E2E de
FEAT-001 y FEAT-002 a la nueva `/` sin perder lo que verificaban.

**Data model**
- Reuses `festival_days`, `stages`, `shows` and `selected_shows` from Block 1 — no schema change;
  constraints as declared there: PK `(user_id, show_id)`, FK a `users` on delete cascade, FK a
  `shows` on delete restrict, `stages.position` unique.

**Error handling**
- Sin condiciones de error propias: este bloque solo agrega y adapta tests; los errores de la
  pantalla y de los servicios son de los Blocks 2 y 3.

**Required tests**
- [ ] `test-e2e-grid-all-shows` — `grid.spec.ts`: recorriendo los 3 días se ven los 91 bloques, cada
      uno en su columna y con el artista y el horario de `data/schedule.json` — validates AC-01.
- [ ] `test-e2e-grid-columns` — `grid.spec.ts`: encabezados Flow, Samsung, Alternative, Perry's,
      Kidzapalooza en ese orden y marcas por hora — validates AC-02.
- [ ] `test-e2e-grid-block-content` — `grid.spec.ts`: Arjaus Crew del viernes con su subtítulo y
      "15:00 – 15:45" — validates AC-03.
- [ ] `test-e2e-grid-geometry` — `grid.spec.ts`: en una columna, la razón de alturas de dos shows
      es la de sus duraciones y el borde superior de un show que empieza en punto coincide con su
      marca de hora — validates AC-04.
- [ ] `test-e2e-grid-after-midnight` — `grid.spec.ts`: Peggy Gou en la columna Samsung del viernes,
      "23:30 – 01:00", y el eje llega a 01:00 — validates AC-05.
- [ ] `test-e2e-grid-day-switch` — `grid.spec.ts`: elegir "Sábado" muestra Skrillex y no Peggy Gou —
      validates AC-06.
- [ ] `test-e2e-grid-three-columns` — `grid.spec.ts`: en 360 y 430 px se ven completas exactamente
      3 columnas y Perry's se alcanza con scroll horizontal — validates AC-07.
- [ ] `test-e2e-grid-sticky` — `grid.spec.ts`: tras scroll vertical los encabezados siguen visibles
      y tras scroll horizontal las marcas de hora también — validates AC-08.
- [ ] `test-e2e-grid-initial-day` — `grid.spec.ts`: hoy (fuera del festival) abre en el viernes —
      validates AC-10.
- [ ] `test-e2e-grid-toggle` — `grid.spec.ts`: tocar un show lo marca y tocarlo de nuevo lo
      desmarca — validates AC-11.
- [ ] `test-e2e-grid-save-persists` — `grid.spec.ts`: marcar 2 shows, "Guardar", cerrar sesión,
      volver a entrar y verlos elegidos — validates AC-12.
- [ ] `test-e2e-grid-pending-across-days` — `grid.spec.ts`: marcar el viernes, ir al sábado y volver
      sin guardar lo mantiene elegido y pendiente — validates AC-13.
- [ ] `test-e2e-grid-pending-bar` — `grid.spec.ts`: con pendientes se ve el aviso con "Guardar" y
      "Descartar" — validates AC-14.
- [ ] `test-e2e-grid-discard` — `grid.spec.ts`: guardar uno, marcar otro y "Descartar" vuelve a la
      guardada — validates AC-15.
- [ ] `test-e2e-grid-leave-confirm` — `grid.spec.ts`: con pendientes, "Cerrar sesión" pide
      confirmación; cancelar deja la grilla y confirmar cierra la sesión; en Chromium, cerrar la
      página con pendientes dispara `beforeunload` — validates AC-16.
- [ ] `test-e2e-grid-clash` — `grid.spec.ts`: dos shows del viernes que se superponen al menos un
      minuto (elegidos por id desde `data/schedule.json`) muestran la marca en ambos — validates
      AC-17.
- [ ] `test-e2e-grid-edge-no-clash` — `grid.spec.ts`: dos shows del viernes que solo se tocan en el
      borde no muestran marca — validates AC-18.
- [ ] `test-e2e-grid-requires-session` — `grid.spec.ts`: sin sesión, `/` termina en `/login` —
      validates AC-19.
- [ ] `test-e2e-grid-min-height` — `grid.spec.ts`: en 360 y 430 px un show de 30 minutos mide al
      menos 44 px de alto — validates AC-28.
- [ ] `test-e2e-grid-names-two-lines` — `grid.spec.ts`: en 360 px, el nombre de cada show de 45
      minutos o más ocupa 2 líneas o menos y su fuente mide 12 px o más — validates NFR-04.
- [ ] `test-e2e-grid-no-store` — `grid.spec.ts`: la respuesta de `/` lleva `no-store` en
      `Cache-Control` (R-11).
- [ ] `test-e2e-grid-load-4g` — `performance.spec.ts`: con 4G simulado por CDP, desde la navegación
      a `/` hasta ver los bloques del día pasan 2000 ms o menos — validates NFR-01.
- [ ] `test-e2e-existing-suites` — `home.spec.ts`, `auth.spec.ts` y `demo.spec.ts` adaptados pasan
      en los 4 proyectos.

**Completion criterion**
`pnpm test:e2e` (o `pnpm test:e2e:docker`) pasa completo en los 4 proyectos, con la base migrada y
sembrada.

## Final verification
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` (pisos 80/70/80) pasan.
- `pnpm db:migrate && pnpm db:seed`, `pnpm test:integration` y `pnpm test:e2e` pasan.
- Los 20 AC de `prd-FEAT-003a.md` tienen al menos un test que los valida.
- A mano en un iPhone: la grilla abre en el viernes, se marca, se guarda y la marca de choque se ve.
