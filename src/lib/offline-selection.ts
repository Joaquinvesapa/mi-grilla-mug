// What the app keeps on the device to work without a connection (ADR-004): the device copy of the
// last user who saw `/` online, and each user's selection saved without a connection. Pure: it only
// parses and validates what `src/components/device-store.ts` reads from `localStorage`, which is
// untrusted (R-02), so every `parse*` returns `null` instead of throwing.
import { type GroupPicks, groupPicksOf } from "@/lib/group-picks";
import type { FestivalDay, Schedule, Show, Stage } from "@/lib/schedule-types";
import {
  FORMAT_VERSION,
  isBoundedString,
  isFields,
  parseJson,
  USER_ID_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from "@/lib/stored-value";

/** The grid, user and confirmed selection as of the last time `/` was shown online. */
export type DeviceSnapshot = {
  version: 1;
  userId: string;
  userName: string;
  schedule: Schedule;
  /** Confirmed by the server: unique ids, all of them in `schedule.shows`. */
  savedShowIds: string[];
  /** The user's groups with their friends' picks, all of them on shows of `schedule` (ADR-007). */
  groups: GroupPicks[];
};

/** A selection saved without a connection, waiting to be synced to its owner's account. */
export type PendingSelection = {
  version: 1;
  /** Its owner; always the same as the one in its key. */
  userId: string;
  showIds: string[];
  /** ISO 8601 instant. */
  savedAt: string;
};

/** One device copy at a time: the last user who saw `/` online. */
export const SNAPSHOT_KEY = "mi-grilla:snapshot";

const PENDING_KEY_PREFIX = "mi-grilla:pending:";

// The same limits as `src/server/selection.ts`, which `src/lib/` cannot import.
const SHOW_ID_PATTERN = /^[a-z0-9-]+$/;
const SHOW_ID_MAX_LENGTH = 64;

/** `YYYY-MM-DDTHH:mm[:ss[.sss]]` and `Z` or an offset, as `Date.prototype.toISOString` and kin. */
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** The key of the pending selection of `userId`: reading another user's means asking for theirs. */
export function pendingKey(userId: string): string {
  return `${PENDING_KEY_PREFIX}${userId}`;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** `value` as unique show ids with the server's pattern, or `null`. */
function showIdsOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  for (const id of value as unknown[]) {
    if (!isBoundedString(id, SHOW_ID_MAX_LENGTH) || !SHOW_ID_PATTERN.test(id) || seen.has(id)) {
      return null;
    }
    seen.add(id);
  }
  return [...seen];
}

function dayOf(value: unknown): FestivalDay | null {
  if (
    !isFields(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.date !== "string" ||
    typeof value.position !== "number"
  ) {
    return null;
  }
  return { id: value.id, name: value.name, date: value.date, position: value.position };
}

function stageOf(value: unknown): Stage | null {
  if (
    !isFields(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.position !== "number"
  ) {
    return null;
  }
  return { id: value.id, name: value.name, position: value.position };
}

function showOf(value: unknown): Show | null {
  if (
    !isFields(value) ||
    typeof value.id !== "string" ||
    typeof value.dayId !== "string" ||
    typeof value.stageId !== "string" ||
    typeof value.artist !== "string" ||
    !isNullableString(value.subtitle) ||
    typeof value.startsAt !== "string" ||
    typeof value.endsAt !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    dayId: value.dayId,
    stageId: value.stageId,
    artist: value.artist,
    subtitle: value.subtitle,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
  };
}

/** Every item of a non-empty array through `parse`, or `null` if it is empty or any item fails. */
function nonEmptyListOf<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const items: T[] = [];
  for (const item of value as unknown[]) {
    const parsed = parse(item);
    if (parsed === null) {
      return null;
    }
    items.push(parsed);
  }
  return items;
}

function scheduleOf(value: unknown): Schedule | null {
  if (!isFields(value)) {
    return null;
  }
  const days = nonEmptyListOf(value.days, dayOf);
  const stages = nonEmptyListOf(value.stages, stageOf);
  const shows = nonEmptyListOf(value.shows, showOf);
  if (!days || !stages || !shows) {
    return null;
  }
  return { days, stages, shows };
}

/** The device copy stored as `raw`, or `null` if it is missing, malformed or of another version. */
export function parseSnapshot(raw: string | null): DeviceSnapshot | null {
  const value = parseJson(raw);
  if (
    !isFields(value) ||
    value.version !== FORMAT_VERSION ||
    !isBoundedString(value.userId, USER_ID_MAX_LENGTH) ||
    !isBoundedString(value.userName, USER_NAME_MAX_LENGTH)
  ) {
    return null;
  }
  const schedule = scheduleOf(value.schedule);
  const savedShowIds = showIdsOf(value.savedShowIds);
  if (!schedule || !savedShowIds) {
    return null;
  }
  const known = new Set(schedule.shows.map((show) => show.id));
  if (!savedShowIds.every((id) => known.has(id))) {
    return null;
  }
  return {
    version: FORMAT_VERSION,
    userId: value.userId,
    userName: value.userName,
    schedule,
    savedShowIds,
    // Invalid or missing groups cost only the groups, never the offline grid (R-04).
    groups: groupPicksOf(value.groups, known),
  };
}

/**
 * The pending selection stored as `raw` if it belongs to `userId`, or `null`. The owner inside the
 * value must match the one asked for, not only the key it was read from.
 */
export function parsePending(raw: string | null, userId: string): PendingSelection | null {
  const value = parseJson(raw);
  if (
    !isFields(value) ||
    value.version !== FORMAT_VERSION ||
    !isBoundedString(value.userId, USER_ID_MAX_LENGTH) ||
    value.userId !== userId ||
    typeof value.savedAt !== "string" ||
    !ISO_INSTANT_PATTERN.test(value.savedAt) ||
    Number.isNaN(Date.parse(value.savedAt))
  ) {
    return null;
  }
  const showIds = showIdsOf(value.showIds);
  if (!showIds) {
    return null;
  }
  return { version: FORMAT_VERSION, userId: value.userId, showIds, savedAt: value.savedAt };
}
