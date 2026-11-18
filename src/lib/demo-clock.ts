/**
 * The simulated clock of `/demo` (FEAT-005b, FR-01 and FR-02). Pure: no I/O. The browser channel
 * that carries it to the app inside the iPhone lives in `src/components/demo-clock.ts` (ADR-007).
 */
import { posterTimeToInstant, TIME_PATTERN } from "@/lib/festival-time";

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
