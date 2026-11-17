import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Schedule } from "@/lib/schedule-types";
import type { ScheduleResult } from "@/server/schedule";

const sharedDb = vi.hoisted(() => ({ $queryRaw: vi.fn(), $transaction: vi.fn() }));
const getDb = vi.hoisted(() => vi.fn(() => sharedDb));
vi.mock("@/server/db", () => ({ getDb }));

const sharedGetSchedule = vi.hoisted(() => vi.fn());
vi.mock("@/server/schedule", () => ({ getSchedule: sharedGetSchedule }));

const headers = vi.hoisted(() => vi.fn(async () => new Headers({ cookie: "s=1" })));
vi.mock("next/headers", () => ({ headers }));

const accounts = vi.hoisted(() => {
  class AccountsUnavailableError extends Error {
    readonly code = "SERVICE_UNAVAILABLE";
  }
  const getCurrentUser = vi.fn();
  return { AccountsUnavailableError, getCurrentUser };
});
vi.mock("@/server/accounts", () => ({
  AccountsUnavailableError: accounts.AccountsUnavailableError,
  getAccounts: () => ({ getCurrentUser: accounts.getCurrentUser }),
}));

const saveSpy = vi.hoisted(() => vi.fn());
// The action is tested against a spy; the services keep their real factory (and the real shared
// functions through `vi.importActual`).
vi.mock("@/server/selection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/selection")>()),
  saveSelection: saveSpy,
}));

import { saveSelectionAction } from "@/app/selection-actions";
import { createSelectionService } from "@/server/selection";

type SelectionDb = Parameters<typeof createSelectionService>[0]["db"];
type RawCall = unknown[];

const LOG_LINE =
  /^\[selection\] SERVICE_UNAVAILABLE at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PG_SECRET = "connect ECONNREFUSED db.internal:5432 password=hunter2";
const USER_ID = "user-ana";

type FileShow = { id: string; dayId: string; stageId: string; artist: string };

/** The real 91 ids; instants do not matter to the validation. */
function realSchedule(): Schedule {
  const file = JSON.parse(readFileSync(resolve(process.cwd(), "data/schedule.json"), "utf8")) as {
    shows: FileShow[];
  };
  return {
    days: [],
    stages: [],
    shows: file.shows.map((entry) => ({
      ...entry,
      subtitle: null,
      startsAt: "2026-03-13T20:00:00.000Z",
      endsAt: "2026-03-13T21:00:00.000Z",
    })),
  };
}

const SCHEDULE = realSchedule();
const [FIRST, SECOND] = SCHEDULE.shows.map((entry) => entry.id);

