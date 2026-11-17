import { describe, expect, it } from "vitest";

import {
  type AccountMessageCode,
  messageFor,
  PASSWORD_HINT,
  toFormState,
} from "@/lib/account-messages";
import { LOGIN_LOCK_MINUTES } from "@/lib/account-rules";

// `satisfies` makes a code missing from (or extra to) the exported union a compile error.
const CATALOG = {
  INVALID_EMAIL: "Ese email no es válido.",
  PASSWORD_TOO_SHORT: "La contraseña tiene que tener al menos 8 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña puede tener hasta 128 caracteres.",
  PASSWORD_NEEDS_LETTER: "La contraseña tiene que incluir al menos una letra.",
  PASSWORD_NEEDS_NUMBER: "La contraseña tiene que incluir al menos un número.",
  NAME_EMPTY: "Escribí tu nombre.",
  NAME_TOO_LONG: "El nombre puede tener hasta 40 caracteres.",
  EMAIL_TAKEN: "Ese email ya está registrado.",
  INVALID_CREDENTIALS: "Email o contraseña incorrectos",
  LOGIN_LOCKED:
    "Bloqueamos el acceso a este email por 15 minutos por demasiados intentos. Probá más tarde.",
  SERVICE_UNAVAILABLE: "No pudimos completar el pedido. Probá de nuevo en un rato.",
} satisfies Record<AccountMessageCode, string>;

const SERVICE_UNAVAILABLE_TEXT = CATALOG.SERVICE_UNAVAILABLE;
const PASSWORD = "secreta-Festival2026";

describe("account-messages", () => {
  it("test-messages-unknown-code-error: cada código del catálogo tiene su texto exacto", () => {
    for (const [code, text] of Object.entries(CATALOG)) {
      expect(messageFor(code)).toBe(text);
    }
  });

  it("test-messages-unknown-code-error: un código desconocido cae en el texto de SERVICE_UNAVAILABLE", () => {
    expect(messageFor("SOMETHING_ELSE")).toBe(SERVICE_UNAVAILABLE_TEXT);
    expect(messageFor("")).toBe(SERVICE_UNAVAILABLE_TEXT);
    // Object.prototype keys are not catalog entries.
    expect(messageFor("toString")).toBe(SERVICE_UNAVAILABLE_TEXT);
    expect(messageFor("__proto__")).toBe(SERVICE_UNAVAILABLE_TEXT);
  });

  it("test-messages-unknown-code-error: toFormState nunca incluye la contraseña (R-08)", () => {
    const values = { email: "ana@mail.com", password: PASSWORD, name: "Ana" };

    const taken = toFormState({ ok: false, code: "EMAIL_TAKEN" }, values);
    const invalid = toFormState(
      {
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { password: ["PASSWORD_NEEDS_NUMBER"] },
      },
      values,
    );

    for (const state of [taken, invalid]) {
      expect(JSON.stringify(state)).not.toContain(PASSWORD);
      expect(state.values).toEqual({ email: "ana@mail.com", name: "Ana" });
    }
  });

  it("el texto de ayuda de la contraseña y el bloqueo salen de las constantes de las reglas", () => {
    expect(PASSWORD_HINT).toBe("Al menos 8 caracteres, con una letra y un número.");
    expect(LOGIN_LOCK_MINUTES).toBe(15);
  });

  it("toFormState pone un error general con el texto del catálogo y sin errores por campo", () => {
    expect(
      toFormState(
        { ok: false, code: "INVALID_CREDENTIALS" },
        { email: "ana@mail.com", password: PASSWORD },
      ),
    ).toEqual({
      formError: "Email o contraseña incorrectos",
      fieldErrors: {},
      values: { email: "ana@mail.com", name: "" },
    });
  });

  it("toFormState con INVALID_INPUT deja cada mensaje bajo su campo, sin error general", () => {
    const state = toFormState(
      {
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: {
          email: ["INVALID_EMAIL"],
          password: ["PASSWORD_TOO_SHORT", "PASSWORD_NEEDS_NUMBER"],
          name: ["NAME_EMPTY"],
        },
      },
      { email: "ana@", password: "abc", name: "" },
    );

    expect(state).toEqual({
      formError: null,
      fieldErrors: {
        email: ["Ese email no es válido."],
        password: [
          "La contraseña tiene que tener al menos 8 caracteres.",
          "La contraseña tiene que incluir al menos un número.",
        ],
        name: ["Escribí tu nombre."],
      },
      values: { email: "ana@", name: "" },
    });
  });

  it("toFormState con un código desconocido muestra el aviso genérico", () => {
    expect(toFormState({ ok: false, code: "WHATEVER" }, {}).formError).toBe(
      SERVICE_UNAVAILABLE_TEXT,
    );
  });
});
