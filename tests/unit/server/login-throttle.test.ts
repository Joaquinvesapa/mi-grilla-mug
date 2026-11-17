import { afterEach, describe, expect, it, vi } from "vitest";

const sharedDb = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }));
const getDb = vi.hoisted(() => vi.fn(() => sharedDb));
vi.mock("@/server/db", () => ({ getDb }));

import { createLoginThrottle, getLoginThrottle } from "@/server/login-throttle";

// Tests may not import the generated client (no-restricted-imports): take its type from the signature.
type ThrottleDb = Parameters<typeof createLoginThrottle>[0]["db"];

const NOW = new Date("2026-03-13T22:00:00.000Z");
const FIFTEEN_MIN_MS = 15 * 60_000;
const WINDOW_START = new Date(NOW.getTime() - FIFTEEN_MIN_MS);
const LOCK_END = new Date(NOW.getTime() + FIFTEEN_MIN_MS);

type RawCall = unknown[];

function fakeDb(rows: unknown[] = []) {
  const db = {
    $queryRaw: vi.fn(async (..._args: unknown[]) => rows),
    $executeRaw: vi.fn(async (..._args: unknown[]) => 1),
  };
  return db;
}

function throttleOver(db: ReturnType<typeof fakeDb>) {
  return createLoginThrottle({ db: db as unknown as ThrottleDb, now: () => NOW });
}

/** The SQL text of a tagged-template call, with each parameter as `$`. */
function sqlOf(call: RawCall | undefined): string {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join("$").replace(/\s+/g, " ");
}

function paramsOf(call: RawCall | undefined): unknown[] {
  return (call ?? []).slice(1);
}

afterEach(() => {
  getDb.mockClear();
});

describe("createLoginThrottle", () => {
  it("test-throttle-branches: reserve maps the returned rows, and clear and recordFailure emit their statements", async () => {
    const accepted = fakeDb([{ attempts: 1 }]);
    expect(await throttleOver(accepted).reserve("ana@mail.com")).toStrictEqual({ ok: true });

    // One single atomic statement, parameterized, compared only against the injected clock.
    expect(accepted.$queryRaw).toHaveBeenCalledTimes(1);
    expect(accepted.$executeRaw).not.toHaveBeenCalled();
    const reserveCall = accepted.$queryRaw.mock.calls[0];
    const reserveSql = sqlOf(reserveCall);
    expect(reserveSql).toMatch(/^ ?INSERT INTO login_throttles\b/i);
    expect(reserveSql).toMatch(/ON CONFLICT \(email\) DO UPDATE/i);
    expect(reserveSql).toMatch(/RETURNING/i);
    expect(reserveSql).not.toMatch(/now\(\)|current_timestamp/i);
    expect(reserveSql).not.toContain("ana@mail.com");
    const reserveParams = paramsOf(reserveCall);
    expect(reserveParams).toContain("ana@mail.com");
    expect(reserveParams).toContainEqual(NOW);
    expect(reserveParams).toContainEqual(WINDOW_START);
    expect(reserveParams).toContain(5);

    const locked = fakeDb([]);
    expect(await throttleOver(locked).reserve("ana@mail.com")).toStrictEqual({
      ok: false,
      code: "LOGIN_LOCKED",
    });

    const cleared = fakeDb();
    await throttleOver(cleared).clear("ana@mail.com");
    expect(cleared.$executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlOf(cleared.$executeRaw.mock.calls[0])).toMatch(
      /DELETE FROM login_throttles WHERE email = \$/i,
    );
    expect(paramsOf(cleared.$executeRaw.mock.calls[0])).toStrictEqual(["ana@mail.com"]);

    const failed = fakeDb();
    await throttleOver(failed).recordFailure("ana@mail.com");
    expect(failed.$executeRaw).toHaveBeenCalledTimes(2);
    const [purge, lock] = failed.$executeRaw.mock.calls;
    // The purge runs first: windows expired and without a lock in force (R-12).
    expect(sqlOf(purge)).toMatch(/^ ?DELETE FROM login_throttles WHERE window_started_at <= \$/i);
    expect(sqlOf(purge)).toMatch(/locked_until IS NULL OR locked_until <= \$/i);
    expect(paramsOf(purge)).toStrictEqual([WINDOW_START, NOW]);
    expect(sqlOf(lock)).toMatch(/^ ?UPDATE login_throttles SET locked_until = \$/i);
    expect(sqlOf(lock)).toMatch(/attempts >= \$/i);
    expect(paramsOf(lock)).toContainEqual(LOCK_END);
    expect(paramsOf(lock)).toContain("ana@mail.com");
    expect(paramsOf(lock)).toContain(5);
    for (const call of [purge, lock]) {
      expect(sqlOf(call)).not.toMatch(/now\(\)|current_timestamp/i);
    }
  });

  it("defaults the clock to the current time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    try {
      const db = fakeDb([{ attempts: 2 }]);
      await createLoginThrottle({ db: db as unknown as ThrottleDb }).reserve("ana@mail.com");
      expect(paramsOf(db.$queryRaw.mock.calls[0])).toContainEqual(NOW);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("getLoginThrottle", () => {
  it("is one throttle over the shared client", async () => {
    sharedDb.$queryRaw.mockResolvedValue([{ attempts: 1 }]);

    const first = getLoginThrottle();

    expect(getLoginThrottle()).toBe(first);
    expect(await first.reserve("ana@mail.com")).toStrictEqual({ ok: true });
    expect(sharedDb.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