function fakeDb(lockedRows: unknown[] = [{ id: USER_ID }]) {
  const tx = {
    $queryRaw: vi.fn(async (..._args: unknown[]): Promise<unknown> => lockedRows),
    $executeRaw: vi.fn(async (..._args: unknown[]): Promise<unknown> => 1),
  };
  const db = {
    $queryRaw: vi.fn(async (..._args: unknown[]): Promise<unknown> => []),
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { db, tx };
}

function serviceOver(
  db: ReturnType<typeof fakeDb>["db"],
  log = vi.fn((_line: string) => {}),
  schedule: () => Promise<ScheduleResult> = async () => ({ ok: true, schedule: SCHEDULE }),
) {
  return createSelectionService({ db: db as unknown as SelectionDb, getSchedule: schedule, log });
}

/** The SQL text of a tagged-template call, with each parameter as `$`. */
function sqlOf(call: RawCall | undefined): string {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join("$").replace(/\s+/g, " ").trim();
}

afterEach(() => {
  vi.restoreAllMocks();
  saveSpy.mockReset();
  accounts.getCurrentUser.mockReset();
});

describe("saveSelection", () => {
  it("test-selection-invalid-rejected: malformed, repeated, unknown or oversized selections are INVALID_SELECTION and the database is not touched", async () => {
    const { db } = fakeDb();
    const service = serviceOver(db);
    const tooMany = [...SCHEDULE.shows.map((entry) => entry.id), "zzz-extra-0000"];
    expect(tooMany).toHaveLength(92);

    const inputs: unknown[] = [
      "x",
      [1],
      ["a", "a"],
      ["NO_VALE"],
      ["fri-nope-0000"],
      tooMany,
      null,
      { 0: FIRST, length: 1 },
      [""],
      ["a".repeat(65)],
      [FIRST, FIRST],
    ];
    for (const input of inputs) {
      expect(await service.saveSelection(USER_ID, input)).toStrictEqual({
        ok: false,
        code: "INVALID_SELECTION",
      });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();

    // A grid that does contain the malformed ids: only the pattern and the length reject them.
    const malformed = ["NO_VALE", "a".repeat(65), "", "fri flow"];
    const tainted: Schedule = {
      ...SCHEDULE,
      shows: [
        ...SCHEDULE.shows,
        ...malformed.flatMap((id) => SCHEDULE.shows.slice(0, 1).map((entry) => ({ ...entry, id }))),
      ],
    };
    const taintedService = serviceOver(db, vi.fn(), async () => ({ ok: true, schedule: tainted }));
    for (const id of malformed) {
      expect(await taintedService.saveSelection(USER_ID, [id])).toStrictEqual({
        ok: false,
        code: "INVALID_SELECTION",
      });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("replaces the selection inside a transaction that first locks the user row", async () => {
    const { db, tx } = fakeDb();

    const result = await serviceOver(db).saveSelection(USER_ID, [FIRST, SECOND]);

    expect(result).toStrictEqual({ ok: true });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const lock = tx.$queryRaw.mock.calls[0];
    expect(sqlOf(lock)).toMatch(/^SELECT id FROM users WHERE id = \$ FOR UPDATE$/i);
    expect(lock?.slice(1)).toStrictEqual([USER_ID]);
    const [remove, insert] = tx.$executeRaw.mock.calls;
    expect(sqlOf(remove)).toMatch(/^DELETE FROM selected_shows WHERE user_id = \$$/i);
    expect(remove?.slice(1)).toStrictEqual([USER_ID]);
    expect(sqlOf(insert)).toMatch(/^INSERT INTO selected_shows \(user_id, show_id\)/i);
    expect(insert?.slice(1)).toStrictEqual([USER_ID, [FIRST, SECOND]]);
    // The lock comes before any write.
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$executeRaw.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("an empty selection only deletes", async () => {
    const { db, tx } = fakeDb();

    expect(await serviceOver(db).saveSelection(USER_ID, [])).toStrictEqual({ ok: true });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("a schedule that cannot be read is SERVICE_UNAVAILABLE without touching the selection", async () => {
    const { db } = fakeDb();
    const schedule = vi.fn(async (): Promise<ScheduleResult> => ({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    }));

    const result = await serviceOver(db, vi.fn(), schedule).saveSelection(USER_ID, [FIRST]);

    expect(result).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("a user row that no longer exists rolls back as SERVICE_UNAVAILABLE", async () => {
    const { db, tx } = fakeDb([]);
    const log = vi.fn((_line: string) => {});

    const result = await serviceOver(db, log).saveSelection(USER_ID, [FIRST]);

    expect(result).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(log.mock.calls[0]?.[0]).toMatch(LOG_LINE);
  });
});

describe("database errors", () => {
  it("test-selection-db-error: a database error saving or reading is SERVICE_UNAVAILABLE and the log omits the original message", async () => {
    const { db, tx } = fakeDb();
    tx.$executeRaw.mockRejectedValueOnce(new Error(PG_SECRET));
    db.$queryRaw.mockRejectedValueOnce(new Error(PG_SECRET));
    const log = vi.fn((_line: string) => {});
    const service = serviceOver(db, log);

    const saved = await service.saveSelection(USER_ID, [FIRST]);
    const read = await service.getSelection(USER_ID);

    expect(saved).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(read).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(log).toHaveBeenCalledTimes(2);
    for (const [line] of log.mock.calls) {
      expect(line).toMatch(LOG_LINE);
    }
    expect(JSON.stringify([saved, read, log.mock.calls])).not.toContain("hunter2");
  });

  it("logs through console.error by default", async () => {
    const { db } = fakeDb();
    db.$queryRaw.mockRejectedValueOnce(new Error(PG_SECRET));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const service = createSelectionService({
      db: db as unknown as SelectionDb,
      getSchedule: async () => ({ ok: true, schedule: SCHEDULE }),
    });

    expect(await service.getSelection(USER_ID)).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(String(consoleError.mock.calls[0]?.[0])).toMatch(LOG_LINE);
  });
});

describe("getSelection", () => {
  it("reads only the given user's rows, as ids", async () => {
    const { db } = fakeDb();
    db.$queryRaw.mockResolvedValueOnce([{ show_id: FIRST }, { show_id: SECOND }]);

    const result = await serviceOver(db).getSelection(USER_ID);

    expect(result).toStrictEqual({ ok: true, showIds: [FIRST, SECOND] });
    const call = db.$queryRaw.mock.calls[0];
    expect(sqlOf(call)).toMatch(/FROM selected_shows WHERE user_id = \$/i);
    expect(call?.slice(1)).toStrictEqual([USER_ID]);
  });
});

describe("shared functions", () => {
  it("getSelection and saveSelection run over the shared client and schedule", async () => {
    const actual = await vi.importActual<typeof import("@/server/selection")>("@/server/selection");
    sharedGetSchedule.mockResolvedValue({ ok: true, schedule: SCHEDULE });
    sharedDb.$queryRaw.mockResolvedValue([{ show_id: FIRST }]);
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: USER_ID }]),
      $executeRaw: vi.fn(async () => 1),
    };
    sharedDb.$transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));

    expect(await actual.getSelection(USER_ID)).toStrictEqual({ ok: true, showIds: [FIRST] });
    expect(await actual.saveSelection(USER_ID, [FIRST])).toStrictEqual({ ok: true });
    expect(sharedGetSchedule).toHaveBeenCalled();
    expect(sharedDb.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("saveSelectionAction", () => {
  it("test-selection-action-unauthorized: without a session it is UNAUTHENTICATED and never saves; AccountsUnavailableError is SERVICE_UNAVAILABLE", async () => {
    accounts.getCurrentUser.mockResolvedValueOnce(null);

    expect(await saveSelectionAction([FIRST], USER_ID)).toStrictEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(saveSpy).not.toHaveBeenCalled();

    accounts.getCurrentUser.mockRejectedValueOnce(new accounts.AccountsUnavailableError());

    expect(await saveSelectionAction([FIRST], USER_ID)).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("saves for the session's user, never one sent by the client", async () => {
    accounts.getCurrentUser.mockResolvedValueOnce({ id: USER_ID, name: "Ana", email: "a@b.co" });
    saveSpy.mockResolvedValueOnce({ ok: false, code: "INVALID_SELECTION" });

    const result = await saveSelectionAction([FIRST], USER_ID);

    expect(result).toStrictEqual({ ok: false, code: "INVALID_SELECTION" });
    expect(saveSpy).toHaveBeenCalledWith(USER_ID, [FIRST]);
    const passedHeaders = accounts.getCurrentUser.mock.calls[0]?.[0] as Headers;
    expect(passedHeaders.get("cookie")).toBe("s=1");
  });

  it("an unexpected error from the session check is rethrown", async () => {
    accounts.getCurrentUser.mockRejectedValueOnce(new TypeError("boom"));

    await expect(saveSelectionAction([FIRST], USER_ID)).rejects.toThrow(TypeError);
  });

  it("test-action-user-mismatch-rejected: with A's session and B as expectedUserId it is USER_MISMATCH and never saves", async () => {
    accounts.getCurrentUser.mockResolvedValueOnce({ id: USER_ID, name: "Ana", email: "a@b.co" });

    expect(await saveSelectionAction([FIRST, SECOND], "user-beto")).toStrictEqual({
      ok: false,
      code: "USER_MISMATCH",
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("test-action-expected-user-invalid: a number, an empty string or 65 characters as expectedUserId is USER_MISMATCH", async () => {
    for (const expected of [42, "", "a".repeat(65), undefined, null, [USER_ID]]) {
      accounts.getCurrentUser.mockResolvedValueOnce({ id: USER_ID, name: "Ana", email: "a@b.co" });

      expect(await saveSelectionAction([FIRST], expected)).toStrictEqual({
        ok: false,
        code: "USER_MISMATCH",
      });
    }
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("test-action-unauthorized-before-mismatch: without a session it is UNAUTHENTICATED even with no expectedUserId", async () => {
    accounts.getCurrentUser.mockResolvedValueOnce(null);

    expect(await saveSelectionAction([FIRST], undefined)).toStrictEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("a 64-character expectedUserId equal to the session's user saves", async () => {
    const longId = "u".repeat(64);
    accounts.getCurrentUser.mockResolvedValueOnce({ id: longId, name: "Ana", email: "a@b.co" });
    saveSpy.mockResolvedValueOnce({ ok: true });

    expect(await saveSelectionAction([FIRST], longId)).toStrictEqual({ ok: true });
    expect(saveSpy).toHaveBeenCalledWith(longId, [FIRST]);
  });
});
