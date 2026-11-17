import "server-only";

import type { Schedule } from "@/lib/schedule-types";
import { getDb } from "@/server/db";
import type { PrismaClient } from "@/server/generated/prisma/client";

export type ScheduleResult =
  | { ok: true; schedule: Schedule }
  | { ok: false; code: "SERVICE_UNAVAILABLE" };

export type ScheduleOptions = {
  db: Pick<PrismaClient, "festivalDay" | "stage" | "show">;
  /** Receives a single line, `[schedule] SERVICE_UNAVAILABLE at=…`. Defaults to `console.error`. */
  log?: (line: string) => void;
};

export type ScheduleService = {
  /** The whole festival grid. Only a success is memoized: a failure is retried on the next call. */
  getSchedule(): Promise<ScheduleResult>;
};

const UNAVAILABLE: ScheduleResult = { ok: false, code: "SERVICE_UNAVAILABLE" };

/** Only the generic code and the time, never the error (R-05). */
function defaultLog(line: string): void {
  console.error(line);
}

/**
 * The grid is the same for everyone and the app never writes it, so it is read once and kept. It
 * carries no user data, so the memo cannot leak anything between users (R-12).
 */
export function createScheduleService({ db, log = defaultLog }: ScheduleOptions): ScheduleService {
  // The read in flight (or done): concurrent cold calls share it instead of querying twice. A failed
  // read is dropped, so the next call retries.
  let memo: Promise<ScheduleResult> | undefined;

  async function load(): Promise<Schedule> {
    const [days, stages, shows] = await Promise.all([
      db.festivalDay.findMany({
        select: { id: true, name: true, date: true, position: true },
        orderBy: { position: "asc" },
      }),
      db.stage.findMany({
        select: { id: true, name: true, position: true },
        orderBy: { position: "asc" },
      }),
      db.show.findMany({
        select: {
          id: true,
          dayId: true,
          stageId: true,
          artist: true,
          subtitle: true,
          startsAt: true,
          endsAt: true,
        },
        // The id breaks ties, so the order never depends on the plan the database picks.
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      }),
    ]);
    return {
      // A `DATE` column comes back as midnight UTC: its first 10 characters are the date itself.
      days: days.map((day) => ({ ...day, date: day.date.toISOString().slice(0, 10) })),
      stages,
      shows: shows.map((show) => ({
        ...show,
        startsAt: show.startsAt.toISOString(),
        endsAt: show.endsAt.toISOString(),
      })),
    };
  }

  return {
    getSchedule() {
      memo ??= load().then(
        (schedule): ScheduleResult => ({ ok: true, schedule }),
        (): ScheduleResult => {
          memo = undefined;
          log(`[schedule] SERVICE_UNAVAILABLE at=${new Date().toISOString()}`);
          return UNAVAILABLE;
        },
      );
      return memo;
    },
  };
}

let sharedSchedule: ScheduleService | undefined;

/** The grid over the shared client, memoized for the life of the process. */
export function getSchedule(): Promise<ScheduleResult> {
  sharedSchedule ??= createScheduleService({ db: getDb() });
  return sharedSchedule.getSchedule();
}
