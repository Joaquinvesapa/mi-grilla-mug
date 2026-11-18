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
  DEMO_SLIDER_MAX,
  DEMO_SLIDER_STEP,
  DEMO_SLIDER_TICKS,
  clockToSliderMinutes,
  isDemoClockHello,
  parseDemoClockMessage,
  parseManualClock,
  shiftDemoClock,
  sliderMinutesToClock,
  stageTimelineRows,
} from "@/lib/demo-clock";
import type { Schedule } from "@/lib/schedule-types";
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

describe("demo-clock: slider", () => {
  it("demo-clock: el slider recorre 06:00 → 05:55 del día siguiente de a 5 minutos", () => {
    expect(DEMO_SLIDER_STEP).toBe(5);
    expect(DEMO_SLIDER_MAX).toBe(1435);
    expect(clockToSliderMinutes("06:00")).toBe(0);
    expect(clockToSliderMinutes("22:40")).toBe(1000);
    // 00:00–05:59 belong to the previous festival day: they come after 23:59.
    expect(clockToSliderMinutes("00:00")).toBe(1080);
    expect(clockToSliderMinutes("05:55")).toBe(DEMO_SLIDER_MAX);
    expect(sliderMinutesToClock(0)).toBe("06:00");
    expect(sliderMinutesToClock(1000)).toBe("22:40");
    expect(sliderMinutesToClock(1080)).toBe("00:00");
    expect(sliderMinutesToClock(DEMO_SLIDER_MAX)).toBe("05:55");
  });

  it("demo-clock: las marcas del slider van cada 3 h, de 06:00 a 06:00", () => {
    expect(DEMO_SLIDER_TICKS.map((tick) => tick.label)).toEqual([
      "06:00",
      "09:00",
      "12:00",
      "15:00",
      "18:00",
      "21:00",
      "00:00",
      "03:00",
      "06:00",
    ]);
    expect(DEMO_SLIDER_TICKS[0]?.ratio).toBe(0);
    expect(DEMO_SLIDER_TICKS[8]?.ratio).toBe(1);
    expect(DEMO_SLIDER_TICKS[6]?.ratio).toBeCloseTo(0.75);
  });
});

describe("demo-clock: parseManualClock", () => {
  it("demo-clock: acepta HH:MM y HHMM y devuelve HH:MM", () => {
    expect(parseManualClock("22:40")).toBe("22:40");
    expect(parseManualClock("2240")).toBe("22:40");
    expect(parseManualClock(" 0130 ")).toBe("01:30");
    expect(parseManualClock("6:00")).toBe("06:00");
    expect(parseManualClock("00:00")).toBe("00:00");
    expect(parseManualClock("05:59")).toBe("05:59");
    expect(parseManualClock("23:59")).toBe("23:59");
  });

  it("demo-clock: rechaza lo que no es una hora", () => {
    for (const text of [
      "",
      "   ",
      "24:00",
      "12:60",
      "2460",
      "abc",
      "12",
      "12:3",
      "22-40",
      "1:2:3",
    ]) {
      expect(parseManualClock(text), text).toBeNull();
    }
  });
});

describe("demo-clock: stageTimelineRows", () => {
  const schedule: Schedule = {
    days: [{ id: "fri", name: "Viernes", date: "2026-03-13", position: 1 }],
    stages: [
      { id: "samsung", name: "Samsung", position: 2 },
      { id: "flow", name: "Flow", position: 1 },
    ],
    shows: [
      {
        id: "a",
        dayId: "fri",
        stageId: "flow",
        artist: "A",
        subtitle: null,
        startsAt: "2026-03-13T18:00:00-03:00",
        endsAt: "2026-03-13T19:30:00-03:00",
      },
      {
        id: "b",
        dayId: "fri",
        stageId: "samsung",
        artist: "B",
        subtitle: null,
        startsAt: "2026-03-13T23:30:00-03:00",
        endsAt: "2026-03-14T01:00:00-03:00",
      },
      {
        id: "c",
        dayId: "sat",
        stageId: "flow",
        artist: "C",
        subtitle: null,
        startsAt: "2026-03-14T18:00:00-03:00",
        endsAt: "2026-03-14T19:00:00-03:00",
      },
    ],
  };

  it("demo-clock: una fila por escenario, en orden de columna, con los shows del día", () => {
    const rows = stageTimelineRows(schedule, "fri");

    expect(rows.map((row) => row.stageId)).toEqual(["flow", "samsung"]);
    const flow = rows[0]?.spans ?? [];
    expect(flow).toHaveLength(1);
    expect(flow[0]?.left).toBeCloseTo(12 / 24);
    expect(flow[0]?.width).toBeCloseTo(1.5 / 24);
    // Past midnight still lies inside the festival day.
    const samsung = rows[1]?.spans ?? [];
    expect(samsung[0]?.left).toBeCloseTo(17.5 / 24);
    expect(samsung[0]?.width).toBeCloseTo(1.5 / 24);
  });

  it("demo-clock: un día sin shows deja las filas vacías y un día desconocido también", () => {
    expect(stageTimelineRows(schedule, "sun").map((row) => row.spans)).toEqual([[], []]);
    expect(stageTimelineRows(schedule, "zzz").map((row) => row.spans)).toEqual([[], []]);
  });
});
