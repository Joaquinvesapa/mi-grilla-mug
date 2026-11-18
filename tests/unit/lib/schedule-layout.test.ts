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
  PX_PER_MINUTE,
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
});
