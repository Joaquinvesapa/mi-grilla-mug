import "server-only";

import { getDb } from "@/server/db";
import type { PrismaClient } from "@/server/generated/prisma/client";
import { getSchedule as getSharedSchedule, type ScheduleResult } from "@/server/schedule";

/** A show id as `data/schedule.json` defines them: lowercase letters, digits and dashes. */
const SHOW_ID_PATTERN = /^[a-z0-9-]+$/;
const SHOW_ID_MAX_LENGTH = 64;

export type SelectionResult =
  | { ok: true; showIds: string[] }
  | { ok: false; code: "SERVICE_UNAVAILABLE" };

export type SaveSelectionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_SELECTION" | "SERVICE_UNAVAILABLE" };

export type SelectionOptions = {
  db: Pick<PrismaClient, "$queryRaw" | "$transaction">;
  /** The grid every id is checked against. */
  getSchedule: () => Promise<ScheduleResult>;
  /** Receives a single line, `[selection] SERVICE_UNAVAILABLE at=…`. Defaults to `console.error`. */
  log?: (line: string) => void;
};

export type SelectionService = {
  /** The ids the user saved. Never memoized: it is per user and changes (R-12). */
  getSelection(userId: string): Promise<SelectionResult>;
  /** Replaces the user's whole selection with `showIds`, once they are validated (R-02). */
  saveSelection(userId: string, showIds: unknown): Promise<SaveSelectionResult>;
};

const UNAVAILABLE = { ok: false, code: "SERVICE_UNAVAILABLE" } as const;
const INVALID = { ok: false, code: "INVALID_SELECTION" } as const;

/** Thrown inside the transaction when the user row is gone, so it rolls back. Never leaves here. */
class MissingUserError extends Error {}

/** Only the generic code and the time, never the error (R-05). */
function defaultLog(line: string): void {
  console.error(line);
}

/** `showIds` as unique strings that all exist in the grid, or `null` (R-02). */
function validShowIds(showIds: unknown, known: ReadonlySet<string>): string[] | null {
  if (!Array.isArray(showIds) || showIds.length > known.size) {
    return null;
  }
  const seen = new Set<string>();
  for (const id of showIds as unknown[]) {
    if (
      typeof id !== "string" ||
      id.length === 0 ||
      id.length > SHOW_ID_MAX_LENGTH ||
      !SHOW_ID_PATTERN.test(id) ||
      seen.has(id) ||
      !known.has(id)
    ) {
      return null;
    }
    seen.add(id);
  }
  return [...seen];
}

/**
 * The selection of each user over `selected_shows`. The `userId` always comes from a verified
 * session (R-01) and every query filters by it (R-04). Every statement is a parameterized tagged
 * template.
 */
export function createSelectionService({
  db,
  getSchedule,
  log = defaultLog,
}: SelectionOptions): SelectionService {
  function unavailable(): typeof UNAVAILABLE {
    log(`[selection] SERVICE_UNAVAILABLE at=${new Date().toISOString()}`);
    return UNAVAILABLE;
  }

  return {
    async getSelection(userId) {
      try {
        const rows = await db.$queryRaw<{ show_id: string }[]>`
          SELECT show_id FROM selected_shows WHERE user_id = ${userId} ORDER BY show_id`;
        return { ok: true, showIds: rows.map((row) => row.show_id) };
      } catch {
        return unavailable();
      }
    },

    async saveSelection(userId, showIds) {
      if (!Array.isArray(showIds)) {
        return INVALID;
      }
      // Already logged by the schedule service when it fails.
      const schedule = await getSchedule();
      if (!schedule.ok) {
        return UNAVAILABLE;
      }
      const known = new Set(schedule.schedule.shows.map((show) => show.id));
      const ids = validShowIds(showIds, known);
      if (!ids) {
        return INVALID;
      }
      try {
        await db.$transaction(async (tx) => {
          // Two saves of the same user queue up on this lock, so the replacement is never
          // interleaved: the last one to commit wins whole (R-10).
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
          if (locked.length === 0) {
            throw new MissingUserError();
          }
          await tx.$executeRaw`DELETE FROM selected_shows WHERE user_id = ${userId}`;
          if (ids.length > 0) {
            await tx.$executeRaw`
              INSERT INTO selected_shows (user_id, show_id)
              SELECT ${userId}, unnest(${ids}::text[])`;
          }
        });
        return { ok: true };
      } catch {
        return unavailable();
      }
    },
  };
}

let sharedSelection: SelectionService | undefined;

function shared(): SelectionService {
  sharedSelection ??= createSelectionService({ db: getDb(), getSchedule: getSharedSchedule });
  return sharedSelection;
}

/** The saved selection of `userId`, who must come from a verified session. */
export function getSelection(userId: string): Promise<SelectionResult> {
  return shared().getSelection(userId);
}

/** Validates and saves the selection of `userId`, who must come from a verified session. */
export function saveSelection(userId: string, showIds: unknown): Promise<SaveSelectionResult> {
  return shared().saveSelection(userId, showIds);
}
