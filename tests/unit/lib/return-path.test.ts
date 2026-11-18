import { describe, expect, it } from "vitest";

import { safeReturnPath, withReturnPath } from "@/lib/return-path";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const INVITATION = `/invitacion/${TOKEN}`;

describe("safeReturnPath", () => {
  it("acepta exactamente /invitacion/<token>", () => {
    expect(safeReturnPath(INVITATION)).toBe(INVITATION);
  });

  it("return-path: rechaza URLs externas, //, otras rutas, arrays y tokens inválidos", () => {
    const rejected: unknown[] = [
      // External or protocol-relative destinations (R-10).
      `https://evil.example${INVITATION}`,
      `//evil.example${INVITATION}`,
      `/\\evil.example${INVITATION}`,
      `\\\\evil.example${INVITATION}`,
      "javascript:alert(1)",
      // Other routes of the app, or the invitation with something around it.
      "/",
      "/grupos",
      "/invitacion/",
      `${INVITATION}/`,
      `${INVITATION}?x=1`,
      `${INVITATION}#x`,
      ` ${INVITATION}`,
      `${INVITATION}\n`,
      `/invitacion/../grupos/${TOKEN}`,
      encodeURIComponent(INVITATION),
      `/invitacion%2F${TOKEN}`,
      // Tokens of the wrong length or alphabet.
      `/invitacion/${TOKEN.slice(1)}`,
      `/invitacion/${TOKEN}A`,
      `/invitacion/${TOKEN.slice(1)}=`,
      `/invitacion/${TOKEN.slice(1)}+`,
      // Anything that is not a string: `searchParams` gives an array for a repeated key.
      [INVITATION],
      [INVITATION, INVITATION],
      undefined,
      null,
      42,
      { toString: () => INVITATION },
    ];

    for (const value of rejected) {
      expect(safeReturnPath(value), JSON.stringify(value)).toBeNull();
    }
  });
});

describe("withReturnPath", () => {
  it("sin destino deja la ruta tal cual", () => {
    expect(withReturnPath("/login", null)).toBe("/login");
    expect(withReturnPath("/register", null)).toBe("/register");
  });

  it("con destino lo lleva codificado en next", () => {
    const href = withReturnPath("/register", INVITATION);

    expect(href).toBe(`/register?next=%2Finvitacion%2F${TOKEN}`);
    expect(new URL(href, "http://localhost").searchParams.get("next")).toBe(INVITATION);
  });
});
