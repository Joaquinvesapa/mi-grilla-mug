import { describe, expect, it } from "vitest";

import { findClashes } from "@/lib/clashes";
import { posterTimeToInstant } from "@/lib/festival-time";
import type { Show } from "@/lib/schedule-types";

const DATES: Readonly<Record<string, string>> = { fri: "2026-03-13", sat: "2026-03-14" };

function show(id: string, start: string, end: string, dayId = "fri"): Show {
  const date = DATES[dayId] ?? "2026-03-13";
  return {
    id,
    dayId,
    stageId: "flow",
    artist: id,
    subtitle: null,
    startsAt: posterTimeToInstant(date, start).toISOString(),
    endsAt: posterTimeToInstant(date, end).toISOString(),
  };
}

describe("findClashes", () => {
  it("test-clashes-overlap: two selected shows sharing one minute are both in the set", () => {
    const shows = [
      show("a", "17:00", "18:01"),
      show("b", "18:00", "19:00"),
      show("c", "20:00", "21:00"),
      // Past midnight it still compares instants, not wall-clock strings.
      show("d", "23:30", "01:00"),
      show("e", "00:30", "01:30"),
    ];

    const clashes = findClashes(shows, new Set(["a", "b", "c", "d", "e"]));

    expect([...clashes].sort()).toStrictEqual(["a", "b", "d", "e"]);
  });

  it("test-clashes-edge-rejected: touching at 18:00 is no clash, nor one with an unselected show or one of another day", () => {
    const shows = [
      show("a", "17:00", "18:00"),
      show("b", "18:00", "19:00"),
      show("unselected", "17:30", "18:30"),
      show("saturday", "17:00", "18:00", "sat"),
    ];

    expect(findClashes(shows, new Set(["a", "b"]))).toStrictEqual(new Set());
    expect(findClashes(shows, new Set(["a", "saturday"]))).toStrictEqual(new Set());
    expect(findClashes(shows, new Set(["a", "unknown-id"]))).toStrictEqual(new Set());

    // Same instants, different day: only the day keeps them apart.
    const otherDay = { ...show("other-day", "17:30", "18:30"), dayId: "sat" };
    expect(findClashes([...shows, otherDay], new Set(["a", "other-day"]))).toStrictEqual(new Set());
  });
});
