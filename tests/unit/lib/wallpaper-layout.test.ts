import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { formatClock, posterTimeToInstant } from "@/lib/festival-time";
import { BASE, FOAM } from "@/lib/palette";
import type { FestivalDay, Schedule, Show, Stage } from "@/lib/schedule-types";
import {
  type WallpaperInput,
  ARTIST_FONT_SIZE,
  DIMMED_OPACITY,
  type MeasureText,
  SAFE_BOTTOM,
  SAFE_TOP,
  WALLPAPER_HEIGHT,
  WALLPAPER_WIDTH,
  type WallpaperLayout,
  wallpaperFileName,
  wallpaperLayout,
} from "@/lib/wallpaper-layout";

import { STAGES as SHUFFLED_STAGES } from "../components/schedule-fixture";

// The real grid, built from data/schedule.json the same way the seed does (poster times to
// instants), so the geometry is checked against the 91 shows the app shows.
type ScheduleFile = {
  days: FestivalDay[];
  stages: Stage[];
  shows: {
    id: string;
    dayId: string;
    stageId: string;
    artist: string;
    subtitle?: string;
    start: string;
    end: string;
  }[];
};

const FILE = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/schedule.json"), "utf8"),
) as ScheduleFile;

function toSchedule(file: ScheduleFile): Schedule {
  const dates = new Map(file.days.map((day) => [day.id, day.date]));
  return {
    days: file.days,
    stages: file.stages,
    shows: file.shows.map((item) => {
      const date = dates.get(item.dayId) ?? "";
      return {
        id: item.id,
        dayId: item.dayId,
        stageId: item.stageId,
        artist: item.artist,
        subtitle: item.subtitle ?? null,
        startsAt: posterTimeToInstant(date, item.start).toISOString(),
        endsAt: posterTimeToInstant(date, item.end).toISOString(),
      };
    }),
  };
}

const SCHEDULE = toSchedule(FILE);
const FONT_FAMILY = '"Public Sans", system-ui, sans-serif';
const BAND_TOP = SAFE_TOP;
const BAND_BOTTOM = WALLPAPER_HEIGHT - SAFE_BOTTOM;
const ELLIPSIS = "…";

/** Deterministic stand-in for `ctx.measureText`: every character is 0.6 × the font size wide. */
const measureText: MeasureText = (text, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]);
  return text.length * size * 0.6;
};

function dayOf(id: string): FestivalDay {
  const day = SCHEDULE.days.find((item) => item.id === id);
  if (!day) {
    throw new Error(`no day ${id}`);
  }
  return day;
}

function showsOf(dayId: string): Show[] {
  return SCHEDULE.shows.filter((item) => item.dayId === dayId);
}

function layoutOf(
  dayId: string,
  selectedIds: ReadonlySet<string> = new Set(),
  shows: Show[] = showsOf(dayId),
  overrides: Partial<WallpaperInput> = {},
): WallpaperLayout {
  return wallpaperLayout({
    day: dayOf(dayId),
    stages: SCHEDULE.stages,
    shows,
    selectedIds,
    fontFamily: FONT_FAMILY,
    measureText,
    ...overrides,
  });
}

/** Friday with `fri-kidzapalooza-1600` (16:00–16:45) renamed and, if given, ending at `end`. */
function fridayWith(artist: string, end?: string): Show[] {
  return showsOf("fri").map((item) =>
    item.id === "fri-kidzapalooza-1600"
      ? {
          ...item,
          artist,
          ...(end ? { endsAt: posterTimeToInstant("2026-03-13", end).toISOString() } : {}),
        }
      : item,
  );
}

/** Every text of a block stays inside it (12 px of horizontal padding). */
function expectInside(block: WallpaperLayout["blocks"][number], measure: MeasureText): void {
  for (const text of [...block.lines, ...(block.time ? [block.time] : [])]) {
    expect(text.x, text.text).toBeGreaterThanOrEqual(block.x);
    expect(text.x + measure(text.text, text.font), text.text).toBeLessThanOrEqual(
      block.x + block.width - 12,
    );
    expect(text.y, text.text).toBeGreaterThanOrEqual(block.y);
    expect(text.y + fontSize(text.font), text.text).toBeLessThanOrEqual(block.y + block.height);
  }
}

function minutes(show: Show): number {
  return (Date.parse(show.endsAt) - Date.parse(show.startsAt)) / 60_000;
}

function fontSize(font: string): number {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]);
}

