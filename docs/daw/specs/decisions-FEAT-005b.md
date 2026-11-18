# Decisiones de FEAT-005b fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque.

- `parseDemoClockMessage` acepta como "objeto plano" cualquier valor de `typeof "object"` que no sea `null` ni un array, sin exigir `Object.prototype`; por `postMessage` llega siempre un clon estructurado, así que un getter no puede cruzar el canal (hallazgo 3 del module-verifier sobre la frase "un objeto con getters" del threat model) — orquestador, mostrado al usuario (autonomy minimal) — 2026-11-18 — Block 1
- El tope superior de `shiftDemoClock` es el lunes 16 a las 05:45 (`DEMO_CLOCK_MAX − 15 min`) para cualquier corrimiento, no solo de ±15 — orquestador, mostrado al usuario (autonomy minimal) — 2026-11-18 — Block 1
- Los comentarios de código de `src/lib/demo-clock.ts` van en inglés, como `festival-time.ts` y `live-now.ts`; los nombres de los tests, en español como en la spec — orquestador, mostrado al usuario (autonomy minimal) — 2026-11-18 — Block 1
