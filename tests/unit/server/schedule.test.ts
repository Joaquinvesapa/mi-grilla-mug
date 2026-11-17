import { afterEach, describe, expect, it, vi } from "vitest";

const sharedDb = vi.hoisted(() => ({
  festivalDay: { findMany: vi.fn() },
  stage: { findMany: vi.fn() },
  show: { findMany: vi.fn() },
}));
const getDb = vi.hoisted(() => vi.fn(() => sharedDb));
vi.mock("@/server/db", () => ({ getDb }));

import { createScheduleService, getSchedule } from "@/server/schedule";

// Tests may not import the generated client (no-restricted-imports): take its type from the signature.
type ScheduleDb = Parameters<typeof createScheduleService>[0]["db"];

const LOG_LINE =
  /^\[schedule\] SERVICE_UNAVAILABLE at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PG_SECRET = "connect ECONNREFUSED db.internal:5432 password=hunter2";

const DAY_ROWS = [
  { id: "fri", name: "Viernes", date: new Date("2026-03-13T00:00:00.000Z"), position: 1 },
  { id: "sat", name: "Sábado", date: new Date("2026-03-14T00:00:00.000Z"), position: 2 },
];
const STAGE_ROWS = [
  { id: "flow", name: "Flow", position: 1 },
  { id: "samsung", name: "Samsung", position: 2 },
];
const SHOW_ROWS = [
  {
    id: "fri-samsung-2330",
    dayId: "fri",
    stageId: "samsung",
    artist: "Peggy Gou",
    subtitle: null,
    startsAt: new Date("2026-03-14T02:30:00.000Z"),
    endsAt: new Date("2026-03-14T04:00:00.000Z"),
  },
];

function fakeDb() {
  return {
    festivalDay: { findMany: vi.fn(async (_args: unknown): Promise<unknown> => DAY_ROWS) },
    stage: { findMany: vi.fn(async (_args: unknown): Promise<unknown> => STAGE_ROWS) },
    show: { findMany: vi.fn(async (_args: unknown): Promise<unknown> => SHOW_ROWS) },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSchedule", () => {
  it("test-schedule-memo-error: a database error is SERVICE_UNAVAILABLE, logs only code and time, is not memoized, and the next success is", async () => {
    const db = fakeDb();
    db.show.findMany.mockRejectedValueOnce(new Error(PG_SECRET));
    const log = vi.fn((_line: string) => {});
    const service = createScheduleService({ db: db as unknown as ScheduleDb, log });

    const failed = await service.getSchedule();

    expect(failed).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(LOG_LINE);
    expect(JSON.stringify(log.mock.calls)).not.toContain("hunter2");

    const retried = await service.getSchedule();
    expect(retried).toStrictEqual({
      ok: true,
      schedule: {
        days: [
          { id: "fri", name: "Viernes", date: "2026-03-13", position: 1 },
          { id: "sat", name: "Sábado", date: "2026-03-14", position: 2 },
        ],
        stages: STAGE_ROWS,
        shows: [
          {
            id: "fri-samsung-2330",
            dayId: "fri",
            stageId: "samsung",
            artist: "Peggy Gou",
            subtitle: null,
            startsAt: "2026-03-14T02:30:00.000Z",
            endsAt: "2026-03-14T04:00:00.000Z",
          },
        ],
      },
    });
    expect(db.show.findMany).toHaveBeenCalledTimes(2);

    // Memoized: the third call does not reach the database.
    expect(await service.getSchedule()).toStrictEqual(retried);
    expect(db.show.findMany).toHaveBeenCalledTimes(2);
    expect(db.festivalDay.findMany).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("test-schedule-memo-in-flight: two concurrent cold calls read the database once, and a shared failure is not kept", async () => {
    const db = fakeDb();
    db.show.findMany.mockRejectedValueOnce(new Error(PG_SECRET));
    const log = vi.fn((_line: string) => {});
    const service = createScheduleService({ db: db as unknown as ScheduleDb, log });

    const failed = await Promise.all([service.getSchedule(), service.getSchedule()]);

    expect(failed).toStrictEqual([
      { ok: false, code: "SERVICE_UNAVAILABLE" },
      { ok: false, code: "SERVICE_UNAVAILABLE" },
    ]);
    expect(db.show.findMany).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);

    const [first, second] = await Promise.all([service.getSchedule(), service.getSchedule()]);

    expect(first?.ok).toBe(true);
    expect(second).toStrictEqual(first);
    expect(db.show.findMany).toHaveBeenCalledTimes(2);
    expect(await service.getSchedule()).toStrictEqual(first);
    expect(db.show.findMany).toHaveBeenCalledTimes(2);
  });

  it("orders days and stages by position and shows by start", async () => {
    const db = fakeDb();
    const service = createScheduleService({ db: db as unknown as ScheduleDb, log: () => {} });

    await service.getSchedule();

    expect(db.festivalDay.findMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: { position: "asc" },
    });
    expect(db.stage.findMany.mock.calls[0]?.[0]).toMatchObject({ orderBy: { position: "asc" } });
    expect(db.show.findMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
  });

  it("logs through console.error by default", async () => {
    const db = fakeDb();
    db.stage.findMany.mockRejectedValueOnce(new Error(PG_SECRET));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createScheduleService({ db: db as unknown as ScheduleDb }).getSchedule();

    expect(result).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0]?.[0])).toMatch(LOG_LINE);
  });

  it("the shared getSchedule reads the shared client once", async () => {
    sharedDb.festivalDay.findMany.mockResolvedValue(DAY_ROWS);
    sharedDb.stage.findMany.mockResolvedValue(STAGE_ROWS);
    sharedDb.show.findMany.mockResolvedValue(SHOW_ROWS);

    const first = await getSchedule();
    const second = await getSchedule();

    expect(first.ok).toBe(true);
    expect(second).toStrictEqual(first);
    expect(sharedDb.show.findMany).toHaveBeenCalledTimes(1);
  });
});
