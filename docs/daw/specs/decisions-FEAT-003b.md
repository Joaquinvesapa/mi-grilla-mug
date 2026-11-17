# Decisiones de FEAT-003b fuera de la spec

Formato: decisión — quién la aprobó — fecha — bloque. En `autonomy: minimal`, "orquestador" quiere
decir que se mostró al usuario sin pedirle aprobación previa; cualquier objeción suya la revierte.

## Block 1 — Copia y pendiente en el dispositivo

- `parseSnapshot` valida además la forma de cada día, escenario y show de la copia (tipos de sus
  campos según `schedule-types.ts`), porque la copia va directo a `ScheduleScreen` (R-02). —
  orquestador — 2026-11-17 — Block 1
- `parseSnapshot`/`parsePending` devuelven un objeto nuevo solo con los campos conocidos. —
  orquestador — 2026-11-17 — Block 1
- `savedAt` válido = ISO 8601 con `Z` u offset y `Date.parse` distinto de NaN (V8 acepta días
  imposibles como el 30 de febrero; es un dato informativo). — orquestador — 2026-11-17 — Block 1
- `clearSnapshot`/`clearPending` devuelven el mismo resultado tipado que las escrituras. —
  orquestador — 2026-11-17 — Block 1

## Block 2 — Guardar sin conexión y sincronizar

- El mensaje de una sincronización rechazada (`INVALID_SELECTION`, `USER_MISMATCH`) va en una franja
  propia `role="alert"` debajo de la barra, porque el aviso de pendientes desaparece al volver a lo
  confirmado; se limpia en el próximo "Guardar". — orquestador — 2026-11-17 — Block 2
- Con `USER_MISMATCH` la pantalla no vuelve a sincronizar en ese montaje. — orquestador —
  2026-11-17 — Block 2
- Mientras sincroniza, la barra muestra "Guardando…" y deshabilita también "Descartar" (reusa la
  prop `saving` de `PendingBar`). — orquestador — 2026-11-17 — Block 2
- Sin conexión también se deshabilita "Salir sin guardar" del diálogo, con el mismo motivo visible.
  — orquestador — 2026-11-17 — Block 2
- La pendiente se adopta durante el render una vez hidratado (flag por `useSyncExternalStore`) y la
  sincronización usa un segundo `useTransition`; oxlint prohíbe `setState` dentro de un efecto. —
  orquestador — 2026-11-17 — Block 2
- Un único `ref` `inFlight` compartido entre `save()` y `sync()`: ninguno arranca si el otro está en
  curso (R-05). — orquestador — 2026-11-17 — Block 2
- `NETWORK_ERROR` queda en el catálogo de mensajes sin uso en `src/` (la spec conserva los códigos
  de FEAT-003a). — orquestador — 2026-11-17 — Block 2
