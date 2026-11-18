/**
 * The simulated clock of `/demo` (FEAT-005b, FR-01 and FR-02). Pure: no I/O. The browser channel
 * that carries it to the app inside the iPhone lives in `src/components/demo-clock.ts` (ADR-007).
 */
import { posterTimeToInstant, TIME_PATTERN } from "@/lib/festival-time";
import type { Schedule } from "@/lib/schedule-types";

const MINUTE_MS = 60_000;
/** The step of the "±15 min" buttons: the clock never moves past its last 15-minute slot. */
const SHIFT_STEP_MINUTES = 15;

/** The calendar date each festival day starts on, the same as `data/schedule.json`. */
export const DEMO_FESTIVAL_DATES = {
  fri: "2026-03-13",
  sat: "2026-03-14",
  sun: "2026-03-15",
} as const;

export type DemoDayId = keyof typeof DEMO_FESTIVAL_DATES;

/** `/demo` opens on Friday, March 13, 2026, at 22:30 (FR-02). */
export const DEMO_CLOCK_START = posterTimeToInstant(DEMO_FESTIVAL_DATES.fri, "22:30");
/** The first minute of the festival: Friday 06:00, where `festivalDayAt` starts Friday. */
export const DEMO_CLOCK_MIN = posterTimeToInstant(DEMO_FESTIVAL_DATES.fri, "06:00");
/** Monday 06:00, exclusive: where `festivalDayAt` stops returning Sunday. */
export const DEMO_CLOCK_MAX = new Date(
  posterTimeToInstant(DEMO_FESTIVAL_DATES.sun, "06:00").getTime() + 1_440 * MINUTE_MS,
);

/** `type` of the message `/demo` sends to the iframe with the simulated time. */
export const DEMO_CLOCK_MESSAGE = "mi-grilla:demo-clock";
/** `type` of the message the iframe sends to `/demo` to ask for the current time. */
export const DEMO_CLOCK_HELLO = "mi-grilla:demo-clock-hello";

export type DemoClockMessage = { type: typeof DEMO_CLOCK_MESSAGE; at: number };
export type DemoClockHello = { type: typeof DEMO_CLOCK_HELLO };

function isDemoDayId(dayId: string): dayId is DemoDayId {
  // `Object.hasOwn`, not `in`: "toString" is not a festival day.
  return Object.hasOwn(DEMO_FESTIVAL_DATES, dayId);
}

function isPlainRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

/**
 * The instant of `time` (`HH:MM`) on the festival day `dayId`, or `null` if either is invalid.
 * Before 06:00 it is the next calendar day: Saturday 01:00 is Sunday the 15th.
 */
export function demoInstant(dayId: string, time: string): Date | null {
  if (!isDemoDayId(dayId) || !TIME_PATTERN.test(time)) {
    return null;
  }
  return posterTimeToInstant(DEMO_FESTIVAL_DATES[dayId], time);
}

/**
 * `instant` moved by `minutes`, kept within the 3 festival days: from Friday 06:00 to Monday
 * 05:45, the last slot before the exclusive end.
 */
export function shiftDemoClock(instant: Date, minutes: number): Date {
  const min = DEMO_CLOCK_MIN.getTime();
  const max = DEMO_CLOCK_MAX.getTime() - SHIFT_STEP_MINUTES * MINUTE_MS;
  const shifted = instant.getTime() + minutes * MINUTE_MS;
  return new Date(Math.min(Math.max(shifted, min), max));
}

/**
 * The time carried by a clock message, or `null` if `data` is not `{ type: DEMO_CLOCK_MESSAGE, at }`
 * with `at` a finite instant within the festival (R-02).
 */
export function parseDemoClockMessage(data: unknown): Date | null {
  if (!isPlainRecord(data) || data.type !== DEMO_CLOCK_MESSAGE) {
    return null;
  }
  const at = data.at;
  if (
    typeof at !== "number" ||
    !Number.isFinite(at) ||
    at < DEMO_CLOCK_MIN.getTime() ||
    at >= DEMO_CLOCK_MAX.getTime()
  ) {
    return null;
  }
  return new Date(at);
}

/** Whether `data` is the iframe's `{ type: DEMO_CLOCK_HELLO }` greeting. */
export function isDemoClockHello(data: unknown): boolean {
  return isPlainRecord(data) && data.type === DEMO_CLOCK_HELLO;
}

const DAY_MINUTES = 1_440;
/** The festival day starts at 06:00: the slider counts minutes from there. */
const DAY_START_MINUTES = 360;

/** The slider moves in 5-minute steps. */
export const DEMO_SLIDER_STEP = 5;
/** Its last stop: 05:55 of the next calendar day, the last slot before the exclusive end. */
export const DEMO_SLIDER_MAX = DAY_MINUTES - DEMO_SLIDER_STEP;

/** An hour mark under the slider: `ratio` is its position along the track, from 0 to 1. */
export type DemoSliderTick = { label: string; ratio: number };

/** A mark every 3 h, 06:00 → 06:00 of the next day. */
export const DEMO_SLIDER_TICKS: readonly DemoSliderTick[] = Array.from(
  { length: 9 },
  (_, index) => {
    const minutes = index * 180;
    return { label: sliderMinutesToClock(minutes % DAY_MINUTES), ratio: minutes / DAY_MINUTES };
  },
);

/** Minutes since 06:00 of the festival day for `clock` (`HH:MM`): 00:00–05:59 come after 23:59. */
export function clockToSliderMinutes(clock: string): number {
  const total = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
  return (total - DAY_START_MINUTES + DAY_MINUTES) % DAY_MINUTES;
}

/** The `HH:MM` that lies `minutes` after 06:00 of the festival day. */
export function sliderMinutesToClock(minutes: number): string {
  const total = (Math.round(minutes) + DAY_START_MINUTES) % DAY_MINUTES;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const MANUAL_PATTERN = /^(\d{1,2}):?(\d{2})$/;

/**
 * What was typed in the manual field as `HH:MM`, or `null` if it is not a time. Accepts `HH:MM` and
 * `HHMM` (`22:40`, `2240`, `6:00`). Every hour of the clock is valid: 00:00–05:59 is the night of
 * the selected festival day.
 */
export function parseManualClock(text: string): string | null {
  const match = MANUAL_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

/** A stretch of the festival day, as fractions (0 to 1) of its 24 h. */
export type DemoTimelineSpan = { left: number; width: number };
export type DemoTimelineRow = { stageId: string; name: string; spans: DemoTimelineSpan[] };

/**
 * One row per stage, in column order, with when it has shows on the festival day `dayId`. A day
 * the demo does not know gives empty rows.
 */
export function stageTimelineRows(schedule: Schedule, dayId: string): DemoTimelineRow[] {
  const date = isDemoDayId(dayId) ? DEMO_FESTIVAL_DATES[dayId] : null;
  const start = date ? posterTimeToInstant(date, "06:00").getTime() : 0;
  const total = DAY_MINUTES * MINUTE_MS;
  const clamp = (ratio: number) => Math.min(1, Math.max(0, ratio));
  return [...schedule.stages]
    .sort((a, b) => a.position - b.position)
    .map((stage) => ({
      stageId: stage.id,
      name: stage.name,
      spans: date
        ? schedule.shows
            .filter((show) => show.dayId === dayId && show.stageId === stage.id)
            .map((show) => {
              const left = clamp((Date.parse(show.startsAt) - start) / total);
              const right = clamp((Date.parse(show.endsAt) - start) / total);
              return { left, width: right - left };
            })
        : [],
    }));
}