/** Every text of a layout: header, stages, hour labels and the text inside the blocks. */
function allTexts(layout: WallpaperLayout): string[] {
  return [
    layout.title.text,
    layout.brand.text,
    ...layout.stageLabels.map((label) => label.text),
    ...layout.hourMarks.map((mark) => mark.label),
    ...layout.blocks.flatMap((block) => [
      ...block.lines.map((line) => line.text),
      ...(block.time ? [block.time.text] : []),
    ]),
  ];
}

const DAY_IDS = ["fri", "sat", "sun"] as const;

// Columns: a 96 px hour gutter from x = 24, then 5 equal columns from x = 120 to x = 1266 with 8 px
// between them.
const COLUMN_WIDTH = (1266 - 120 - 4 * 8) / 5;
function columnX(position: number): number {
  return 120 + (position - 1) * (COLUMN_WIDTH + 8);
}

describe("wallpaperLayout", () => {
  it("test-wallpaper-size: the layout declares 1290 × 2796", () => {
    expect(WALLPAPER_WIDTH).toBe(1290);
    expect(WALLPAPER_HEIGHT).toBe(2796);
    const layout = layoutOf("fri");
    expect(layout.width).toBe(1290);
    expect(layout.height).toBe(2796);
  });

  it("test-wallpaper-friday-complete: 5 columns in stage order, the 30 Friday shows in their column with their times, Peggy Gou 23:30 – 01:00 and hour marks 13:00 to 01:00", () => {
    // The stages arrive out of order: the columns follow `position`, not the input order.
    expect(SHUFFLED_STAGES.map((stage) => stage.id)).not.toStrictEqual([
      "flow",
      "samsung",
      "alternative",
      "perrys",
      "kidzapalooza",
    ]);
    const layout = layoutOf("fri", new Set(), showsOf("fri"), { stages: SHUFFLED_STAGES });

    expect(layout.stageLabels.map((label) => label.text)).toStrictEqual([
      "Flow",
      "Samsung",
      "Alternative",
      "Perry's",
      "Kidzapalooza",
    ]);
    for (const [index, label] of layout.stageLabels.entries()) {
      // Centered in its column.
      const center = columnX(index + 1) + COLUMN_WIDTH / 2;
      expect(label.x + measureText(label.text, label.font) / 2).toBeCloseTo(center, 6);
    }

    const friday = showsOf("fri");
    expect(friday).toHaveLength(30);
    expect(layout.blocks).toHaveLength(30);
    expect(new Set(layout.blocks.map((block) => block.showId))).toStrictEqual(
      new Set(friday.map((item) => item.id)),
    );

    const positions = new Map(SHUFFLED_STAGES.map((stage) => [stage.id, stage.position]));
    for (const item of friday) {
      const block = layout.blocks.find((candidate) => candidate.showId === item.id);
      expect(block, item.id).toBeDefined();
      expect(block?.x).toBeCloseTo(columnX(positions.get(item.stageId) ?? 0), 6);
      expect(block?.width).toBeCloseTo(COLUMN_WIDTH, 6);
      expect(block?.time?.text).toBe(
        `${formatClock(new Date(item.startsAt))} – ${formatClock(new Date(item.endsAt))}`,
      );
      expect(block?.lines.length).toBeGreaterThan(0);
    }

    const peggy = layout.blocks.find((block) => block.showId === "fri-samsung-2330");
    expect(peggy?.time?.text).toBe("23:30 – 01:00");
    expect(peggy?.lines.map((line) => line.text).join(" ")).toBe("Peggy Gou");

    expect(layout.hourMarks.map((mark) => mark.label)).toStrictEqual([
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
    expect(layout.hourMarks[0]?.y).toBe(849);
    expect(layout.hourMarks.at(-1)?.y).toBeCloseTo(2404, 6);
  });

  it("test-wallpaper-lit-selected: with Tyler, The Creator and Lorde chosen on Friday, only those two are lit", () => {
    const layout = layoutOf("fri", new Set(["fri-flow-2215", "fri-samsung-2100"]));
    const lit = layout.blocks.filter((block) => block.lit).map((block) => block.showId);
    expect(lit.sort()).toStrictEqual(["fri-flow-2215", "fri-samsung-2100"]);
    expect(layout.blocks.filter((block) => !block.lit)).toHaveLength(28);
  });

  it("test-wallpaper-none-selected-all-lit: with nothing chosen that day (and shows chosen on another day), every show of the day is lit", () => {
    for (const selected of [
      new Set<string>(),
      new Set(["sat-flow-1800", "sun-kidzapalooza-1500"]),
    ]) {
      const layout = layoutOf("fri", selected);
      expect(layout.blocks).toHaveLength(30);
      expect(layout.blocks.every((block) => block.lit)).toBe(true);
    }
  });

  it("test-wallpaper-colors-contrast: BASE over FOAM has a WCAG contrast ≥ 4.5 and DIMMED_OPACITY ≤ 0.35", () => {
    function luminance(hex: string): number {
      const channels = [1, 3, 5].map((start) => {
        const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
        return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      const [red = 0, green = 0, blue = 0] = channels;
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
    const light = luminance(FOAM);
    const dark = luminance(BASE);
    const contrast = (light + 0.05) / (dark + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    expect(contrast).toBeCloseTo(10.37, 1);
    expect(DIMMED_OPACITY).toBeLessThanOrEqual(0.35);
    expect(DIMMED_OPACITY).toBe(0.3);

    // The text inside a block is BASE (drawn over the FOAM block).
    const layout = layoutOf("fri");
    for (const block of layout.blocks) {
      for (const line of block.lines) {
        expect(line.color).toBe(BASE);
      }
      expect(block.time?.color).toBe(BASE);
    }
  });

  it("test-wallpaper-safe-zones: on the 3 days no block or hour mark starts above y = 699 or ends below y = 2404", () => {
    for (const dayId of DAY_IDS) {
      const layout = layoutOf(dayId);
      expect(layout.blocks.length).toBeGreaterThan(0);
      for (const block of layout.blocks) {
        expect(block.y, block.showId).toBeGreaterThanOrEqual(BAND_TOP);
        expect(block.y + block.height, block.showId).toBeLessThanOrEqual(BAND_BOTTOM);
      }
      for (const mark of layout.hourMarks) {
        expect(mark.y).toBeGreaterThanOrEqual(BAND_TOP);
        expect(mark.y).toBeLessThanOrEqual(BAND_BOTTOM);
        expect(mark.text.y).toBeGreaterThanOrEqual(BAND_TOP);
        expect(mark.text.y + fontSize(mark.text.font)).toBeLessThanOrEqual(BAND_BOTTOM);
      }
      for (const text of [layout.title, layout.brand, ...layout.stageLabels]) {
        expect(text.y).toBeGreaterThanOrEqual(BAND_TOP);
        expect(text.y + fontSize(text.font)).toBeLessThanOrEqual(849);
      }
    }
  });

  it("test-wallpaper-clear-of-lock-screen-buttons: the bottom 392 px (14 %) stay free, so no block or hour mark ends below y = 2404, Peggy Gou and the 01:00 mark included (FIX-003)", () => {
    // On a real lock screen the flashlight and camera start ≈ 347 px above the bottom edge.
    const LOCK_SCREEN_BUTTONS_TOP = WALLPAPER_HEIGHT - 347;
    expect(SAFE_BOTTOM).toBe(392);
    for (const dayId of DAY_IDS) {
      const layout = layoutOf(dayId);
      for (const block of layout.blocks) {
        expect(block.y + block.height, block.showId).toBeLessThanOrEqual(2404);
      }
      for (const mark of layout.hourMarks) {
        expect(mark.y, mark.label).toBeLessThanOrEqual(2404);
      }
      // At least 40 px of air between the grid and the buttons.
      expect(
        LOCK_SCREEN_BUTTONS_TOP - (layout.hourMarks.at(-1)?.y ?? Infinity),
      ).toBeGreaterThanOrEqual(40);
    }
    const friday = layoutOf("fri");
    const peggy = friday.blocks.find((block) => block.showId === "fri-samsung-2330");
    expect(peggy).toBeDefined();
    expect((peggy?.y ?? Infinity) + (peggy?.height ?? 0)).toBeCloseTo(2404, 6);
    const lastMark = friday.hourMarks.at(-1);
    expect(lastMark?.label).toBe("01:00");
    expect(lastMark?.y).toBeCloseTo(2404, 6);
  });

  it("test-wallpaper-title-brand: Saturday is titled «Sábado» with the «Mi Grilla» brand, and no text says Lollapalooza", () => {
    const layout = layoutOf("sat");
    expect(layout.title.text).toBe("Sábado");
    expect(layout.title.font).toBe(`700 64px ${FONT_FAMILY}`);
    expect(layout.brand.text).toBe("Mi Grilla");
    expect(layout.brand.font).toBe(`600 32px ${FONT_FAMILY}`);
    expect(layout.brand.color).toBe(FOAM);
    // Title on the left, brand on the right, in the same first row of the band.
    expect(layout.title.x).toBeLessThan(layout.brand.x);
    expect(layout.brand.x + measureText(layout.brand.text, layout.brand.font)).toBeLessThanOrEqual(
      1266,
    );
    for (const dayId of DAY_IDS) {
      for (const text of allTexts(layoutOf(dayId))) {
        expect(text.toLowerCase()).not.toContain("lollapalooza");
      }
    }
  });

  it("test-wallpaper-legibility: on the 3 days the artist uses 28 px, every show of 30 min or more measures ≥ 70 px and no block overlaps the next one on its stage", () => {
    expect(ARTIST_FONT_SIZE).toBe(28);
    for (const dayId of DAY_IDS) {
      const shows = showsOf(dayId);
      const layout = layoutOf(dayId);
      const byId = new Map(shows.map((item) => [item.id, item]));
      for (const block of layout.blocks) {
        const item = byId.get(block.showId);
        expect(item).toBeDefined();
        if (item && minutes(item) >= 30) {
          expect(block.height, block.showId).toBeGreaterThanOrEqual(70);
        }
        for (const line of block.lines) {
          expect(line.font).toBe(`600 28px ${FONT_FAMILY}`);
        }
      }
      for (const stage of SCHEDULE.stages) {
        const column = layout.blocks
          .filter((block) => byId.get(block.showId)?.stageId === stage.id)
          .sort((a, b) => a.y - b.y);
        for (const [index, block] of column.entries()) {
          const next = column[index + 1];
          if (next) {
            expect(block.y + block.height, block.showId).toBeLessThanOrEqual(next.y - 4);
          }
        }
      }
    }

    // Sunday, Kidzapalooza: 18:00–18:20 is followed by 18:30–18:50, so the minimum height is capped.
    const sunday = layoutOf("sun");
    const quick = sunday.blocks.find((block) => block.showId === "sun-kidzapalooza-1800");
    const next = sunday.blocks.find((block) => block.showId === "sun-kidzapalooza-1830");
    expect(quick && next).toBeTruthy();
    if (quick && next) {
      expect(quick.y + quick.height).toBeCloseTo(next.y - 4, 6);
      expect(quick.height).toBeLessThan(70);
    }
  });

  it("test-wallpaper-long-name-ellipsis: «Desenchufados en Banda» in a 70 px block ends in «…» and stays inside the block", () => {
    const shows = showsOf("fri").map((item) =>
      item.id === "fri-kidzapalooza-1600"
        ? { ...item, endsAt: posterTimeToInstant("2026-03-13", "16:20").toISOString() }
        : item,
    );
    const layout = layoutOf("fri", new Set(), shows);
    const block = layout.blocks.find((candidate) => candidate.showId === "fri-kidzapalooza-1600");
    expect(block).toBeDefined();
    if (!block) {
      return;
    }
    expect(block.height).toBe(70);
    expect(block.lines.length).toBeGreaterThan(0);
    expect(block.lines.at(-1)?.text.endsWith(ELLIPSIS)).toBe(true);
    // One line and the time still fit (a 30 min show always has room for both).
    expect(block.time?.text).toBe("16:00 – 16:20");

    expectInside(block, measureText);
  });

  it("test-wallpaper-wrap-extra-lines-ellipsis: several words that need more lines than the block allows end in «…» on the last line shown", () => {
    // 45 min (≈ 97.2 px): two lines of artist and the time. The words need three lines
    // ("Uno Dos", "Tres Cuatro", "Cinco Seis"): the second is cut short to end in "…".
    const layout = layoutOf("fri", new Set(), fridayWith("Uno Dos Tres Cuatro Cinco Seis"));
    const block = layout.blocks.find((candidate) => candidate.showId === "fri-kidzapalooza-1600");
    expect(block).toBeDefined();
    if (!block) {
      return;
    }
    expect(block.lines.map((line) => line.text)).toStrictEqual(["Uno Dos", "Tres Cuatr…"]);
    expect(block.time?.text).toBe("16:00 – 16:45");
    expectInside(block, measureText);
  });

  it("test-wallpaper-ellipsis-wider-than-block: when not even «…» fits, the line is left out instead of overflowing", () => {
    // A font whose "…" is wider than any column: the name that does not fit cannot be ellipsized.
    const wideEllipsis: MeasureText = (text, font) =>
      text.includes(ELLIPSIS) ? 10_000 : measureText(text, font);
    const layout = layoutOf("fri", new Set(), fridayWith("Desenchufados en Banda", "16:20"), {
      measureText: wideEllipsis,
    });
    const block = layout.blocks.find((candidate) => candidate.showId === "fri-kidzapalooza-1600");
    expect(block).toBeDefined();
    if (!block) {
      return;
    }
    expect(block.lines).toStrictEqual([]);
    expect(block.time?.text).toBe("16:00 – 16:20");
    expect(block.time?.y).toBe(block.y + 4);
    expectInside(block, wideEllipsis);
  });

  it("test-wallpaper-every-show-has-time: on the 3 days every block has its time, inside the block", () => {
    for (const dayId of DAY_IDS) {
      const layout = layoutOf(dayId);
      for (const block of layout.blocks) {
        expect(block.time, block.showId).not.toBeNull();
        expectInside(block, measureText);
      }
    }
  });

  it("test-wallpaper-other-day-skipped: a show of another day passed in `shows` is not drawn", () => {
    const saturday = showsOf("sat")[0];
    expect(saturday).toBeDefined();
    if (!saturday) {
      return;
    }
    const layout = layoutOf("fri", new Set([saturday.id]), [...showsOf("fri"), saturday]);
    expect(layout.blocks).toHaveLength(30);
    expect(layout.blocks.some((block) => block.showId === saturday.id)).toBe(false);
    // Its id does not count as "something chosen this day".
    expect(layout.blocks.every((block) => block.lit)).toBe(true);
    // Nor does it stretch the day's axis.
    expect(layout.hourMarks.map((mark) => mark.label)).toStrictEqual(
      layoutOf("fri").hourMarks.map((mark) => mark.label),
    );
  });

  it("test-wallpaper-unknown-id-ignored: an id that does not exist (invalid) is ignored and lights nothing", () => {
    const onlyUnknown = layoutOf("fri", new Set(["nope", "<script>", ""]));
    expect(onlyUnknown.blocks.every((block) => block.lit)).toBe(true);

    const mixed = layoutOf("fri", new Set(["nope", "fri-flow-2215"]));
    expect(mixed.blocks.filter((block) => block.lit).map((block) => block.showId)).toStrictEqual([
      "fri-flow-2215",
    ]);
  });

  it("test-wallpaper-unknown-stage-skipped: a show on an unknown stage (invalid) is left out without an error", () => {
    const stray: Show = {
      id: "fri-main-1500",
      dayId: "fri",
      stageId: "main",
      artist: "Nadie",
      subtitle: null,
      startsAt: posterTimeToInstant("2026-03-13", "15:00").toISOString(),
      endsAt: posterTimeToInstant("2026-03-13", "16:00").toISOString(),
    };
    const layout = layoutOf("fri", new Set([stray.id]), [...showsOf("fri"), stray]);
    expect(layout.blocks).toHaveLength(30);
    expect(layout.blocks.some((block) => block.showId === stray.id)).toBe(false);
    // Its id does not count as "something chosen this day" either.
    expect(layout.blocks.every((block) => block.lit)).toBe(true);
  });

  it("test-wallpaper-empty-day-error: a day without shows throws RangeError", () => {
    expect(() => layoutOf("fri", new Set(), [])).toThrow(RangeError);
  });

  it("test-wallpaper-cramped-block-no-time: a block squeezed by the next show drops the time, and with no room at all drops the name too", () => {
    // Built on purpose (no real show is this close): Friday, Kidzapalooza 16:00–16:45 split in two
    // shows, the second starting `gap` after the first, so the first is capped by it.
    function split(gap: string): WallpaperLayout["blocks"][number] {
      const shows = showsOf("fri").flatMap((item) =>
        item.id === "fri-kidzapalooza-1600"
          ? [
              {
                ...item,
                id: "cramped-a",
                artist: "Uno",
                endsAt: posterTimeToInstant("2026-03-13", gap).toISOString(),
              },
              {
                ...item,
                id: "cramped-b",
                startsAt: posterTimeToInstant("2026-03-13", gap).toISOString(),
              },
            ]
          : [item],
      );
      const block = layoutOf("fri", new Set(), shows).blocks.find(
        (candidate) => candidate.showId === "cramped-a",
      );
      expect(block).toBeDefined();
      return block!;
    }

    // 20 min (≈ 43.2 px − 4 px of gap ≈ 39.2 px): room for one line of artist, not for the time.
    const oneLine = split("16:20");
    expect(oneLine.height).toBeCloseTo((20 * (2404 - 849)) / 720 - 4, 6);
    expect(oneLine.time).toBeNull();
    expect(oneLine.lines.map((line) => line.text)).toStrictEqual(["Uno"]);
    expectInside(oneLine, measureText);

    // 3 min (≈ 6.5 px − 4 px ≈ 2.5 px): not even one line fits (`maxLines` = 0).
    const empty = split("16:03");
    expect(empty.height).toBeCloseTo((3 * (2404 - 849)) / 720 - 4, 6);
    expect(empty.time).toBeNull();
    expect(empty.lines).toStrictEqual([]);
  });

  it("test-wallpaper-vertical-scale: on the 3 days every block starts at 849 + minutes from the axis start × scale and its height is its duration at scale (≥ 70, capped by the next show)", () => {
    const AXIS_START_Y = 849;
    const AXIS_END_Y = 2404;
    for (const dayId of DAY_IDS) {
      const shows = showsOf(dayId);
      const layout = layoutOf(dayId);
      const byId = new Map(shows.map((item) => [item.id, item]));

      // The axis: from the whole hour at or before the first start to the one at or after the last
      // end. On the 3 days it is 13:00 to 01:00 (720 min).
      const hour = 3_600_000;
      const axisStart = Math.floor(Math.min(...shows.map((s) => Date.parse(s.startsAt))) / hour);
      const axisEnd = Math.ceil(Math.max(...shows.map((s) => Date.parse(s.endsAt))) / hour);
      const axisMinutes = (axisEnd - axisStart) * 60;
      expect(axisMinutes, dayId).toBe(720);
      const scale = (AXIS_END_Y - AXIS_START_Y) / axisMinutes;
      const yAt = (instant: number): number =>
        AXIS_START_Y + ((instant - axisStart * hour) / 60_000) * scale;

      expect(layout.blocks).toHaveLength(shows.length);
      for (const block of layout.blocks) {
        const item = byId.get(block.showId);
        expect(item, block.showId).toBeDefined();
        if (!item) {
          continue;
        }
        const start = Date.parse(item.startsAt);
        expect(block.y, block.showId).toBeCloseTo(yAt(start), 6);

        const nextStart = shows
          .filter((other) => other.stageId === item.stageId && Date.parse(other.startsAt) > start)
          .map((other) => Date.parse(other.startsAt))
          .sort((a, b) => a - b)[0];
        const limit = Math.min(
          AXIS_END_Y,
          nextStart === undefined ? AXIS_END_Y : yAt(nextStart) - 4,
        );
        const expected = Math.min(Math.max(minutes(item) * scale, 70), limit - block.y);
        expect(block.height, block.showId).toBeCloseTo(expected, 6);
      }
    }
  });
});

describe("wallpaperFileName", () => {
  it("test-wallpaper-file-name: Friday, Saturday and Sunday give mi-grilla-viernes.png, mi-grilla-sabado.png and mi-grilla-domingo.png", () => {
    expect(wallpaperFileName(dayOf("fri"))).toBe("mi-grilla-viernes.png");
    expect(wallpaperFileName(dayOf("sat"))).toBe("mi-grilla-sabado.png");
    expect(wallpaperFileName(dayOf("sun"))).toBe("mi-grilla-domingo.png");
  });

  it("test-wallpaper-file-name-invalid: spaces, signs, capitals and accents are normalized to [a-z0-9-], and a name without letters or digits gives mi-grilla.png", () => {
    expect(wallpaperFileName({ name: "Día Extra" })).toBe("mi-grilla-dia-extra.png");
    expect(wallpaperFileName({ name: "  VIERNES  13/03 " })).toBe("mi-grilla-viernes-13-03.png");
    expect(wallpaperFileName({ name: "¡Sábado!" })).toBe("mi-grilla-sabado.png");
    expect(wallpaperFileName({ name: "Ñandú & Cía." })).toBe("mi-grilla-nandu-cia.png");
    expect(wallpaperFileName({ name: "../../etc/passwd" })).toBe("mi-grilla-etc-passwd.png");
    // Nothing left after normalizing: never an empty segment ("mi-grilla-.png").
    for (const name of ["¡¿?!", "", "   ", "---", "日本"]) {
      expect(wallpaperFileName({ name }), JSON.stringify(name)).toBe("mi-grilla.png");
    }
  });
});
