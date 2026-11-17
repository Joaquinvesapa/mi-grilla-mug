import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { isEntryPoint, main, seedSchedule, type SeedClient } from "../../prisma/seed.ts";

const SCHEDULE_PATH = resolve(process.cwd(), "data/schedule.json");
const ORPHAN_ID = "zzz-test-orphan-0000";
const PG_SECRET_MESSAGE = "connection to db.internal:5432 failed: password=hunter2";

type ScheduleFile = {
  shows: ({ id: string; artist?: string } & Record<string, unknown>)[];
} & Record<string, unknown>;

function readSchedule(): ScheduleFile {
  return JSON.parse(readFileSync(SCHEDULE_PATH, "utf8")) as ScheduleFile;
}

let client: pg.Client;

beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL no está definida: los tests de integración necesitan la base.");
  }
  client = new pg.Client({ connectionString: url });
  await client.connect();
});

afterAll(async () => {
  await client.query("DELETE FROM shows WHERE id = $1", [ORPHAN_ID]);
  await client.end();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function counts(): Promise<{ days: number; stages: number; shows: number }> {
  const { rows } = await client.query<{ days: number; stages: number; shows: number }>(
    `SELECT (SELECT count(*)::int FROM festival_days) AS days,
            (SELECT count(*)::int FROM stages) AS stages,
            (SELECT count(*)::int FROM shows) AS shows`,
  );
  return rows[0] ?? { days: -1, stages: -1, shows: -1 };
}

async function snapshot(): Promise<unknown[]> {
  const { rows } = await client.query("SELECT * FROM shows ORDER BY id");
  return rows;
}

/** Everything the spy printed, joined: what a person running `pnpm db:seed` would read. */
function printed(...spies: { mock: { calls: unknown[][] } }[]): string {
  return spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join("\n");
}

/** A client whose `INSERT INTO shows` fails like `pg` does, carrying infrastructure detail. */
function failingClient(): SeedClient & { queries: string[]; end: () => Promise<void> } {
  const queries: string[] = [];
  return {
    queries,
    query: async (text: string) => {
      queries.push(text.trim().split(/\s+/).slice(0, 3).join(" "));
      if (/INSERT INTO shows/i.test(text)) {
        throw new Error(PG_SECRET_MESSAGE);
      }
      return { rows: [] };
    },
    end: async () => {},
  };
}

describe("seedSchedule", () => {
  it("test-seed-idempotent: seeding twice leaves 3 days, 5 stages and 91 shows, with Peggy Gou at 2026-03-14T02:30Z", async () => {
    await expect(seedSchedule(client)).resolves.toStrictEqual({
      ok: true,
      days: 3,
      stages: 5,
      shows: 91,
    });
    await expect(seedSchedule(client)).resolves.toMatchObject({ ok: true });

    expect(await counts()).toStrictEqual({ days: 3, stages: 5, shows: 91 });
    const { rows } = await client.query<{
      starts_at: Date;
      ends_at: Date;
      day_id: string;
      stage_id: string;
    }>("SELECT starts_at, ends_at, day_id, stage_id FROM shows WHERE id = 'fri-samsung-2330'");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.starts_at.toISOString()).toBe("2026-03-14T02:30:00.000Z");
    expect(rows[0]?.ends_at.toISOString()).toBe("2026-03-14T04:00:00.000Z");
    expect(rows[0]).toMatchObject({ day_id: "fri", stage_id: "samsung" });

    const { rows: stages } = await client.query<{ id: string }>(
      "SELECT id FROM stages ORDER BY position",
    );
    expect(stages.map((stage) => stage.id)).toStrictEqual([
      "flow",
      "samsung",
      "alternative",
      "perrys",
      "kidzapalooza",
    ]);
    const { rows: arjaus } = await client.query<{ subtitle: string | null }>(
      "SELECT subtitle FROM shows WHERE artist = 'Arjaus Crew' ORDER BY starts_at",
    );
    expect(arjaus.map((show) => show.subtitle)).toStrictEqual([
      "Franco y Mateo Trocca - B2B",
      "Mateo Trocca",
      "Franco Trocca",
    ]);

    // The entry point prints the totals and exits with 0.
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(main()).resolves.toBe(0);
    expect(log).toHaveBeenCalledWith("[seed] OK days=3 stages=5 shows=91");
    expect(error).not.toHaveBeenCalled();
  });

  it("test-seed-invalid-schedule-rejected: a show without artist is SCHEDULE_INVALID and the database stays as it was", async () => {
    await seedSchedule(client);
    const before = await snapshot();

    const schedule = readSchedule();
    const [first, second] = schedule.shows;
    // A valid change to one show and an invalid one to another: if anything were written, the
    // first change would show up.
    if (first) first.artist = "Cambiado por el test";
    if (second) delete second.artist;

    await expect(seedSchedule(client, schedule)).resolves.toStrictEqual({
      ok: false,
      code: "SCHEDULE_INVALID",
    });
    expect(await snapshot()).toStrictEqual(before);

    for (const invalid of [
      null,
      { ...readSchedule(), days: "fri" },
      { ...readSchedule(), shows: [{ ...readSchedule().shows[0], id: "FRI SAMSUNG" }] },
      { ...readSchedule(), shows: [{ ...readSchedule().shows[0], dayId: "mon" }] },
      { ...readSchedule(), shows: [{ ...readSchedule().shows[0], start: "25:00" }] },
    ]) {
      await expect(seedSchedule(client, invalid)).resolves.toStrictEqual({
        ok: false,
        code: "SCHEDULE_INVALID",
      });
    }
    expect(await snapshot()).toStrictEqual(before);
  });

  it("test-seed-orphaned-rejected: with an extra show in the database the seed is SCHEDULE_ORPHANED, rolls back and deletes nothing", async () => {
    await seedSchedule(client);
    await client.query(
      `INSERT INTO shows (id, day_id, stage_id, artist, starts_at, ends_at)
       VALUES ($1, 'fri', 'flow', 'Show agregado a mano', '2026-03-13T20:00:00Z', '2026-03-13T21:00:00Z')`,
      [ORPHAN_ID],
    );
    try {
      const before = await snapshot();
      const schedule = readSchedule();
      const [first] = schedule.shows;
      if (first) first.artist = "Cambiado por el test";

      await expect(seedSchedule(client, schedule)).resolves.toStrictEqual({
        ok: false,
        code: "SCHEDULE_ORPHANED",
      });
      // Rolled back: the upsert of the changed artist is gone, and the orphan is still there.
      expect(await snapshot()).toStrictEqual(before);
    } finally {
      await client.query("DELETE FROM shows WHERE id = $1", [ORPHAN_ID]);
    }
  });

  it("test-seed-db-error: a failing query rolls back and is SERVICE_UNAVAILABLE, printed without the pg message", async () => {
    const fake = failingClient();

    await expect(seedSchedule(fake)).resolves.toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(fake.queries).toContain("BEGIN");
    expect(fake.queries.at(-1)).toBe("ROLLBACK");
    expect(fake.queries).not.toContain("COMMIT");

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const second = failingClient();
    const end = vi.spyOn(second, "end");

    await expect(
      main({ env: { DATABASE_URL: process.env.DATABASE_URL }, connect: async () => second }),
    ).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith("[seed] SERVICE_UNAVAILABLE");
    expect(printed(log, error)).not.toContain("hunter2");
    expect(printed(log, error)).not.toContain("db.internal");
    expect(second.queries.at(-1)).toBe("ROLLBACK");
    expect(end).toHaveBeenCalled();

    // A connection that cannot even be opened is the same code, with nothing from pg either.
    error.mockClear();
    await expect(
      main({
        env: { DATABASE_URL: process.env.DATABASE_URL },
        connect: async () => {
          throw new Error(PG_SECRET_MESSAGE);
        },
      }),
    ).resolves.toBe(1);
    expect(error).toHaveBeenCalledWith("[seed] SERVICE_UNAVAILABLE");
    expect(printed(log, error)).not.toContain("hunter2");
  });
});

describe("seedSchedule — the schedule file", () => {
  it("a missing file or broken JSON is SCHEDULE_INVALID, not a raw ENOENT/SyntaxError, and nothing is queried", async () => {
    const dir = mkdtempSync(join(tmpdir(), "seed-test-"));
    try {
      const broken = join(dir, "broken.json");
      writeFileSync(broken, '{ "days": [', "utf8");
      const missing = pathToFileURL(join(dir, "missing.json"));
      const fake = failingClient();

      await expect(seedSchedule(fake, undefined, missing)).resolves.toStrictEqual({
        ok: false,
        code: "SCHEDULE_INVALID",
      });
      await expect(seedSchedule(fake, undefined, pathToFileURL(broken))).resolves.toStrictEqual({
        ok: false,
        code: "SCHEDULE_INVALID",
      });
      expect(fake.queries).toStrictEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("isEntryPoint", () => {
  const seedPath = resolve(process.cwd(), "prisma/seed.ts");
  const seedUrl = pathToFileURL(seedPath).href;

  it("is true when node was started on the seed, by absolute or relative path, on any Node 24.x", () => {
    expect(isEntryPoint(seedPath, seedUrl)).toBe(true);
    expect(isEntryPoint(relative(process.cwd(), seedPath), seedUrl)).toBe(true);
  });

  it("is false when the seed is imported from another script, or argv has no script", () => {
    expect(isEntryPoint(resolve(process.cwd(), "node_modules/vitest/vitest.mjs"), seedUrl)).toBe(
      false,
    );
    expect(isEntryPoint(undefined, seedUrl)).toBe(false);
  });
});

describe("main", () => {
  it("a connection that fails to close after [seed] OK still exits with 0 and prints no SERVICE_UNAVAILABLE", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      main({
        env: { DATABASE_URL: process.env.DATABASE_URL },
        connect: async () => ({
          query: (text: string, values?: unknown[]) => client.query(text, values),
          end: () => Promise.reject(new Error(PG_SECRET_MESSAGE)),
        }),
      }),
    ).resolves.toBe(0);

    expect(log).toHaveBeenCalledWith("[seed] OK days=3 stages=5 shows=91");
    expect(error).not.toHaveBeenCalledWith("[seed] SERVICE_UNAVAILABLE");
    // Not swallowed: the close failure is logged with its own code, never pg's message.
    expect(error).toHaveBeenCalledWith("[seed] CLOSE_FAILED");
    expect(printed(log, error)).not.toContain("hunter2");
  });

  it("test-seed-unsafe-url-rejected: a remote URL without TLS exits with 1 and prints [seed] TLS_REQUIRED without the URL", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const connect = vi.fn();

    await expect(
      main({ env: { DATABASE_URL: "postgresql://grilla:s3cr3t@db.example.com:5432/db" }, connect }),
    ).resolves.toBe(1);

    expect(error).toHaveBeenCalledWith("[seed] TLS_REQUIRED");
    expect(connect).not.toHaveBeenCalled();
    const output = printed(log, error);
    expect(output).not.toContain("s3cr3t");
    expect(output).not.toContain("db.example.com");
  });

  it("a missing or non-postgres DATABASE_URL is INVALID_URL, without connecting", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const connect = vi.fn();

    await expect(main({ env: {}, connect })).resolves.toBe(1);
    await expect(
      main({ env: { DATABASE_URL: "mysql://u:p@127.0.0.1/db" }, connect }),
    ).resolves.toBe(1);

    expect(error.mock.calls).toStrictEqual([["[seed] INVALID_URL"], ["[seed] INVALID_URL"]]);
    expect(connect).not.toHaveBeenCalled();
  });
});
