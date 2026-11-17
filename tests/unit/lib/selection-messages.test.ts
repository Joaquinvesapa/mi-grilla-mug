import { describe, expect, it } from "vitest";

import {
  OFFLINE_PENDING_BODY,
  OFFLINE_PENDING_TITLE,
  pendingChangesLabel,
  type SelectionMessageCode,
  selectionMessageFor,
} from "@/lib/selection-messages";

// `satisfies` makes a code missing from (or extra to) the exported union a compile error.
const CATALOG = {
  INVALID_SELECTION: "No pudimos guardar esa selección. Recargá la grilla y probá de nuevo.",
  UNAUTHENTICATED: "Tu sesión terminó. Volvé a iniciar sesión para guardar.",
  SERVICE_UNAVAILABLE: "No pudimos guardar. Probá de nuevo en un rato.",
  NETWORK_ERROR: "No pudimos guardar. Revisá tu conexión y probá de nuevo.",
  SCHEDULE_UNAVAILABLE: "No pudimos cargar la grilla. Probá de nuevo en un rato.",
  USER_MISMATCH: "Entraste con otra cuenta. Recargá la grilla para seguir.",
  STORAGE_UNAVAILABLE:
    "No pudimos guardar: no hay conexión y este celular no dejó guardar los cambios.",
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

describe("new codes and the offline notice", () => {
  it("test-messages-new-codes: USER_MISMATCH and STORAGE_UNAVAILABLE have their own texts, and the notice its title and body", () => {
    expect(selectionMessageFor("USER_MISMATCH")).toBe(
      "Entraste con otra cuenta. Recargá la grilla para seguir.",
    );
    expect(selectionMessageFor("STORAGE_UNAVAILABLE")).toBe(
      "No pudimos guardar: no hay conexión y este celular no dejó guardar los cambios.",
    );
    expect(OFFLINE_PENDING_TITLE).toBe("Guardado solo en este celular");
    expect(OFFLINE_PENDING_BODY).toBe(
      "Tus cambios se suben solos cuando vuelva la conexión. Mientras tanto, descargá la grilla como fondo de pantalla para tenerla a mano.",
    );
  });
});

describe("pendingChangesLabel", () => {
  it("cuenta los cambios sin guardar en singular y en plural", () => {
    expect(pendingChangesLabel(1)).toBe("1 cambio sin guardar");
    expect(pendingChangesLabel(2)).toBe("2 cambios sin guardar");
    expect(pendingChangesLabel(12)).toBe("12 cambios sin guardar");
  });
});
