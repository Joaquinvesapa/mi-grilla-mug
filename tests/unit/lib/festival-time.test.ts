import { describe, expect, it } from "vitest";

import {
  DATE_PATTERN,
  FESTIVAL_TIME_ZONE,
  FESTIVAL_UTC_OFFSET,
  festivalDayAt,
  festivalDayFor,
  formatClock,
  posterTimeToInstant,
  TIME_PATTERN,
} from "@/lib/festival-time";
import type { FestivalDay } from "@/lib/schedule-types";

const DAYS: FestivalDay[] = [
  { id: "fri", name: "Viernes", date: "2026-03-13", position: 1 },
  { id: "sat", name: "Sábado", date: "2026-03-14", position: 2 },
  { id: "sun", name: "Domingo", date: "2026-03-15", position: 3 },
];

/** A wall-clock time in Buenos Aires (UTC−3) as an instant. */
function festivalClock(isoLocal: string): Date {
  return new Date(`${isoLocal}${FESTIVAL_UTC_OFFSET}`);
}

describe("festival time constants", () => {
  it("uses the Buenos Aires zone with its fixed UTC−3 offset", () => {
    expect(FESTIVAL_TIME_ZONE).toBe("America/Argentina/Buenos_Aires");
    expect(FESTIVAL_UTC_OFFSET).toBe("-03:00");
  });
});

describe("DATE_PATTERN and TIME_PATTERN", () => {
  it("are exported for the seed, which validates the JSON with the same patterns", () => {
    expect(DATE_PATTERN).toBeInstanceOf(RegExp);
    expect(TIME_PATTERN).toBeInstanceOf(RegExp);
    expect(DATE_PATTERN.test("2026-03-13")).toBe(true);
    expect(DATE_PATTERN.test("13/03/2026")).toBe(false);
    expect(TIME_PATTERN.test("23:59")).toBe(true);
    expect(TIME_PATTERN.test("00:00")).toBe(true);
    expect(TIME_PATTERN.test("24:00")).toBe(false);
    expect(TIME_PATTERN.test("9:30")).toBe(false);
  });
});

describe("posterTimeToInstant", () => {
  it("test-poster-time-after-midnight: 00:00–05:59 belong to the next calendar day, 06:00 onwards to the same one", () => {
    expect(posterTimeToInstant("2026-03-13", "01:00").toISOString()).toBe(
      "2026-03-14T04:00:00.000Z",
    );
    expect(posterTimeToInstant("2026-03-13", "23:30").toISOString()).toBe(
      "2026-03-14T02:30:00.000Z",
    );
    expect(posterTimeToInstant("2026-03-13", "05:59").toISOString()).toBe(
      "2026-03-14T08:59:00.000Z",
    );
    expect(posterTimeToInstant("2026-03-13", "06:00").toISOString()).toBe(
      "2026-03-13T09:00:00.000Z",
    );
    expect(posterTimeToInstant("2026-03-13", "00:00").toISOString()).toBe(
      "2026-03-14T03:00:00.000Z",
    );
  });

  it("rejects a date or a time that is not YYYY-MM-DD / HH:MM", () => {
    expect(() => posterTimeToInstant("13/03/2026", "23:30")).toThrow(RangeError);
    expect(() => posterTimeToInstant("2026-03-13", "9:30")).toThrow(RangeError);
    expect(() => posterTimeToInstant("2026-03-13", "24:00")).toThrow(RangeError);
    expect(() => posterTimeToInstant("2026-03-13", "12:60")).toThrow(RangeError);
    expect(() => posterTimeToInstant("2026-02-30", "12:00")).toThrow(RangeError);
  });
});

describe("formatClock", () => {
  it("test-format-clock: shows the festival's wall clock, 24 h, for instants after midnight too", () => {
    expect(formatClock(new Date("2026-03-14T04:00:00.000Z"))).toBe("01:00");
    expect(formatClock(new Date("2026-03-14T02:30:00.000Z"))).toBe("23:30");
    expect(formatClock(new Date("2026-03-14T03:00:00.000Z"))).toBe("00:00");
  });
});

describe("festivalDayAt", () => {
  it("festival-time: festivalDayAt devuelve el día o null fuera del festival", () => {
    // AC-06: Peggy Gou's Saturday 00:30 still belongs to Friday.
    expect(festivalDayAt(festivalClock("2026-03-14T00:30:00"), DAYS)).toBe("fri");
    expect(festivalDayAt(festivalClock("2026-03-13T06:00:00"), DAYS)).toBe("fri");
    expect(festivalDayAt(festivalClock("2026-03-14T05:59:59"), DAYS)).toBe("fri");
    expect(festivalDayAt(festivalClock("2026-03-14T06:00:00"), DAYS)).toBe("sat");
    expect(festivalDayAt(festivalClock("2026-03-16T00:35:00"), DAYS)).toBe("sun");
    // Outside the three days there is no festival day.
    expect(festivalDayAt(festivalClock("2026-03-13T05:59:59"), DAYS)).toBeNull();
    expect(festivalDayAt(festivalClock("2026-03-16T06:00:00"), DAYS)).toBeNull();
    expect(festivalDayAt(festivalClock("2026-11-17T12:00:00"), DAYS)).toBeNull();
    expect(festivalDayAt(new Date(), [])).toBeNull();
  });
});

describe("festivalDayFor", () => {
  it("test-festival-day-during: a festival day runs from its 06:00 to the next day's 06:00", () => {
    expect(festivalDayFor(festivalClock("2026-03-14T21:30:00"), DAYS)).toBe("sat");
    expect(festivalDayFor(festivalClock("2026-03-15T00:30:00"), DAYS)).toBe("sat");
    expect(festivalDayFor(festivalClock("2026-03-15T05:59:59"), DAYS)).toBe("sat");
    expect(festivalDayFor(festivalClock("2026-03-15T06:00:00"), DAYS)).toBe("sun");
    expect(festivalDayFor(festivalClock("2026-03-13T06:00:00"), DAYS)).toBe("fri");
  });

  it("test-festival-day-outside: outside the three days it is the day in position 1", () => {
    expect(festivalDayFor(festivalClock("2026-11-17T12:00:00"), DAYS)).toBe("fri");
    expect(festivalDayFor(festivalClock("2026-03-13T05:59:00"), DAYS)).toBe("fri");
    expect(festivalDayFor(festivalClock("2026-03-16T06:00:00"), DAYS)).toBe("fri");
    // The order of the array does not matter: position does.
    expect(festivalDayFor(festivalClock("2026-11-17T12:00:00"), [...DAYS].reverse())).toBe("fri");
  });

  it("falls back to the lowest position when none is 1, and rejects an empty list", () => {
    const shifted = DAYS.map((day) => ({ ...day, position: day.position + 1 }));
    expect(festivalDayFor(festivalClock("2026-11-17T12:00:00"), shifted)).toBe("fri");
    expect(() => festivalDayFor(new Date(), [])).toThrow(RangeError);
  });
});
