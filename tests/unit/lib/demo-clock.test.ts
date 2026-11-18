import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEMO_CLOCK_HELLO,
  DEMO_CLOCK_MAX,
  DEMO_CLOCK_MESSAGE,
  DEMO_CLOCK_MIN,
  DEMO_CLOCK_START,
  DEMO_FESTIVAL_DATES,
  demoInstant,
  isDemoClockHello,
  parseDemoClockMessage,
  shiftDemoClock,
} from "@/lib/demo-clock";
import { FESTIVAL_UTC_OFFSET, festivalDayAt, formatClock } from "@/lib/festival-time";

const SCHEDULE_PATH = resolve(process.cwd(), "data/schedule.json");

/** A wall-clock time in Buenos Aires (UTC−3) as an instant. */
function festivalClock(isoLocal: string): Date {
  return new Date(`${isoLocal}${FESTIVAL_UTC_OFFSET}`);
}

const DAYS = [
  { id: "fri", date: DEMO_FESTIVAL_DATES.fri },
  { id: "sat", date: DEMO_FESTIVAL_DATES.sat },
  { id: "sun", date: DEMO_FESTIVAL_DATES.sun },
];

describe("demo-clock", () => {
  it("demo-clock: arranca el viernes 13 de marzo de 2026 a las 22:30", () => {
    expect(DEMO_CLOCK_START.toISOString()).toBe(festivalClock("2026-03-13T22:30").toISOString());
    expect(festivalDayAt(DEMO_CLOCK_START, DAYS)).toBe("fri");
    expect(formatClock(DEMO_CLOCK_START)).toBe("22:30");
  });

  it("demo-clock: +15 min pasa de 22:30 a 22:45", () => {
    const shifted = shiftDemoClock(DEMO_CLOCK_START, 15);
    expect(shifted.toISOString()).toBe(festivalClock("2026-03-13T22:45").toISOString());
    expect(formatClock(shifted)).toBe("22:45");
    expect(shiftDemoClock(shifted, -15).toISOString()).toBe(DEMO_CLOCK_START.toISOString());
    // The input is not mutated.
    expect(DEMO_CLOCK_START.toISOString()).toBe(festivalClock("2026-03-13T22:30").toISOString());
  });

  it("demo-clock: los límites del festival acotan el corrimiento de ±15 min", () => {
    expect(DEMO_CLOCK_MIN.toISOString()).toBe(festivalClock("2026-03-13T06:00").toISOString());
    expect(DEMO_CLOCK_MAX.toISOString()).toBe(festivalClock("2026-03-16T06:00").toISOString());

    // −15 from the first minute stays at the first minute.
    expect(shiftDemoClock(DEMO_CLOCK_MIN, -15).toISOString()).toBe(DEMO_CLOCK_MIN.toISOString());
    const lastSlot = festivalClock("2026-03-16T05:45");
    // +15 from the last slot stays there: the max is exclusive.
    expect(shiftDemoClock(lastSlot, 15).toISOString()).toBe(lastSlot.toISOString());
    expect(shiftDemoClock(festivalClock("2026-03-16T05:40"), 15).toISOString()).toBe(
      lastSlot.toISOString(),
    );
    expect(shiftDemoClock(festivalClock("2026-03-13T06:10"), -15).toISOString()).toBe(
      DEMO_CLOCK_MIN.toISOString(),
    );
    // Every clamped instant still falls on a festival day.
    expect(festivalDayAt(shiftDemoClock(lastSlot, 15), DAYS)).toBe("sun");
    expect(festivalDayAt(shiftDemoClock(DEMO_CLOCK_MIN, -15), DAYS)).toBe("fri");
  });

  it("demo-clock: domingo 23:00 y sábado 01:00 caen en su fecha calendario", () => {
    const sunday = demoInstant("sun", "23:00");
    expect(sunday?.toISOString()).toBe(festivalClock("2026-03-15T23:00").toISOString());
    expect(sunday && festivalDayAt(sunday, DAYS)).toBe("sun");

    // Saturday's festival day at 01:00 is Sunday the 15th by the calendar.
    const saturdayLate = demoInstant("sat", "01:00");
    expect(saturdayLate?.toISOString()).toBe(festivalClock("2026-03-15T01:00").toISOString());
    expect(saturdayLate && festivalDayAt(saturdayLate, DAYS)).toBe("sat");

    expect(demoInstant("sat", "18:00")?.toISOString()).toBe(
      festivalClock("2026-03-14T18:00").toISOString(),
    );
    expect(demoInstant("fri", "22:30")?.toISOString()).toBe(DEMO_CLOCK_START.toISOString());
  });

  it("demo-clock: las fechas coinciden con data/schedule.json", () => {
    const schedule = JSON.parse(readFileSync(SCHEDULE_PATH, "utf8")) as {
      days: { id: string; date: string }[];
    };
    const fromJson = Object.fromEntries(schedule.days.map((day) => [day.id, day.date]));
    expect(fromJson).toEqual(DEMO_FESTIVAL_DATES);
  });

  it("demo-clock: un día o una hora inválidos devuelven null", () => {
    expect(demoInstant("mon", "22:30")).toBeNull();
    expect(demoInstant("", "22:30")).toBeNull();
    expect(demoInstant("toString", "22:30")).toBeNull();
    expect(demoInstant("fri", "24:00")).toBeNull();
    expect(demoInstant("fri", "9:30")).toBeNull();
    expect(demoInstant("fri", "22:60")).toBeNull();
    expect(demoInstant("fri", "")).toBeNull();
  });

  it("demo-clock: un mensaje inválido o fuera de rango es rechazado", () => {
    const at = DEMO_CLOCK_START.getTime();
    expect(parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at })?.toISOString()).toBe(
      DEMO_CLOCK_START.toISOString(),
    );
    expect(
      parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at: DEMO_CLOCK_MIN.getTime() }),
    ).not.toBeNull();

    expect(parseDemoClockMessage(null)).toBeNull();
    expect(parseDemoClockMessage(undefined)).toBeNull();
    expect(parseDemoClockMessage("22:30")).toBeNull();
    expect(parseDemoClockMessage(at)).toBeNull();
    expect(parseDemoClockMessage([DEMO_CLOCK_MESSAGE, at])).toBeNull();
    expect(parseDemoClockMessage({ type: "other", at })).toBeNull();
    expect(parseDemoClockMessage({ type: DEMO_CLOCK_HELLO, at })).toBeNull();
    expect(parseDemoClockMessage({ at })).toBeNull();
    expect(parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE })).toBeNull();
    expect(parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at: String(at) })).toBeNull();
    expect(parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at: Number.NaN })).toBeNull();
    expect(parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at: Infinity })).toBeNull();
    expect(
      parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at: DEMO_CLOCK_MIN.getTime() - 1 }),
    ).toBeNull();
    expect(
      parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at: DEMO_CLOCK_MAX.getTime() }),
    ).toBeNull();
    expect(parseDemoClockMessage({ type: DEMO_CLOCK_MESSAGE, at: Date.now() })).toBeNull();

    expect(isDemoClockHello({ type: DEMO_CLOCK_HELLO })).toBe(true);
    expect(isDemoClockHello({ type: DEMO_CLOCK_MESSAGE, at })).toBe(false);
    expect(isDemoClockHello(DEMO_CLOCK_HELLO)).toBe(false);
    expect(isDemoClockHello(null)).toBe(false);
    expect(isDemoClockHello([DEMO_CLOCK_HELLO])).toBe(false);
    expect(DEMO_CLOCK_MESSAGE).not.toBe(DEMO_CLOCK_HELLO);
  });
});
