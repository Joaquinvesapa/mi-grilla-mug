import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Better Auth's nextCookies() writes the session cookie through next/headers' cookies().
vi.mock("next/headers", async () => (await import("./next-cookie-jar")).nextHeadersModule);

import { getAccounts } from "@/server/accounts";
import { getDb } from "@/server/db";
import { sessionCookieOptions } from "@/server/session-cookie";

import { clearCookies, readCookie, requestHeaders } from "./next-cookie-jar";

const PASSWORD = "festival2026";
const DAY_MS = 86_400_000;
const THIRTY_DAYS_MS = 30 * DAY_MS;
const LATENCY_BUDGET_MS = 1_000;

function sessionCookieName(): string {
  return sessionCookieOptions(process.env.BETTER_AUTH_URL ?? "").sessionCookieName;
}

/** The session token inside the signed cookie (`token.signature`, URL-encoded). */
function sessionTokenFromJar(): string {
  const raw = readCookie(sessionCookieName());
  expect(raw, "session cookie in the jar").toBeDefined();
  const [token = ""] = decodeURIComponent(raw ?? "").split(".");
  return token;
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

async function register(email: string, name = "Ana", password = PASSWORD) {
  return getAccounts().registerAccount({ email, password, name }, new Headers());
}

beforeEach(() => {
  clearCookies();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("registerAccount", () => {
  it("test-register-ok: creates the account with a lowercase email and a trimmed name, and signs in", async () => {
    const result = await register("  Ana@Mail.com ", "  Ana  ");

    expect(result).toStrictEqual({ ok: true });
    const users = await getDb().user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: "ana@mail.com", name: "Ana" });
    const token = sessionTokenFromJar();
    const session = await getDb().session.findUnique({ where: { token } });
    expect(session?.userId).toBe(users[0]?.id);
  });

  it("test-register-duplicate-rejected: the same email in other case is EMAIL_TAKEN and leaves one row", async () => {
    expect(await register("ana@mail.com")).toStrictEqual({ ok: true });

    const second = await register("Ana@Mail.com", "Otra Ana");

    expect(second).toStrictEqual({ ok: false, code: "EMAIL_TAKEN" });
    expect(await getDb().user.count()).toBe(1);
  });

  it("test-password-hashed: stores a scrypt hash, and no log nor result carries the password", async () => {
    const secret = "secreto2026Ñandú";
    const logged: string[] = [];
    for (const level of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(" "));
      });
    }

    const results = [
      await register("ana@mail.com", "Ana", secret),
      await register("ana@mail.com", "Ana", secret),
      await getAccounts().signIn({ email: "ana@mail.com", password: secret }, new Headers()),
      await getAccounts().signIn({ email: "ana@mail.com", password: `${secret}x` }, new Headers()),
    ];

    const account = await getDb().account.findFirst({ where: { providerId: "credential" } });
    expect(account?.password).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(account?.password).not.toContain(secret);
    expect(JSON.stringify(results)).not.toContain(secret);
    expect(logged.join("\n")).not.toContain(secret);
  });
});

describe("signIn", () => {
  it("test-signin-ok: right email in other case and password sign in for 30 days", async () => {
    await register("ana@mail.com");
    clearCookies();

    const startedAt = Date.now();
    const result = await getAccounts().signIn(
      { email: " ANA@mail.COM", password: PASSWORD },
      new Headers(),
    );

    expect(result).toStrictEqual({ ok: true });
    const session = await getDb().session.findUnique({ where: { token: sessionTokenFromJar() } });
    expect(session).not.toBeNull();
    const expected = startedAt + THIRTY_DAYS_MS;
    expect(Math.abs((session?.expiresAt.getTime() ?? 0) - expected)).toBeLessThanOrEqual(5_000);
  });

  it("test-signin-invalid-identical: an unknown email and a wrong password get the same result", async () => {
    await register("ana@mail.com");
    clearCookies();

    const unknownEmail = await getAccounts().signIn(
      { email: "nadie@mail.com", password: PASSWORD },
      new Headers(),
    );
    const wrongPassword = await getAccounts().signIn(
      { email: "ana@mail.com", password: "otra2026clave" },
      new Headers(),
    );

    expect(unknownEmail).toStrictEqual({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(wrongPassword).toStrictEqual(unknownEmail);
    expect(readCookie(sessionCookieName())).toBeUndefined();
  });
});

describe("sessions", () => {
  it("test-session-expired-invalid: a session is valid at 29 days and gone at 30 days + 1 s", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const signedInAt = new Date("2026-03-13T20:00:00.000Z").getTime();
    vi.setSystemTime(signedInAt);
    await register("ana@mail.com");
    const token = sessionTokenFromJar();
    const headers = requestHeaders();

    vi.setSystemTime(signedInAt + 29 * DAY_MS);
    expect(await getAccounts().getCurrentUser(headers)).toMatchObject({
      email: "ana@mail.com",
      name: "Ana",
    });

    vi.setSystemTime(signedInAt + THIRTY_DAYS_MS + 1_000);
    expect(await getAccounts().getCurrentUser(headers)).toBeNull();
    expect(await getDb().session.findUnique({ where: { token } })).toBeNull();
  });

  it("returns exactly id, name and email of the signed-in user", async () => {
    await register("ana@mail.com");
    const user = await getDb().user.findUniqueOrThrow({ where: { email: "ana@mail.com" } });

    expect(await getAccounts().getCurrentUser(requestHeaders())).toStrictEqual({
      id: user.id,
      name: "Ana",
      email: "ana@mail.com",
    });
  });

  it("returns null without a cookie, and with a forged one", async () => {
    expect(await getAccounts().getCurrentUser(new Headers())).toBeNull();
    const forged = new Headers({ cookie: `${sessionCookieName()}=inventado.firma` });
    expect(await getAccounts().getCurrentUser(forged)).toBeNull();
  });

  it("test-signout-deletes-session: signOut deletes the row and the old cookie stops working", async () => {
    await register("ana@mail.com");
    const token = sessionTokenFromJar();
    const previous = requestHeaders();

    const result = await getAccounts().signOut(previous);

    expect(result).toStrictEqual({ ok: true });
    expect(await getDb().session.findUnique({ where: { token } })).toBeNull();
    expect(readCookie(sessionCookieName())).toBeUndefined();
    expect(await getAccounts().getCurrentUser(previous)).toBeNull();
  });
});

describe("latency", () => {
  it(
    "test-accounts-latency: p95 of 20 registrations and 20 sign-ins is within 1000 ms",
    { timeout: 60_000 },
    async () => {
      await register("calentamiento-1@mail.com");
      await getAccounts().signIn(
        { email: "calentamiento-1@mail.com", password: PASSWORD },
        new Headers(),
      );

      const registrations: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        const startedAt = performance.now();
        const result = await register(`persona-${i}@mail.com`);
        registrations.push(performance.now() - startedAt);
        expect(result).toStrictEqual({ ok: true });
      }
      const signIns: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        const startedAt = performance.now();
        const result = await getAccounts().signIn(
          { email: `persona-${i}@mail.com`, password: PASSWORD },
          new Headers(),
        );
        signIns.push(performance.now() - startedAt);
        expect(result).toStrictEqual({ ok: true });
      }

      expect(p95(registrations)).toBeLessThanOrEqual(LATENCY_BUDGET_MS);
      expect(p95(signIns)).toBeLessThanOrEqual(LATENCY_BUDGET_MS);
    },
  );
});
