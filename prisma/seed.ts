// Loads the festival grid (data/schedule.json) into festival_days, stages and shows.
//
// Runs with plain Node (`pnpm db:seed` = `node prisma/seed.ts`, Node 24 type stripping): relative
// imports carry their `.ts` extension, nothing uses the `@/` alias, and there are no enums nor
// parameter properties. It writes with `pg` and parameterized SQL, not with the generated Prisma
// client, which Node cannot run untranspiled (spec FEAT-003a, "seed con pg").
//
// Output is a single line: `[seed] OK days=… stages=… shows=…`, or `[seed] <CODE>` with exit code 1.
// Never the URL nor a message from `pg` (R-05).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import type { UnsafeDatabaseUrlCode } from "../src/lib/database-url.ts";
import { assertSafeDatabaseUrl, UnsafeDatabaseUrlError } from "../src/lib/database-url.ts";
import {
  DATE_PATTERN,
  FESTIVAL_TIME_ZONE,
  posterTimeToInstant,
  TIME_PATTERN,
} from "../src/lib/festival-time.ts";

const SCHEDULE_FILE = new URL("../data/schedule.json", import.meta.url);
const ENV_FILE = new URL("../.env", import.meta.url);

const SHOW_ID = /^[a-z0-9-]{1,64}$/;

export type SeedCode =
  | "SCHEDULE_INVALID"
  | "SCHEDULE_ORPHANED"
  | "SERVICE_UNAVAILABLE"
  | UnsafeDatabaseUrlCode;

export type SeedResult =
  | { ok: true; days: number; stages: number; shows: number }
  | { ok: false; code: SeedCode };

/** The part of a `pg` client the seed uses; tests pass a fake. */
export type SeedClient = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export type SeedConnection = SeedClient & { end(): Promise<void> };

export type MainOptions = {
  /** Where `DATABASE_URL` is read from; `process.env` by default. */
  env?: Readonly<Record<string, string | undefined>>;
  connect?: (url: string) => Promise<SeedConnection>;
};

type SeedDay = { id: string; name: string; date: string; position: number };
type SeedStage = { id: string; name: string; position: number };
type SeedShow = {
  id: string;
  dayId: string;
  stageId: string;
  artist: string;
  subtitle: string | null;
  startsAt: Date;
  endsAt: Date;
};
type ParsedSchedule = { days: SeedDay[]; stages: SeedStage[]; shows: SeedShow[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function allUnique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

function parseDay(value: unknown): SeedDay | null {
  if (!isRecord(value)) return null;
  const { id, name, date, position } = value;
  if (!isText(id) || !isText(name) || typeof date !== "string" || !DATE_PATTERN.test(date)) {
    return null;
  }
  return isPosition(position) ? { id, name, date, position } : null;
}

function parseStage(value: unknown): SeedStage | null {
  if (!isRecord(value)) return null;
  const { id, name, position } = value;
  return isText(id) && isText(name) && isPosition(position) ? { id, name, position } : null;
}

function parseShow(
  value: unknown,
  dates: ReadonlyMap<string, string>,
  stageIds: ReadonlySet<string>,
) {
  if (!isRecord(value)) return null;
  const { id, dayId, stageId, artist, subtitle, start, end } = value;
  if (
    typeof id !== "string" ||
    !SHOW_ID.test(id) ||
    typeof dayId !== "string" ||
    typeof stageId !== "string" ||
    !stageIds.has(stageId) ||
    !isText(artist) ||
    (subtitle !== undefined && !isText(subtitle)) ||
    typeof start !== "string" ||
    !TIME_PATTERN.test(start) ||
    typeof end !== "string" ||
    !TIME_PATTERN.test(end)
  ) {
    return null;
  }
  const date = dates.get(dayId);
  if (date === undefined) return null;
  const startsAt = posterTimeToInstant(date, start);
  const endsAt = posterTimeToInstant(date, end);
  if (endsAt <= startsAt) return null;
  const show: SeedShow = {
    id,
    dayId,
    stageId,
    artist,
    subtitle: subtitle ?? null,
    startsAt,
    endsAt,
  };
  return show;
}

/** The schedule in `raw`, or `null` if it is not exactly the normalized format of the spec. */
export function parseSchedule(raw: unknown): ParsedSchedule | null {
  if (!isRecord(raw) || !isRecord(raw.festival) || raw.festival.timeZone !== FESTIVAL_TIME_ZONE) {
    return null;
  }
  const { days: rawDays, stages: rawStages, shows: rawShows } = raw;
  if (!Array.isArray(rawDays) || !Array.isArray(rawStages) || !Array.isArray(rawShows)) {
    return null;
  }

  const days = rawDays.map(parseDay);
  const stages = rawStages.map(parseStage);
  if (days.some((day) => day === null) || stages.some((stage) => stage === null)) return null;
  const validDays = days as SeedDay[];
  const validStages = stages as SeedStage[];
  if (
    !allUnique(validDays.map((day) => day.id)) ||
    !allUnique(validDays.map((day) => day.position)) ||
    !allUnique(validStages.map((stage) => stage.id)) ||
    !allUnique(validStages.map((stage) => stage.position))
  ) {
    return null;
  }

  const dates = new Map(validDays.map((day) => [day.id, day.date]));
  const stageIds = new Set(validStages.map((stage) => stage.id));
  let shows: (SeedShow | null)[];
  try {
    shows = rawShows.map((show) => parseShow(show, dates, stageIds));
  } catch (error) {
    // posterTimeToInstant rejects a date that matches the pattern but does not exist (2026-02-30).
    if (error instanceof RangeError) return null;
    throw error;
  }
  if (shows.some((show) => show === null)) return null;
  const validShows = shows as SeedShow[];
  if (!allUnique(validShows.map((show) => show.id))) return null;

  return { days: validDays, stages: validStages, shows: validShows };
}

/** The schedule in `file`, or `null` if it is missing, is not JSON or has the wrong shape. */
function loadSchedule(file: URL): ParsedSchedule | null {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // ENOENT or a SyntaxError: both mean there is no valid schedule, and the caller reports that
    // as SCHEDULE_INVALID. Their messages (paths, file contents) are not useful to it.
    return null;
  }
  return parseSchedule(raw);
}

async function writeSchedule(client: SeedClient, schedule: ParsedSchedule): Promise<SeedResult> {
  try {
    await client.query("BEGIN");
    for (const day of schedule.days) {
      await client.query(
        `INSERT INTO festival_days (id, name, date, position) VALUES ($1, $2, $3::date, $4)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, date = EXCLUDED.date, position = EXCLUDED.position`,
        [day.id, day.name, day.date, day.position],
      );
    }
    for (const stage of schedule.stages) {
      await client.query(
        `INSERT INTO stages (id, name, position) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position`,
        [stage.id, stage.name, stage.position],
      );
    }
    for (const show of schedule.shows) {
      await client.query(
        `INSERT INTO shows (id, day_id, stage_id, artist, subtitle, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET day_id = EXCLUDED.day_id, stage_id = EXCLUDED.stage_id, artist = EXCLUDED.artist,
             subtitle = EXCLUDED.subtitle, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at`,
        [
          show.id,
          show.dayId,
          show.stageId,
          show.artist,
          show.subtitle,
          show.startsAt.toISOString(),
          show.endsAt.toISOString(),
        ],
      );
    }

    // Shows in the database but not in the JSON are never deleted: someone may have chosen them,
    // and that needs a decision, not a seed.
    const { rows: orphans } = await client.query(
      "SELECT id FROM shows WHERE NOT (id = ANY($1::text[])) LIMIT 1",
      [schedule.shows.map((show) => show.id)],
    );
    if (orphans.length > 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "SCHEDULE_ORPHANED" };
    }

    await client.query("COMMIT");
    return {
      ok: true,
      days: schedule.days.length,
      stages: schedule.stages.length,
      shows: schedule.shows.length,
    };
  } catch {
    // pg's message can carry the host or the query: only the code is reported.
    await client.query("ROLLBACK").catch(() => {
      // The connection is already broken: the failure that got us here is the one reported.
    });
    return { ok: false, code: "SERVICE_UNAVAILABLE" };
  }
}

