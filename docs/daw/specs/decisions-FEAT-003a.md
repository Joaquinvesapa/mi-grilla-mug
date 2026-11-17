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

## Block 2 — Lógica de la grilla y servicios de selección

- `dayAxis`, `blockGeometry` y `findClashes` reciben los `Show` de `schedule-types.ts` (instantes
  ISO), y el eje y `hourMarks` devuelven `Date`, que es lo que recibe `formatClock`. "Hora entera
  anterior/posterior" es floor/ceil: un inicio o fin en punto se conserva (el offset −03:00 es de
  horas enteras). `dayAxis([])` lanza `RangeError`. — orquestador — 2026-11-17 — Block 2
- `saveSelection` chequea `Array.isArray` antes de leer la grilla; si `getSchedule()` falla devuelve
  `SERVICE_UNAVAILABLE` sin una línea `[selection]` propia, porque el fallo ya quedó registrado como
  `[schedule] SERVICE_UNAVAILABLE at=…` con código y hora (R-05). — orquestador — 2026-11-17 —
  Block 2
- Si el `SELECT … FOR UPDATE` no encuentra al usuario (borrado entre la verificación de sesión y el
  guardado), la transacción hace rollback y devuelve `SERVICE_UNAVAILABLE`: sin ese chequeo un
  guardado vacío de un usuario borrado daría `ok: true`. — orquestador — 2026-11-17 — Block 2
- Los servicios se arman con fábricas inyectables (`createScheduleService`,
  `createSelectionService`) y las funciones de la spec usan una instancia compartida, como
  `createAccounts`/`getAccounts`; la memoización vive en esa instancia. — orquestador —
  2026-11-17 — Block 2
- `getSelection` devuelve los ids ordenados por id, sin memoizar. — orquestador — 2026-11-17 —
  Block 2
- R-10: además del test de integración, el verificador corrió la misma secuencia SQL sin el
  `FOR UPDATE` contra la base local y obtuvo mezcla en 10 de 10 rondas (con el lock, 0 de 10). —
  orquestador — 2026-11-17 — Block 2

## Block 3 — Pantalla de la grilla

- Los componentes de shadcn (`tabs`, `alert-dialog`, `drawer`) se adaptaron como en FEAT-002
  (primitivos Radix sueltos, `cn` de `@/lib/utils`), sin las variantes `dark:` (tema oscuro único)
  y sin las clases `animate-in`/`animate-out`, que dependen de `tw-animate-css` (no instalado).
  Tabs con triggers de 44 px; el drawer se renderiza fuera de `.app-shell`, así que lleva su propio
  inset inferior. — orquestador — 2026-11-17 — Block 3
- `ScheduleScreen` y `AppMenu` reciben `saveAction`/`logoutAction` por prop (como los formularios de
  FEAT-002); `page.tsx` les pasa las reales y `src/components` no importa tipos de `src/app`. —
  orquestador — 2026-11-17 — Block 3
- "Salir sin guardar" es un `Button type="submit"` dentro del `<form action={logoutAction}>`, no un
  `AlertDialogAction` (que cierra el diálogo y desmontaría el form antes del submit); el AlertDialog
  va anidado dentro del drawer y "Seguir editando" vuelve al menú. — orquestador — 2026-11-17 —
  Block 3
- `data-vaul-no-drag` va en un contenedor que envuelve `InstallGuide` y "Cerrar sesión", sin
  modificar `InstallGuide`. — orquestador — 2026-11-17 — Block 3
- La marca "sin guardar" es un punto visual con `data-pending` y una descripción accesible "Sin
  guardar". El borrador se manda ordenado por id; el error se limpia al guardar, al descartar y
  cuando el borrador vuelve a igualar lo guardado. — orquestador — 2026-11-17 — Block 3
- `page.tsx` carga grilla y selección en paralelo; una grilla sin días se trata como un fallo de
  carga (`SCHEDULE_UNAVAILABLE`). El test de la página vive en `tests/unit/app/home-page.test.tsx`.
  — orquestador — 2026-11-17 — Block 3
- NFR-04 (hallado por `test-e2e-grid-names-two-lines` del Block 4): con 13 px semibold y la columna
  de la spec, tres nombres de Kidzapalooza ocupaban 3 líneas a 360 px. Sin tocar lo que fija la
  spec, el bloque reduce su aire lateral (`inset-x-px`, `px-1`: 92 px útiles para el nombre) y el
  nombre suma `tracking-[-0.01em]` y `hyphens-auto` (con `overflow-wrap:anywhere` de respaldo). —
  orquestador — 2026-11-17 — Block 3 (corrección desde Block 4)
- Para que NFR-04 valga también con la marca de choque, el ícono (`TriangleAlert`, 12 px, relleno
  gold con contorno `rp-base`) va en la línea del horario y no le quita ancho al nombre; el horario
  suma `tracking-[-0.03em]` para dejarle lugar. La marca "sin guardar" pasa de un punto a
  `border-dashed` en el bloque, porque el punto caía sobre el ícono en bloques cortos. Medido a
  360 px en WebKit y Chromium con los 91 shows elegidos. — orquestador — 2026-11-17 — Block 3
  (corrección desde Block 4)
- `toggle` vuelve a la actualización funcional del borrador (dos toques antes de un render se
  pisaban: quedaba solo el último) y la limpieza del error viejo pasa al render como estado
  derivado. — orquestador — 2026-11-17 — Block 3 (corrección desde Block 4)
- Límite conocido, fuera de NFR-04: en los shows de 20 minutos (bloques de 44 px, AC-28), nombre y
  horario no entran completos; AC-28 solo exige la altura mínima. — orquestador — 2026-11-17 —
  Block 3
