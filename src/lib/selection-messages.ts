/**
 * The Spanish texts for the selection codes: the ones `src/server` returns, `USER_MISMATCH` (the
 * action's guard against syncing one account's pending selection into another), plus
 * `SCHEDULE_UNAVAILABLE` (the screen could not load the grid) and `STORAGE_UNAVAILABLE` (the device
 * would not keep a selection saved without a connection). `NETWORK_ERROR` stays in the catalog but
 * nothing in `src/` uses it since FEAT-003b: a save that gets no answer is now kept on the device as
 * a pending selection instead of failing. Pure: no I/O. The server only returns codes, so no message from Prisma or `pg`
 * can reach the screen (R-05).
 */

export type SelectionMessageCode =
  | "INVALID_SELECTION"
  | "UNAUTHENTICATED"
  | "SERVICE_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "SCHEDULE_UNAVAILABLE"
  | "USER_MISMATCH"
  | "STORAGE_UNAVAILABLE";

const CATALOG = {
  INVALID_SELECTION: "No pudimos guardar esa selección. Recargá la grilla y probá de nuevo.",
  UNAUTHENTICATED: "Tu sesión terminó. Volvé a iniciar sesión para guardar.",
  SERVICE_UNAVAILABLE: "No pudimos guardar. Probá de nuevo en un rato.",
  NETWORK_ERROR: "No pudimos guardar. Revisá tu conexión y probá de nuevo.",
  SCHEDULE_UNAVAILABLE: "No pudimos cargar la grilla. Probá de nuevo en un rato.",
  USER_MISMATCH: "Entraste con otra cuenta. Recargá la grilla para seguir.",
  STORAGE_UNAVAILABLE:
    "No pudimos guardar: no hay conexión y este celular no dejó guardar los cambios.",
} as const satisfies Record<SelectionMessageCode, string>;

// A Map, so `toString` or `__proto__` are not catalog entries.
const MESSAGES: ReadonlyMap<string, string> = new Map(Object.entries(CATALOG));

/** The catalog text for a code; anything outside the catalog reads as `SERVICE_UNAVAILABLE`. */
export function selectionMessageFor(code: string): string {
  return MESSAGES.get(code) ?? CATALOG.SERVICE_UNAVAILABLE;
}

/** "1 cambio sin guardar", "3 cambios sin guardar": the pending notice and the sign-out warning. */
export function pendingChangesLabel(count: number): string {
  return `${count} ${count === 1 ? "cambio" : "cambios"} sin guardar`;
}

/** The notice while a selection is saved only on this device (FR-04). */
export const OFFLINE_PENDING_TITLE = "Guardado solo en este celular";

// The wallpaper (FEAT-004) is "Descargar fondo", next to the days: it works offline too.
export const OFFLINE_PENDING_BODY =
  "Tus cambios se suben solos cuando vuelva la conexión. Mientras tanto, descargá la grilla como fondo de pantalla para tenerla a mano.";
