// Where each show sits on the grid's time axis. Pure: no I/O. Shows come with ISO instants (as in
// `schedule-types.ts`); the axis and its marks are `Date`s, ready for `formatClock`.
import type { Show } from "@/lib/schedule-types";

/** Vertical scale of the grid: a 60-minute show measures 120 px (FR-03). */
export const PX_PER_MINUTE = 2;
/** No show is shorter than a comfortable tap target, whatever its duration (NFR-03). */
export const MIN_BLOCK_HEIGHT = 44;

const MINUTE_MS = 60_000;
// The festival's offset is a whole number of hours (-03:00, no DST), so a whole UTC hour is a
// whole hour on the festival's clock too.
const HOUR_MS = 60 * MINUTE_MS;

export type DayAxis = { start: Date; end: Date };

type Timed = Pick<Show, "startsAt" | "endsAt">;

/**
 * From the whole hour at or before the first start to the whole hour at or after the last end. The
 * axis is made of instants, so a show past midnight extends it to 01:00 of the next day (FR-04).
 */
export function dayAxis(shows: readonly Timed[]): DayAxis {
  if (shows.length === 0) {
    throw new RangeError("Un día sin shows no tiene eje.");
  }
  const starts = shows.map((show) => Date.parse(show.startsAt));
  const ends = shows.map((show) => Date.parse(show.endsAt));
  const first = Math.min(...starts);
  const last = Math.max(...ends);
  return {
    start: new Date(Math.floor(first / HOUR_MS) * HOUR_MS),
    end: new Date(Math.ceil(last / HOUR_MS) * HOUR_MS),
  };
}

/** One instant per whole hour of the axis, both ends included. */
export function hourMarks(axis: DayAxis): Date[] {
  const marks: Date[] = [];
  for (let time = axis.start.getTime(); time <= axis.end.getTime(); time += HOUR_MS) {
    marks.push(new Date(time));
  }
  return marks;
}

/** Offset from the axis start and height, in px: the duration at scale, never under 44 px. */
export function blockGeometry(show: Timed, axis: DayAxis): { top: number; height: number } {
  const start = Date.parse(show.startsAt);
  const minutesFromStart = (start - axis.start.getTime()) / MINUTE_MS;
  const duration = (Date.parse(show.endsAt) - start) / MINUTE_MS;
  return {
    top: minutesFromStart * PX_PER_MINUTE,
    height: Math.max(duration * PX_PER_MINUTE, MIN_BLOCK_HEIGHT),
  };
}

/** A block with a row of friends' initials needs room for it under the time line (FEAT-006c). */
export const MIN_BLOCK_HEIGHT_WITH_FRIENDS = 60;

/**
 * A block with friends' initials shows the name in 2 lines only from this height on: padding 8 +
 * name in 2 lines 32.5 (13 px × 1.25) + gap 2 + time line 15 + gap 2 + initials row 16 ≈ 75.5 px.
 * Under it, the name is clamped to 1 line so the time line and the row still fit (FEAT-006c).
 */
export const NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS = 76;

/**
 * The height of a block that carries friends' initials: at least 60 px, so the row fits under the
 * time line without hiding it, but never past `nextTop`, where the next show of the same stage
 * starts. Without a next show (`undefined`) there is no cap.
 */
export function heightWithFriends(
  geometry: { top: number; height: number },
  nextTop: number | undefined,
): number {
  const height = Math.max(geometry.height, MIN_BLOCK_HEIGHT_WITH_FRIENDS);
  return nextTop === undefined ? height : Math.min(height, nextTop - geometry.top);
}
