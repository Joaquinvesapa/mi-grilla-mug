/**
 * The Spanish texts for the selection codes: the ones `src/server` returns, plus `NETWORK_ERROR`
 * (only the client knows the call never arrived) and `SCHEDULE_UNAVAILABLE` (the screen could not
 * load the grid). Pure: no I/O. The server only returns codes, so no message from Prisma or `pg`
 * can reach the screen (R-05).
 */

export type SelectionMessageCode =
  | "INVALID_SELECTION"
  | "UNAUTHENTICATED"
  | "SERVICE_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "SCHEDULE_UNAVAILABLE";

const CATALOG = {
  INVALID_SELECTION: "No pudimos guardar esa selección. Recargá la grilla y probá de nuevo.",
  UNAUTHENTICATED: "Tu sesión terminó. Volvé a iniciar sesión para guardar.",
  SERVICE_UNAVAILABLE: "No pudimos guardar. Probá de nuevo en un rato.",
  NETWORK_ERROR: "No pudimos guardar. Revisá tu conexión y probá de nuevo.",
  SCHEDULE_UNAVAILABLE: "No pudimos cargar la grilla. Probá de nuevo en un rato.",
} as const satisfies Record<SelectionMessageCode, string>;

// A Map, so `toString` or `__proto__` are not catalog entries.
const MESSAGES: ReadonlyMap<string, string> = new Map(Object.entries(CATALOG));

/** The catalog text for a code; anything outside the catalog reads as `SERVICE_UNAVAILABLE`. */
export function selectionMessageFor(code: string): string {
  return MESSAGES.get(code) ?? CATALOG.SERVICE_UNAVAILABLE;
}
