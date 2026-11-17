import { beforeEach, describe, expect, it, vi } from "vitest";

// A successful sign-in writes the session cookie through next/headers' cookies().
vi.mock("next/headers", async () => (await import("./next-cookie-jar")).nextHeadersModule);

import { createAccounts } from "@/server/accounts";
import { getAuth } from "@/server/auth";
import { getDb } from "@/server/db";
import { createLoginThrottle } from "@/server/login-throttle";

import { clearCookies } from "./next-cookie-jar";

const PASSWORD = "festival2026";
const WRONG_PASSWORD = "equivocada2026";
const MINUTE_MS = 60_000;
const START = new Date("2026-03-13T20:00:00.000Z").getTime();

/** A throttle and an accounts service over the real database and Better Auth, on a clock we move. */
function harness() {
  let clock = START;
  const throttle = createLoginThrottle({ db: getDb(), now: () => new Date(clock) });
  const accounts = createAccounts({ auth: getAuth(), throttle, log: () => {} });
  return {
    throttle,
    accounts,
    advance(ms: number) {
      clock += ms;
    },
    signIn(email: string, password: string) {
      return accounts.signIn({ email, password }, new Headers());
    },
  };
}

async function registerAna(accounts: ReturnType<typeof harness>["accounts"]) {
  const result = await accounts.registerAccount(
    { email: "ana@mail.com", password: PASSWORD, name: "Ana" },
    new Headers(),
  );
  expect(result).toStrictEqual({ ok: true });
  clearCookies();
}

beforeEach(() => {
  clearCookies();
});

describe("login throttle", () => {
  it("test-lockout-after-five-failures: the 6th attempt is LOGIN_LOCKED even with the right password", async () => {
    const h = harness();
    await registerAna(h.accounts);

    for (let i = 0; i < 5; i += 1) {
      expect(await h.signIn("ana@mail.com", WRONG_PASSWORD)).toStrictEqual({
        ok: false,
        code: "INVALID_CREDENTIALS",
      });
      h.advance(2 * MINUTE_MS);
    }

    expect(await h.signIn("Ana@Mail.com", PASSWORD)).toStrictEqual({
      ok: false,
      code: "LOGIN_LOCKED",
    });

    // An email without an account is counted and locked the same way (R-09).
    for (let i = 0; i < 5; i += 1) {
      expect(await h.signIn("nadie@mail.com", WRONG_PASSWORD)).toStrictEqual({
        ok: false,
        code: "INVALID_CREDENTIALS",
      });
    }
    expect(await h.signIn("nadie@mail.com", WRONG_PASSWORD)).toStrictEqual({
      ok: false,
      code: "LOGIN_LOCKED",
    });
  });

  it("test-lockout-expires: still locked at 14 min 59 s, the right password works again at 15 min", async () => {
    const h = harness();
    await registerAna(h.accounts);
    for (let i = 0; i < 5; i += 1) {
      await h.signIn("ana@mail.com", WRONG_PASSWORD);
    }

    h.advance(14 * MINUTE_MS + 59_000);
    expect(await h.signIn("ana@mail.com", PASSWORD)).toStrictEqual({
      ok: false,
      code: "LOGIN_LOCKED",
    });

    h.advance(1_000);
    expect(await h.signIn("ana@mail.com", PASSWORD)).toStrictEqual({ ok: true });
    // A successful sign-in clears the email's row.
    expect(await getDb().loginThrottle.findUnique({ where: { email: "ana@mail.com" } })).toBeNull();
  });

  it("test-lockout-concurrent-rejected: 10 parallel reservations accept exactly 5", async () => {
    const { throttle } = harness();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => throttle.reserve("ana@mail.com")),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(5);
    expect(results.filter((result) => !result.ok)).toStrictEqual(
      Array.from({ length: 5 }, () => ({ ok: false, code: "LOGIN_LOCKED" })),
    );
    const row = await getDb().loginThrottle.findUnique({ where: { email: "ana@mail.com" } });
    expect(row?.attempts).toBe(5);
  });

  it("test-lockout-window-resets: 4 failures, 16 quiet minutes and 4 more do not lock; the purge drops expired rows", async () => {
    const h = harness();
    await registerAna(h.accounts);
    for (let i = 0; i < 4; i += 1) {
      await h.signIn("ana@mail.com", WRONG_PASSWORD);
    }
    await h.signIn("otra@mail.com", WRONG_PASSWORD);
    expect(await getDb().loginThrottle.count({ where: { email: "otra@mail.com" } })).toBe(1);

    h.advance(16 * MINUTE_MS);
    for (let i = 0; i < 4; i += 1) {
      expect(await h.signIn("ana@mail.com", WRONG_PASSWORD)).toStrictEqual({
        ok: false,
        code: "INVALID_CREDENTIALS",
      });
    }

    const row = await getDb().loginThrottle.findUnique({ where: { email: "ana@mail.com" } });
    expect(row?.attempts).toBe(4);
    expect(row?.lockedUntil).toBeNull();
    expect(row?.windowStartedAt.getTime()).toBe(START + 16 * MINUTE_MS);
    // otra@mail.com's window expired without a lock: the next failure's purge removed it (R-12).
    expect(await getDb().loginThrottle.count({ where: { email: "otra@mail.com" } })).toBe(0);
    expect(await h.signIn("ana@mail.com", PASSWORD)).toStrictEqual({ ok: true });
  });
});
