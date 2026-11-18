# Decisiones de FEAT-005a fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque. En `autonomy: minimal`, "orquestador" quiere
decir que se mostró al usuario sin pedirle aprobación previa; cualquier objeción suya la revierte.

## PLAN — auditoría de arquitectura (15 hallazgos)

La spec quedó en 2 de 3 vueltas de corrección (F-SPEC-LOOP), así que los hallazgos que entran en lo
que la spec ya dice se resuelven en los bloques y se registran acá, en vez de reescribirla.

- **Pendiente de confirmación del usuario — texto de AC-11 (hallazgo 2, G6).** El PRD escribe
  "Tobika en Samsung Stage" y la app llama al escenario "Samsung" (glosario de `AGENTS.md`,
  `data/schedule.json`). Se muestra `stage.name`: "Sigue hoy a las 13:45 — Tobika en Samsung",
  como AC-05 de FEAT-003a, que nombró "Samsung Stage" al escenario y se verificó con el nombre de la
  app. Si el usuario prefiere el texto literal, es un cambio de copy en `live-messages.ts` y su test.
  — orquestador — 2026-11-18 — Block 1
- El botón "En vivo" es el `Button` de shadcn (`src/components/ui/button.tsx`, que ya trae
  `usePressed`, foco y variantes) dentro de `DrawerTrigger asChild`, con
  `size-14 rounded-full absolute`, como `WallpaperButton` y `AppMenu`. "Cerrar" es
  `DrawerClose asChild` + `Button` de ícono (`X` de lucide, `size-11`, `aria-label="Cerrar"`), así
  el texto no desborda los 44 px (hallazgos 1 y 7). — orquestador — 2026-11-18 — Block 3
- La regla `[data-live-panel]` queda como dice la spec, sin capa y con `!important`: le gana a la
  regla sin capa de Vaul y al `transition` que Vaul escribe en línea sin `!important`. Lleva un
  comentario con el motivo y el atributo es exclusivo del panel "En vivo" (hallazgos 3 y 4). Block 4
  suma el swipe en WebKit para verificar que el arrastre sigue al dedo. — orquestador — 2026-11-18 —
  Block 3, Block 4
- `useNow` guarda la hora en `useState` (inicial perezosa con `Date.now()`), y el temporizador
  vuelve a leer `Date.now()` al disparar y re-agenda al minuto siguiente con 50 ms de margen, para
  que un disparo 1 ms antes no pierda el cambio de minuto. `liveNow` se calcula solo con el panel
  abierto (hallazgo 5). — orquestador — 2026-11-18 — Block 2, Block 3
- El botón queda dentro de `DayPicker` (tabpanel del día), en el wrapper de la grilla, como dice la
  spec: es lo que lo ancla al área de la grilla y arriba de la barra de pendientes. Sin `day`, no
  hay grilla ni botón (hallazgo 6). — orquestador — 2026-11-18 — Block 3
- `LIVE_BUTTON_CLEARANCE_PX` se exporta desde `schedule-grid.tsx` como dice la spec, con un
  comentario que la ata al tamaño del botón (56 px) en `live-button.tsx` (hallazgo 8). —
  orquestador — 2026-11-18 — Block 3
- El margen derecho del botón queda en `max(1rem, env(safe-area-inset-right))`: en vertical, que es
  el uso de la app, el inset derecho es 0 (hallazgo 9). — orquestador — 2026-11-18 — Block 3
- Los textos "En vivo", "Cerrar" y "Elegido" van a `src/lib/live-messages.ts`; el botón se nombra
  solo con su `aria-label` (hallazgo 10). — orquestador — 2026-11-18 — Block 1, Block 3
- Los tests unitarios de AC-01 y AC-24 afirman la estructura y las clases (jsdom no calcula
  layout); la medición real queda en Block 4 (hallazgo 11). — orquestador — 2026-11-18 — Block 3
- AC-22 en E2E es gate en `iphone-webkit`. Si falla por ruido del contenedor de la CI, se reporta y
  la evidencia manual en un iPhone real de VERIFY decide (hallazgo 12). — orquestador —
  2026-11-18 — Block 4
- Sin `aria-live` en el panel: un anuncio por minuto sería ruido. El ícono `Check` va con
  `aria-hidden` y el texto oculto "Elegido" (hallazgo 13). — orquestador — 2026-11-18 — Block 3
- El test de AC-14 en unit se mantiene; la prueba que pesa es la E2E con `timezoneId` (hallazgo
  14). — orquestador — 2026-11-18 — Block 1
- `festivalDayAt(now: Date, days)`, la misma forma que `festivalDayFor` (hallazgo 15). —
  orquestador — 2026-11-18 — Block 1
