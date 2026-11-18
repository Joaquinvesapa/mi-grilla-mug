import { describe, expect, it } from "vitest";

import {
  formatInviteExpiry,
  type GroupMessageCode,
  groupMessageFor,
  joinGroupMessageFor,
} from "@/lib/group-messages";

// `satisfies` makes a code missing from (or extra to) the exported union a compile error.
const CATALOG = {
  INVALID_NAME: "El nombre tiene que tener entre 1 y 40 caracteres.",
  USER_GROUP_LIMIT: "Ya estás en 10 grupos, el máximo.",
  GROUP_FULL: "El grupo está completo (20 integrantes).",
  INVALID_INVITE: "Este link de invitación ya no es válido. Pedile uno nuevo a alguien del grupo.",
  NOT_FOUND: "No encontramos ese grupo.",
  NOT_ADMIN: "Solo quien administra el grupo puede generar un link nuevo.",
  UNAUTHENTICATED: "Tu sesión terminó. Volvé a iniciar sesión.",
  SERVICE_UNAVAILABLE: "No pudimos guardar. Probá de nuevo en un rato.",
} satisfies Record<GroupMessageCode, string>;

describe("group-messages", () => {
  it("group-messages: vencimiento en hora de Argentina y texto de cada código", () => {
    for (const [code, text] of Object.entries(CATALOG)) {
      expect(groupMessageFor(code)).toBe(text);
    }
    for (const unknown of ["", "NOPE", "toString", "__proto__", "P2002"]) {
      expect(groupMessageFor(unknown)).toBe(CATALOG.SERVICE_UNAVAILABLE);
    }
    // Joining has its own generic error; every other code reads the same.
    expect(joinGroupMessageFor("SERVICE_UNAVAILABLE")).toBe(
      "No pudimos unirte. Probá de nuevo en un rato.",
    );
    expect(joinGroupMessageFor("NOPE")).toBe("No pudimos unirte. Probá de nuevo en un rato.");
    expect(joinGroupMessageFor("GROUP_FULL")).toBe(CATALOG.GROUP_FULL);
    expect(joinGroupMessageFor("USER_GROUP_LIMIT")).toBe(CATALOG.USER_GROUP_LIMIT);
    expect(joinGroupMessageFor("INVALID_INVITE")).toBe(CATALOG.INVALID_INVITE);

    // 06:15 UTC on Friday 21/11/2025 is 03:15 in Buenos Aires (UTC−3), whatever the runner's zone.
    expect(formatInviteExpiry(new Date("2025-11-21T06:15:00.000Z"))).toBe(
      "Vence el viernes 21/11 a las 03:15",
    );
    // 02:30 UTC on Sunday is still Saturday 23:30 in Argentina.
    expect(formatInviteExpiry(new Date("2026-03-15T02:30:00.000Z"))).toBe(
      "Vence el sábado 14/03 a las 23:30",
    );
    // Midnight is 00, not 24.
    expect(formatInviteExpiry(new Date("2026-03-14T03:00:00.000Z"))).toBe(
      "Vence el sábado 14/03 a las 00:00",
    );
  });
});
