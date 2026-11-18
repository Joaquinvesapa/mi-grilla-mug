// Festival wall-clock helpers. No I/O and no value imports: the seed runs this file with plain Node
// (type stripping), so it only uses syntax Node can erase (no enums, no parameter properties).
import type { FestivalDay } from "./schedule-types.ts";

export const FESTIVAL_TIME_ZONE = "America/Argentina/Buenos_Aires";
/** Argentina has had no daylight saving time since 2009: the offset is fixed. */
export const FESTIVAL_UTC_OFFSET = "-03:00";

/** A festival day runs from 06:00 to 06:00 of the next calendar day (FR-04, FR-08). */
const DAY_START_HOUR = 6;
const DAY_MS = 86_400_000;

/** `YYYY-MM-DD`. Only the shape: `posterTimeToInstant` also rejects dates that do not exist. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** A poster time, `HH:MM` from 00:00 to 23:59. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const CLOCK_FORMAT = new Intl.DateTimeFormat("es-AR", {
  timeZone: FESTIVAL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function assertDate(date: string): void {
  const probe = new Date(`${date}T00:00:00.000Z`);
  // A real calendar date round-trips; 2026-02-30 does not.
  if (
    !DATE_PATTERN.test(date) ||
    Number.isNaN(probe.getTime()) ||
    probe.toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError("Fecha inválida: se espera YYYY-MM-DD.");
  }
}

/**
 * The instant of a poster time (`HH:MM`, Buenos Aires) on the festival day that starts on `date`.
 * Times from 00:00 to 05:59 belong to the next calendar day: Peggy Gou plays Friday 23:30–01:00.
 */
export function posterTimeToInstant(date: string, time: string): Date {
  assertDate(date);
  if (!TIME_PATTERN.test(time)) {
    throw new RangeError("Hora inválida: se espera HH:MM.");
  }
  const instant = new Date(`${date}T${time}:00.000${FESTIVAL_UTC_OFFSET}`);
  const hour = Number(time.slice(0, 2));
  // Adding a whole day is exact because the offset never changes.
  return hour < DAY_START_HOUR ? new Date(instant.getTime() + DAY_MS) : instant;
}

/** `"HH:MM"` (24 h) of `instant` on the festival's clock. */
export function formatClock(instant: Date): string {
  return CLOCK_FORMAT.format(instant);
}

/**
 * The id of the festival day whose `[date 06:00, date+1 06:00)` interval contains `now`, or `null`
 * outside the festival. Saturday 00:30 is still Friday (FR-06 of FEAT-005a).
 */
export function festivalDayAt(
  now: Date,
  days: readonly Pick<FestivalDay, "id" | "date">[],
): string | null {
  const time = now.getTime();
  const current = days.find((day) => {
    const start = posterTimeToInstant(day.date, "06:00").getTime();
    return time >= start && time < start + DAY_MS;
  });
  return current ? current.id : null;
}

/**
 * The id of the festival day whose `[date 06:00, date+1 06:00)` interval contains `now`. Outside
 * the festival, the day in position 1 (the lowest position if none is 1).
 */
export function festivalDayFor(
  now: Date,
  days: readonly Pick<FestivalDay, "id" | "date" | "position">[],
): string {
  const current = festivalDayAt(now, days);
  if (current !== null) {
    return current;
  }
  const first = [...days].sort((a, b) => a.position - b.position)[0];
  if (!first) {
    throw new RangeError("No hay días del festival.");
  }
  return first.id;
}
