import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
const getDb = vi.hoisted(() => vi.fn(() => ({ $queryRaw: queryRaw })));

vi.mock("@/server/db", () => ({ getDb }));

import { createHealthChecker, getHealthChecker } from "@/server/health";

const UP = { status: "ok", database: "up" };
const DOWN = { status: "error", database: "down" };
const INFRA_MESSAGE =
  'connect ECONNREFUSED 127.0.0.1:5432 — password authentication failed for user "grilla_user"';

let errorLog: MockInstance<typeof console.error>;

function loggedText(): string {
  return errorLog.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
}

beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  queryRaw.mockReset();
  getDb.mockClear();
});

describe("createHealthChecker", () => {
  it("reports the database up when the probe resolves", async () => {
    const checker = createHealthChecker({ probe: () => Promise.resolve(1) });

    await expect(checker.check()).resolves.toEqual(UP);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("reports the database down and logs DB_UNREACHABLE without the error message", async () => {
    const checker = createHealthChecker({
      probe: () => Promise.reject(new Error(INFRA_MESSAGE)),
    });

    await expect(checker.check()).resolves.toEqual(DOWN);
    expect(loggedText()).toContain("DB_UNREACHABLE");
    expect(loggedText()).not.toContain("ECONNREFUSED");
    expect(loggedText()).not.toContain("grilla_user");
  });

  it("treats a probe that throws synchronously as unreachable", async () => {
    const checker = createHealthChecker({
      probe: () => {
        throw new Error(INFRA_MESSAGE);
      },
    });

    await expect(checker.check()).resolves.toEqual(DOWN);
    expect(loggedText()).toContain("DB_UNREACHABLE");
    expect(loggedText()).not.toContain("ECONNREFUSED");
  });

  it("reports the database down and logs DB_TIMEOUT when the probe exceeds 800 ms", async () => {
    vi.useFakeTimers();
    const checker = createHealthChecker({ probe: () => new Promise<never>(() => {}) });

    const result = checker.check();
    await vi.advanceTimersByTimeAsync(799);
    expect(errorLog).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    await expect(result).resolves.toEqual(DOWN);
    expect(loggedText()).toContain("DB_TIMEOUT");
    expect(loggedText()).not.toContain("DB_UNREACHABLE");
  });

  it("does not log a second code when a timed-out probe rejects later", async () => {
    vi.useFakeTimers();
    const checker = createHealthChecker({
      probe: () =>
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error(INFRA_MESSAGE)), 5_000);
        }),
    });

    const result = checker.check();
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(result).resolves.toEqual(DOWN);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(loggedText()).toContain("DB_TIMEOUT");
  });

  it("calls the probe once for two checks within 2 s", async () => {
    let clock = 10_000;
    const probe = vi.fn(() => Promise.resolve(1));
    const checker = createHealthChecker({ probe, now: () => clock });

    await expect(checker.check()).resolves.toEqual(UP);
    clock += 1_999;
    await expect(checker.check()).resolves.toEqual(UP);

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("shares a single in-flight probe between concurrent checks", async () => {
    const probe = vi.fn(() => Promise.resolve(1));
    const checker = createHealthChecker({ probe, now: () => 0 });

    const results = await Promise.all([checker.check(), checker.check(), checker.check()]);

    expect(results).toEqual([UP, UP, UP]);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("caches a down result too, so a flood does not hit a failing database", async () => {
    let clock = 0;
    const probe = vi.fn(() => Promise.reject(new Error(INFRA_MESSAGE)));
    const checker = createHealthChecker({ probe, now: () => clock });

    await checker.check();
    clock += 500;
    await expect(checker.check()).resolves.toEqual(DOWN);

    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("probes again once the 2 s cache has expired", async () => {
    let clock = 0;
    const probe = vi.fn(() => Promise.resolve(1));
    const checker = createHealthChecker({ probe, now: () => clock });

    await checker.check();
    clock += 2_000;
    await checker.check();

    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("runs SELECT 1 through the shared Prisma client when no probe is given", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const checker = createHealthChecker();

    await expect(checker.check()).resolves.toEqual(UP);

    expect(getDb).toHaveBeenCalled();
    const [strings] = queryRaw.mock.calls[0] as unknown as [TemplateStringsArray];
    expect(strings.join("?").trim()).toBe("SELECT 1");
  });
});

describe("getHealthChecker", () => {
  it("lets a configuration error escape instead of reporting it as DB_UNREACHABLE", () => {
    getDb.mockImplementationOnce(() => {
      throw new Error("DATABASE_URL no está definida.");
    });

    expect(() => getHealthChecker()).toThrow("DATABASE_URL");
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("creates one checker on first use, validating the database configuration once", () => {
    const first = getHealthChecker();
    expect(getDb).toHaveBeenCalledTimes(1);

    expect(getHealthChecker()).toBe(first);
    expect(getDb).toHaveBeenCalledTimes(1);
  });
});
