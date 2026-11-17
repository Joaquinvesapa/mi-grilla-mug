import { describe, expect, it } from "vitest";

import { type SelectionMessageCode, selectionMessageFor } from "@/lib/selection-messages";

// `satisfies` makes a code missing from (or extra to) the exported union a compile error.
const CATALOG = {
  INVALID_SELECTION: "No pudimos guardar esa selección. Recargá la grilla y probá de nuevo.",
  UNAUTHENTICATED: "Tu sesión terminó. Volvé a iniciar sesión para guardar.",
  SERVICE_UNAVAILABLE: "No pudimos guardar. Probá de nuevo en un rato.",
  NETWORK_ERROR: "No pudimos guardar. Revisá tu conexión y probá de nuevo.",
  SCHEDULE_UNAVAILABLE: "No pudimos cargar la grilla. Probá de nuevo en un rato.",
} satisfies Record<SelectionMessageCode, string>;

describe("selectionMessageFor", () => {
  it("test-selection-messages: every code has its text and an unknown (invalid) code falls back to SERVICE_UNAVAILABLE", () => {
    for (const [code, text] of Object.entries(CATALOG)) {
      expect(selectionMessageFor(code)).toBe(text);
    }
    for (const unknown of ["", "NOPE", "toString", "__proto__", "P2002"]) {
      expect(selectionMessageFor(unknown)).toBe(CATALOG.SERVICE_UNAVAILABLE);
    }
  });
});
