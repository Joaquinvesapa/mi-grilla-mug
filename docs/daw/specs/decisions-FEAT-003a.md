# Decisiones de FEAT-003a fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque. En `autonomy: minimal`, "orquestador" quiere
decir que se mostró al usuario sin pedirle aprobación previa; cualquier objeción suya la revierte.

## Block 1 — Datos de la grilla, esquema y seed

- `seedSchedule(client, raw?, file?)` devuelve un resultado tipado y nunca lanza; sin `raw` lee el
  archivo con `loadSchedule(file)`, y un archivo inexistente, un JSON roto o una forma inválida dan
  `SCHEDULE_INVALID`. `main({ env?, connect? })` recibe el entorno y la conexión inyectables para
  los tests. — orquestador — 2026-11-17 — Block 1
- Corriendo como script, el seed carga `.env` con `process.loadEnvFile` si el archivo existe; las
  variables ya presentes en el entorno ganan, así que la CI no cambia. Sin esto `node prisma/seed.ts`
  no ve `DATABASE_URL` en local (no pasa por `prisma.config.ts`). — orquestador — 2026-11-17 —
  Block 1
- `SCHEDULE_INVALID` también cubre: `festival.timeZone` distinto de Buenos Aires, ids o posiciones
  repetidos, días sin nombre, fechas inexistentes, `subtitle` vacío, posiciones ≤ 0 y shows con fin
  igual o anterior al inicio (por eso un show que termine a las 06:00 o más tarde queda inválido;
  ninguno de la fuente lo hace). — orquestador — 2026-11-17 — Block 1
- El chequeo de huérfanos mira solo `shows` (el paso 4 de la spec); días y escenarios sobrantes no
  se controlan. — orquestador — 2026-11-17 — Block 1
- `festivalDayFor` recibe `Pick<FestivalDay, "id" | "date" | "position">[]`; fuera del festival usa
  el de menor `position` (el viernes) y con la lista vacía lanza `RangeError`. —
  orquestador — 2026-11-17 — Block 1
- `formatClock` recibe un `Date`; los Blocks 2 y 3 convierten los instantes ISO de
  `schedule-types.ts`. — orquestador — 2026-11-17 — Block 1
- El test de datos no exige que el `HHMM` del id coincida con `start` (los ids están congelados);
  hoy coinciden en los 91. — orquestador — 2026-11-17 — Block 1
- El punto de entrada del seed se decide con `isEntryPoint(process.argv[1], import.meta.url)` en vez
  de `import.meta.main` (que no existe en Node 24.0/24.1); por eso el seed importa también
  `node:path` y `node:url`, además de lo que lista la spec. — orquestador — 2026-11-17 — Block 1
- Un fallo de `client.end()` después del resultado se registra como `[seed] CLOSE_FAILED` (solo log,
  no es un código de resultado) y no cambia la salida. — orquestador — 2026-11-17 — Block 1
- `DATE_PATTERN` y `TIME_PATTERN` se exportan desde `src/lib/festival-time.ts` y `SeedCode` se
  compone con `UnsafeDatabaseUrlCode`, para no duplicar fuentes de verdad. — orquestador —
  2026-11-17 — Block 1
