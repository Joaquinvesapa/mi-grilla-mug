/**
 * What plays now and what comes next on each stage (FEAT-005a, "En vivo"). Pure: no I/O. Every
 * comparison is between instants (`Date.parse` of `startsAt`/`endsAt` and `now`), so the device's
 * time zone changes nothing (FR-13).
 */
import { findClashes } from "@/lib/clashes";
import { festivalDayAt } from "@/lib/festival-time";
import type { FestivalDay, Schedule, Show, Stage } from "@/lib/schedule-types";

const MINUTE_MS = 60_000;

export type LiveStage = {
  stage: Stage;
  /** The show playing now on this stage, or `null` ("Nada ahora"). */
  current: Show | null;
  currentSelected: boolean;
  /** How far the current show is: whole minutes left (rounded up) and percent done (0–100). */
  currentProgress: { minutesLeft: number; percent: number } | null;
  /** The current show is chosen and shares a minute with another chosen show of the day. */
  currentClash: boolean;
  /** The next show of this stage on today's festival day, or `null` ("Terminó por hoy"). */
  next: { show: Show; minutesUntil: number } | null;
  nextSelected: boolean;
};

export type LiveView =
  /** Within the hours of shows of a festival day: one row per stage (FR-03, FR-04, FR-07). */
  | { kind: "live"; stages: LiveStage[] }
  /** Outside the hours of shows: the festival's next show (FR-10). */
  | { kind: "idle"; next: { show: Show; stage: Stage; day: FestivalDay; sameDay: boolean } }
  /** From the end of the festival's last show on (FR-11). */
  | { kind: "over" };

/** A show of the grid with its instants already read. */
type TimedShow = { show: Show; stage: Stage; start: number; end: number };

/**
 * The shows that can be placed: readable instants (R-02) on a day and a stage of the grid. Sorted
 * by start and then by stage position, so the first one after `now` is the festival's next show.
 */
function timedShows(schedule: Schedule): TimedShow[] {
  const stages = new Map(schedule.stages.map((stage) => [stage.id, stage]));
  const days = new Set(schedule.days.map((day) => day.id));
  const timed: TimedShow[] = [];
  for (const show of schedule.shows) {
    const stage = stages.get(show.stageId);
    const start = Date.parse(show.startsAt);
    const end = Date.parse(show.endsAt);
    if (stage && days.has(show.dayId) && !Number.isNaN(start) && !Number.isNaN(end)) {
      timed.push({ show, stage, start, end });
    }
  }
  return timed.sort((a, b) => a.start - b.start || a.stage.position - b.stage.position);
}

function liveStages(
  schedule: Schedule,
  today: readonly TimedShow[],
  now: number,
  selectedIds: ReadonlySet<string>,
): LiveStage[] {
  const clashes = findClashes(
    today.map((item) => item.show),
    selectedIds,
  );
  const rows = [...schedule.stages]
    .sort((a, b) => a.position - b.position)
    .map((stage): LiveStage => {
      const own = today.filter((item) => item.stage.id === stage.id);
      // A show plays from its start minute up to the minute before its end (FR-05).
      const playing = own.find((item) => item.start <= now && now < item.end);
      const current = playing?.show ?? null;
      const next = own.find((item) => item.start > now);
      return {
        stage,
        current,
        currentSelected: current !== null && selectedIds.has(current.id),
        currentProgress: playing
          ? {
              minutesLeft: Math.ceil((playing.end - now) / MINUTE_MS),
              percent: Math.min(
                100,
                Math.max(
                  0,
                  Math.round(((now - playing.start) / (playing.end - playing.start)) * 100),
                ),
              ),
            }
          : null,
        currentClash: current !== null && clashes.has(current.id),
        next: next
          ? { show: next.show, minutesUntil: Math.ceil((next.start - now) / MINUTE_MS) }
          : null,
        nextSelected: next !== undefined && selectedIds.has(next.show.id),
      };
    });
  // Stages playing a chosen show first, then the rest; each group in the app's order (FR-07).
  return [
    ...rows.filter((row) => row.currentSelected),
    ...rows.filter((row) => !row.currentSelected),
  ];
}

/**
 * The "En vivo" panel at `now` for the shows in `selectedIds` (the selection on screen, FR-09).
 * Ids that are not shows of the grid are ignored (R-01), and so are shows with an unreadable
 * instant (R-02). Throws `RangeError` if `now` is not a valid date.
 */
export function liveNow(schedule: Schedule, now: Date, selectedIds: ReadonlySet<string>): LiveView {
  const time = now.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError("Hora inválida.");
  }
  const shows = timedShows(schedule);
  const lastEnd = Math.max(...shows.map((item) => item.end));
  // With no readable show, `lastEnd` is -Infinity: over.
  if (time >= lastEnd) {
    return { kind: "over" };
  }

  // Current and next only come from the festival day that contains `now` (FR-06).
  const dayId = festivalDayAt(now, schedule.days);
  const today = shows.filter((item) => item.show.dayId === dayId);
  const firstStart = Math.min(...today.map((item) => item.start));
  const dayEnd = Math.max(...today.map((item) => item.end));
  if (dayId !== null && time >= firstStart && time < dayEnd) {
    return { kind: "live", stages: liveStages(schedule, today, time, selectedIds) };
  }

  const next = shows.find((item) => item.start > time);
  const day = next && schedule.days.find((item) => item.id === next.show.dayId);
  if (!next || !day) {
    // Unreachable with a grid whose days do not overlap: before the last end there is always a
    // later start outside the hours of shows.
    return { kind: "over" };
  }
  return {
    kind: "idle",
    next: { show: next.show, stage: next.stage, day, sameDay: next.show.dayId === dayId },
  };
}
