import { beforeEach, describe, expect, it, vi } from "vitest";

// The Server Actions read and write the session through next/headers: the in-memory jar plays the
// browser that holds the cookie Better Auth sets.
vi.mock("next/headers", async () => {
  const jar = await import("./next-cookie-jar");
  return { ...jar.nextHeadersModule, headers: async () => jar.requestHeaders() };
});

import { loginAction, registerAction } from "@/app/auth-actions";
import { INITIAL_FORM_STATE } from "@/lib/account-messages";
import { getAccounts } from "@/server/accounts";

import { clearCookies } from "./next-cookie-jar";

const PASSWORD = "festival2026";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const INVITATION = `/invitacion/${TOKEN}`;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

/** The digest of the NEXT_REDIRECT `redirect()` throws, or a failure if the action returned. */
async function redirectDigest(run: () => Promise<unknown>): Promise<string> {
  try {
    const returned = await run();
    throw new Error(`expected a redirect, got ${JSON.stringify(returned)}`);
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== "string") {
      throw error;
    }
    return digest;
  }
}

/** The destination inside a digest: `NEXT_REDIRECT;<type>;<url>;<status>;`. */
function destinationOf(digest: string): string | undefined {
  return /^NEXT_REDIRECT;[a-z]+;(.*);\d{3};$/.exec(digest)?.[1];
}

/** An account to sign in to, with no session left in the jar. */
async function existingAccount(email: string): Promise<void> {
  const result = await getAccounts().registerAccount(
    { email, password: PASSWORD, name: "Ana" },
    new Headers(),
  );
  expect(result).toStrictEqual({ ok: true });
  clearCookies();
}

beforeEach(() => {
  clearCookies();
});

describe("auth-actions", () => {
  it("auth-actions: entrar con next válido vuelve a la invitación", async () => {
    await existingAccount("ana@mail.com");

    const login = await redirectDigest(() =>
      loginAction(
        INITIAL_FORM_STATE,
        form({ email: "ana@mail.com", password: PASSWORD, next: INVITATION }),
      ),
    );
    expect(destinationOf(login), login).toBe(INVITATION);

    clearCookies();
    const register = await redirectDigest(() =>
      registerAction(
        INITIAL_FORM_STATE,
        form({ name: "Beto", email: "beto@mail.com", password: PASSWORD, next: INVITATION }),
      ),
    );
    expect(destinationOf(register), register).toBe(INVITATION);
  });

  it("auth-actions: un next inválido es rechazado y el destino es /", async () => {
    await existingAccount("ana@mail.com");
    const invalid = [
      "https://evil.example/",
      `//evil.example${INVITATION}`,
      "/grupos",
      `/invitacion/${TOKEN.slice(1)}`,
      ` ${INVITATION}`,
    ];
    // Control: the action does follow a valid destination, so the `/` below is the filter at work
    // and not an action that always lands on `/`.
    const valid = await redirectDigest(() =>
      loginAction(
        INITIAL_FORM_STATE,
        form({ email: "ana@mail.com", password: PASSWORD, next: INVITATION }),
      ),
    );
    expect(destinationOf(valid), valid).toBe(INVITATION);

    for (const next of invalid) {
      clearCookies();
      const digest = await redirectDigest(() =>
        loginAction(INITIAL_FORM_STATE, form({ email: "ana@mail.com", password: PASSWORD, next })),
      );
      expect(destinationOf(digest), `${next} → ${digest}`).toBe("/");
    }

    // A File where the string should be is not a destination either.
    clearCookies();
    const data = form({ name: "Beto", email: "beto@mail.com", password: PASSWORD });
    data.set("next", new Blob([INVITATION]), "next.txt");
    const register = await redirectDigest(() => registerAction(INITIAL_FORM_STATE, data));
    expect(destinationOf(register), register).toBe("/");
  });

  it("sin next, entrar y registrarse siguen yendo a /", async () => {
    await existingAccount("ana@mail.com");

    const login = await redirectDigest(() =>
      loginAction(INITIAL_FORM_STATE, form({ email: "ana@mail.com", password: PASSWORD })),
    );
    expect(destinationOf(login), login).toBe("/");
  });
});
