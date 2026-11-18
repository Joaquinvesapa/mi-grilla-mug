import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { formatClock, posterTimeToInstant } from "@/lib/festival-time";
import {
  blockGeometry,
  dayAxis,
  heightWithFriends,
  hourMarks,
  MIN_BLOCK_HEIGHT,
  MIN_BLOCK_HEIGHT_WITH_FRIENDS,
  nowOffset,
  NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS,
  PX_PER_MINUTE,
  showPhase,
} from "@/lib/schedule-layout";
import type { Show } from "@/lib/schedule-types";

const FRIDAY = "2026-03-13";

type FileShow = {
  id: string;
  dayId: string;
  stageId: string;
  artist: string;
  start: string;
  end: string;
};

/** A show of Friday from poster times, with ISO instants as `schedule-types.ts` defines them. */
function show(start: string, end: string, id = `fri-test-${start.replace(":", "")}`): Show {
  return {
    id,
    dayId: "fri",
    stageId: "flow",
    artist: "Prueba",
    subtitle: null,
    startsAt: posterTimeToInstant(FRIDAY, start).toISOString(),
    endsAt: posterTimeToInstant(FRIDAY, end).toISOString(),
  };
}

function fridayShows(): Show[] {
  const file = JSON.parse(readFileSync(resolve(process.cwd(), "data/schedule.json"), "utf8")) as {
    shows: FileShow[];
  };
  return file.shows
    .filter((entry) => entry.dayId === "fri")
    .map((entry) => show(entry.start, entry.end, entry.id));
}

describe("schedule-layout", () => {
  it("test-layout-geometry: 60 min measure 120 px, 45 min 90 px, and top is minutes from the axis start × 2", () => {
    const axis = dayAxis([show("13:00", "14:00"), show("23:00", "00:00")]);

    expect(PX_PER_MINUTE).toBe(2);
    expect(blockGeometry(show("13:00", "14:00"), axis)).toStrictEqual({ top: 0, height: 120 });
    expect(blockGeometry(show("15:00", "15:45"), axis)).toStrictEqual({ top: 240, height: 90 });
    // After midnight the minutes keep counting from the same axis start.
    expect(blockGeometry(show("23:30", "00:15"), axis)).toStrictEqual({ top: 1260, height: 90 });
  });

  it("test-layout-axis-after-midnight: Friday's axis runs from 13:00 to 01:00 and the last mark is 01:00", () => {
    const axis = dayAxis(fridayShows());

    expect(axis.start.toISOString()).toBe(posterTimeToInstant(FRIDAY, "13:00").toISOString());
    expect(axis.end.toISOString()).toBe(posterTimeToInstant(FRIDAY, "01:00").toISOString());
    const marks = hourMarks(axis);
    expect(marks).toHaveLength(13);
    expect(marks.map(formatClock)).toStrictEqual([
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
      "22:00",
      "23:00",
      "00:00",
      "01:00",
    ]);
  });

  it("test-layout-axis-whole-hours: a first start and a last end already on the hour are kept", () => {
    const axis = dayAxis([show("14:00", "15:00"), show("16:10", "17:00")]);

    expect(formatClock(axis.start)).toBe("14:00");
    expect(formatClock(axis.end)).toBe("17:00");
    expect(() => dayAxis([])).toThrow(RangeError);
  });

  it("test-layout-min-height: a 15-minute show measures 44 px and a 30-minute one 60 px", () => {
    const axis = dayAxis([show("13:00", "14:00")]);

    expect(MIN_BLOCK_HEIGHT).toBe(44);
    expect(blockGeometry(show("13:00", "13:15"), axis).height).toBe(44);
    expect(blockGeometry(show("13:00", "13:30"), axis).height).toBe(60);
  });

  it("test-grid-friend-height: with friends a block measures at least 60 px, never past the next show of its stage", () => {
    expect(MIN_BLOCK_HEIGHT_WITH_FRIENDS).toBe(60);
    // Sunday's 20-minute Kidzapalooza shows: 40 px, with the next one 10 minutes later.
    expect(heightWithFriends({ top: 100, height: 44 }, 160)).toBe(60);
    expect(heightWithFriends({ top: 100, height: 40 }, 160)).toBe(60);
    // The next show caps it: it never covers the following block.
    expect(heightWithFriends({ top: 100, height: 44 }, 150)).toBe(50);
    // A block already taller keeps its height.
    expect(heightWithFriends({ top: 0, height: 120 }, 140)).toBe(120);
    // No show after it: no cap.
    expect(heightWithFriends({ top: 100, height: 44 }, undefined)).toBe(60);
    expect(heightWithFriends({ top: 100, height: 90 }, undefined)).toBe(90);
  });

  it("test-name-two-lines-threshold: NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS vale 76 y deja afuera a los bloques de 60 px", () => {
    // padding 8 + name in 2 lines 32.5 + gap 2 + time line 15 + gap 2 + initials row 16 ≈ 75.5 px.
    expect(NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS).toBe(76);
    // The shortest block with friends (Sunday's 20-minute Kidzapalooza shows) stays under it.
    expect(heightWithFriends({ top: 100, height: 44 }, 160)).toBeLessThan(
      NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS,
    );
    // A 45-minute show (90 px) has room for the name in 2 lines.
    expect(heightWithFriends({ top: 0, height: 90 }, undefined)).toBeGreaterThanOrEqual(
      NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS,
    );
  });
});

describe("nowOffset y showPhase", () => {
  const axis = dayAxis([
    {
      startsAt: posterTimeToInstant(FRIDAY, "15:00").toISOString(),
      endsAt: posterTimeToInstant(FRIDAY, "16:00").toISOString(),
    },
    {
      startsAt: posterTimeToInstant(FRIDAY, "23:30").toISOString(),
      endsAt: posterTimeToInstant(FRIDAY, "01:00").toISOString(),
    },
  ]);
  const at = (time: string) => posterTimeToInstant(FRIDAY, time);

  it("test-now-offset: el ahora cae en el eje a 2 px por minuto; fuera del eje no hay línea", () => {
    expect(nowOffset(axis, at("15:00"))).toBe(0);
    expect(nowOffset(axis, at("18:30"))).toBe(420);
    expect(nowOffset(axis, new Date(axis.end))).toBe(1200);
    expect(nowOffset(axis, at("14:59"))).toBeNull();
    expect(nowOffset(axis, new Date(axis.end.getTime() + 60_000))).toBeNull();
  });

  it("test-show-phase: pasado, sonando o por venir; el fin es exclusivo y el inicio inclusivo", () => {
    const show = {
      startsAt: at("18:00").toISOString(),
      endsAt: at("19:00").toISOString(),
    };
    expect(showPhase(show, at("17:59"))).toBe("upcoming");
    expect(showPhase(show, at("18:00"))).toBe("playing");
    expect(showPhase(show, at("18:59"))).toBe("playing");
    expect(showPhase(show, at("19:00"))).toBe("past");
  });
});