/**
 * Upserts days, stages and shows from `raw` in one transaction; without `raw`, from `file`
 * (`data/schedule.json` by default). Nothing is written if the schedule is missing or malformed
 * (`SCHEDULE_INVALID`), if the database holds shows the schedule does not (`SCHEDULE_ORPHANED`) or
 * if a query fails (`SERVICE_UNAVAILABLE`).
 */
export async function seedSchedule(
  client: SeedClient,
  raw?: unknown,
  file: URL = SCHEDULE_FILE,
): Promise<SeedResult> {
  const schedule = raw === undefined ? loadSchedule(file) : parseSchedule(raw);
  if (!schedule) {
    return { ok: false, code: "SCHEDULE_INVALID" };
  }
  return writeSchedule(client, schedule);
}

async function connectPg(url: string): Promise<SeedConnection> {
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (error) {
    await client.end().catch(() => {
      // Nothing to close: the connection never opened. The connect error is the one rethrown.
    });
    throw error;
  }
  return client;
}

function fail(code: SeedCode): 1 {
  console.error(`[seed] ${code}`);
  return 1;
}

/** The `pnpm db:seed` entry point: validates the URL, seeds and returns the exit code. */
export async function main({ env = process.env, connect = connectPg }: MainOptions = {}): Promise<
  0 | 1
> {
  try {
    assertSafeDatabaseUrl(env.DATABASE_URL ?? "");
  } catch (error) {
    return fail(error instanceof UnsafeDatabaseUrlError ? error.code : "INVALID_URL");
  }
  const url = env.DATABASE_URL ?? "";

  const schedule = loadSchedule(SCHEDULE_FILE);
  if (!schedule) {
    return fail("SCHEDULE_INVALID");
  }

  let client: SeedConnection;
  try {
    client = await connect(url);
  } catch {
    return fail("SERVICE_UNAVAILABLE");
  }
  try {
    const result = await writeSchedule(client, schedule);
    if (!result.ok) {
      return fail(result.code);
    }
    console.log(`[seed] OK days=${result.days} stages=${result.stages} shows=${result.shows}`);
    return 0;
  } finally {
    await closeQuietly(client);
  }
}

/**
 * Closes the connection without changing a result that was already printed: by then the
 * transaction is committed or rolled back. A failure is logged with its own code, never pg's
 * message.
 */
async function closeQuietly(client: SeedConnection): Promise<void> {
  try {
    await client.end();
  } catch {
    console.error("[seed] CLOSE_FAILED");
  }
}

/**
 * Whether the process was started on `moduleUrl` (`node prisma/seed.ts`), not importing it. Works
 * on every Node 24.x: `import.meta.main` only exists from 24.2.
 */
export function isEntryPoint(argv1: string | undefined, moduleUrl: string): boolean {
  return argv1 !== undefined && resolve(argv1) === fileURLToPath(moduleUrl);
}

if (isEntryPoint(process.argv[1], import.meta.url)) {
  // `node prisma/seed.ts` does not go through prisma.config.ts: read `.env` like it does. Variables
  // already in the environment (the CI's) win over the file.
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  main().then(
    (code) => {
      process.exitCode = code;
    },
    () => {
      process.exitCode = fail("SERVICE_UNAVAILABLE");
    },
  );
}
