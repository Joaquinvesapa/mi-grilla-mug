import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { formatClock, posterTimeToInstant } from "@/lib/festival-time";
import { type FriendPicks, type GroupPicks, indicatorParts, picksByShow } from "@/lib/group-picks";
import { BASE, FOAM, SUBTLE, TEXT } from "@/lib/palette";
import type { FestivalDay, Schedule, Show, Stage } from "@/lib/schedule-types";
import { dayTint, stageTint } from "@/lib/stage-colors";
import {
  type WallpaperInput,
  ARTIST_FONT_SIZE,
  DIMMED_OPACITY,
  INITIALS_FONT_SIZE,
  type MeasureText,
  SAFE_BOTTOM,
  SAFE_TOP,
  WALLPAPER_HEIGHT,
  WALLPAPER_WIDTH,
  type WallpaperGroup,
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

function luminanceOf(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastOf(a: string, b: string): number {
  const [light, dark] = [luminanceOf(a), luminanceOf(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** `color` at `percent` % over BASE, as an opaque hex (what the canvas paints). */
function overBase(color: string, percent: number): string {
  const hex = [1, 3, 5].map((start) => {
    const top = Number.parseInt(color.slice(start, start + 2), 16);
    const bottom = Number.parseInt(BASE.slice(start, start + 2), 16);
    return Math.round((top * percent) / 100 + (bottom * (100 - percent)) / 100)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${hex.join("")}`;
}

function minutes(show: Show): number {
  return (Date.parse(show.endsAt) - Date.parse(show.startsAt)) / 60_000;
}

function fontSize(font: string): number {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]);
}

/**
 * Every text of a layout: header (with the group's name, if any), stages, hour labels and the text
 * inside the blocks, the badges' included.
 */
function allTexts(layout: WallpaperLayout): string[] {
  return [
    layout.title.text,
    layout.brand.text,
    ...(layout.groupLabel ? [layout.groupLabel.text] : []),
    ...layout.stageLabels.map((label) => label.text),
    ...layout.hourMarks.map((mark) => mark.label),
    ...layout.blocks.flatMap((block) => [
      ...block.lines.map((line) => line.text),
      ...(block.time ? [block.time.text] : []),
      ...block.badges.map((badge) => badge.label.text),
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
  });

  it("test-wallpaper-stage-colors-blocks: each block is filled with its stage's color and its text is the stage's onColor (TEXT on pine, BASE otherwise), readable on every stage", () => {
    const seen = new Set<string>();
    for (const dayId of DAY_IDS) {
      const stageOf = new Map(showsOf(dayId).map((show) => [show.id, show.stageId]));
      for (const block of layoutOf(dayId).blocks) {
        const stageId = stageOf.get(block.showId) ?? "";
        const { color, onColor } = stageTint(stageId);
        seen.add(stageId);
        expect(block.fill, block.showId).toBe(color);
        for (const line of block.lines) {
          expect(line.color).toBe(onColor);
        }
        expect(block.time?.color).toBe(onColor);
        // Pine/TEXT is 3.96:1: the spec accepts it for bold text (28 px artist, large).
        expect(contrastOf(color, onColor), stageId).toBeGreaterThanOrEqual(3.9);
      }
    }
    expect([...seen].sort()).toEqual(["alternative", "flow", "kidzapalooza", "perrys", "samsung"]);
    expect(stageTint("perrys").onColor).toBe(TEXT);
    expect(stageTint("flow").onColor).toBe(BASE);
  });

  it("test-wallpaper-stage-lanes: each stage has a lane tinted 7 % and a header tinted 9 % with a top bar in its color; names stay TEXT, AA on the tint", () => {
    const layout = layoutOf("fri");
    expect(layout.lanes).toHaveLength(5);
    expect(layout.headers).toHaveLength(5);
    for (const [index, lane] of layout.lanes.entries()) {
      const { color } = stageTint(lane.stageId);
      expect(lane.fill, lane.stageId).toBe(overBase(color, 7));
      const header = layout.headers[index];
      expect(header?.stageId).toBe(lane.stageId);
      expect(header?.fill).toBe(overBase(color, 9));
      expect(header?.barColor).toBe(color);
      expect(header?.barHeight).toBeGreaterThan(0);
      // Same column as the stage's label and blocks; the lane starts where the header ends.
      expect(header?.x).toBe(lane.x);
      expect(header?.width).toBe(lane.width);
      expect((header?.y ?? 0) + (header?.height ?? 0)).toBe(lane.y);
      expect(lane.y + lane.height).toBe(WALLPAPER_HEIGHT - SAFE_BOTTOM);
      const label = layout.stageLabels[index];
      expect(label?.stageId).toBe(lane.stageId);
      expect(label?.color).toBe(TEXT);
      expect(contrastOf(label?.color ?? "", header?.fill ?? "")).toBeGreaterThanOrEqual(4.5);
      // The label sits inside the header, below its bar.
      expect(label?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.barHeight ?? 0));
      expect((label?.y ?? 0) + fontSize(label?.font ?? "")).toBeLessThanOrEqual(lane.y);
      expect(header?.y).toBeGreaterThanOrEqual(SAFE_TOP);
    }
    for (const block of layout.blocks) {
      const lane = layout.lanes.find((item) => item.x === block.x);
      expect(lane, block.showId).toBeDefined();
      expect(block.y).toBeGreaterThanOrEqual(lane?.y ?? Infinity);
    }
  });

  it("test-wallpaper-day-title-color: the title is in the day's color with a bar under it, clear of the iOS clock; Sunday (pine) keeps ≥ 3:1 as large text", () => {
    for (const dayId of DAY_IDS) {
      const layout = layoutOf(dayId);
      const { color } = dayTint(dayId);
      expect(layout.title.color).toBe(color);
      expect(layout.titleBar.fill).toBe(color);
      expect(layout.titleBar.height).toBeGreaterThanOrEqual(3);
      expect(layout.titleBar.y).toBeGreaterThanOrEqual(
        layout.title.y + fontSize(layout.title.font),
      );
      expect(layout.titleBar.y).toBeGreaterThanOrEqual(SAFE_TOP);
      expect(layout.title.y).toBeGreaterThanOrEqual(SAFE_TOP);
      expect(layout.titleBar.x).toBe(layout.title.x);
      // Above the stage headers.
      const [header] = layout.headers;
      expect(layout.titleBar.y + layout.titleBar.height).toBeLessThanOrEqual(header?.y ?? 0);
      expect(contrastOf(color, BASE), dayId).toBeGreaterThanOrEqual(3);
    }
    expect(layoutOf("fri").title.color).toBe(dayTint("fri").color);
    expect(layoutOf("sat").title.color).not.toBe(layoutOf("fri").title.color);
  });

  it("test-wallpaper-badges-readable-on-stage-colors: a badge (BASE pill, TEXT label) is AA inside and stands out ≥ 3:1 from every stage color, pine included", () => {
    const friday = layoutOf("fri", new Set(["fri-samsung-2330"]), undefined, {
      group: {
        name: "G",
        friendsByShow: new Map(
          showsOf("fri").map((show) => [
            show.id,
            [{ name: "Ana Pérez", initials: "AP", showIds: [show.id] }],
          ]),
        ),
      },
    });
    const withBadges = friday.blocks.filter((block) => block.badges.length > 0);
    expect(withBadges.length).toBeGreaterThan(0);
    for (const block of withBadges) {
      for (const badge of block.badges) {
        expect(contrastOf(badge.label.color, badge.fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrastOf(badge.fill, block.fill), block.showId).toBeGreaterThanOrEqual(3);
      }
    }
    for (const stageId of ["flow", "samsung", "alternative", "perrys", "kidzapalooza"]) {
      expect(contrastOf(BASE, stageTint(stageId).color), stageId).toBeGreaterThanOrEqual(3);
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

  it("test-wallpaper-group-file-name: Friday for «Los del Lolla» gives mi-grilla-viernes-los-del-lolla.png, and «Ñandú & Cía» gives mi-grilla-viernes-nandu-cia.png", () => {
    expect(wallpaperFileName(dayOf("fri"), "Los del Lolla")).toBe(
      "mi-grilla-viernes-los-del-lolla.png",
    );
    expect(wallpaperFileName(dayOf("fri"), "Ñandú & Cía")).toBe("mi-grilla-viernes-nandu-cia.png");
    expect(wallpaperFileName(dayOf("sun"), "  ../Los   del/Lolla!! ")).toBe(
      "mi-grilla-domingo-los-del-lolla.png",
    );
    // Without a group, the personal name of FEAT-004.
    expect(wallpaperFileName(dayOf("fri"))).toBe("mi-grilla-viernes.png");
  });

  it("test-wallpaper-group-file-name-empty-slug: a group name with nothing left (invalid, «🎉🎉») is left out, and so is a day name with nothing left (invalid)", () => {
    expect(wallpaperFileName(dayOf("fri"), "🎉🎉")).toBe("mi-grilla-viernes.png");
    expect(wallpaperFileName(dayOf("fri"), "")).toBe("mi-grilla-viernes.png");
    expect(wallpaperFileName({ name: "¡¿?!" }, "Los del Lolla")).toBe(
      "mi-grilla-los-del-lolla.png",
    );
    expect(wallpaperFileName({ name: "¡¿?!" }, "🎉🎉")).toBe("mi-grilla.png");
  });
});

// The group's wallpaper (FEAT-007): the same layout with the friends' initials on top.

const GROUP_ID = "0b6f3c1e-8a2d-4f7b-9c3e-1d2a3b4c5d6e";
const GROUP_NAME = "Los del Lolla";
const TYLER = "fri-flow-2215";
const PEGGY = "fri-samsung-2330";
const CHAPPELL = "sat-flow-2215";
const KIDS_SHORT = ["sun-kidzapalooza-1800", "sun-kidzapalooza-1830"] as const;
/** The usable width of a block: the column minus 12 px of padding on each side. */
const INNER_WIDTH = COLUMN_WIDTH - 2 * 12;
const BADGE_GAP = 4;
const EPSILON = 1e-6;

type Block = WallpaperLayout["blocks"][number];

function friend(name: string, initials: string, showIds: string[] = []): FriendPicks {
  return { name, initials, showIds };
}

function groupPicks(friends: FriendPicks[], name = GROUP_NAME): GroupPicks {
  return { id: GROUP_ID, name, friends };
}

function wallpaperGroup(friends: FriendPicks[], name = GROUP_NAME): WallpaperGroup {
  return { name, friendsByShow: picksByShow(groupPicks(friends, name)) };
}

function groupLayoutOf(
  dayId: string,
  friends: FriendPicks[],
  selectedIds: ReadonlySet<string> = new Set(),
  overrides: Partial<WallpaperInput> = {},
): WallpaperLayout {
  return layoutOf(dayId, selectedIds, showsOf(dayId), {
    group: wallpaperGroup(friends),
    ...overrides,
  });
}

function blockOf(layout: WallpaperLayout, showId: string): Block {
  const block = layout.blocks.find((candidate) => candidate.showId === showId);
  if (!block) {
    throw new Error(`no block ${showId}`);
  }
  return block;
}

/** The group's name in the header: fails (on `null` or `undefined`) if the layout has none. */
function groupLabelOf(layout: WallpaperLayout): NonNullable<WallpaperLayout["groupLabel"]> {
  const label = layout.groupLabel;
  expect(label).toStrictEqual(expect.objectContaining({ text: expect.any(String) }));
  if (!label) {
    throw new Error("no group label");
  }
  return label;
}

function badgeTexts(block: Block): string[] {
  return block.badges.map((badge) => badge.label.text);
}

/** The initials shown on a block, without the "+N" badge. */
function shownInitials(block: Block): string[] {
  return badgeTexts(block).filter((text) => !text.startsWith("+"));
}

/** How many friends a block accounts for: its initials plus the N of "+N". */
function friendCount(block: Block): number {
  const extra = badgeTexts(block).find((text) => text.startsWith("+"));
  return shownInitials(block).length + (extra ? Number(extra.slice(1)) : 0);
}

/** `count` friends ("AA", "BB", …) who picked every show in `showIds`. */
function crowd(count: number, showIds: string[]): FriendPicks[] {
  return Array.from({ length: count }, (_, index) => {
    const letter = String.fromCharCode(65 + index);
    return friend(`Amigo ${letter} Completo`, `${letter}${letter}`, showIds);
  });
}

/**
 * Every badge stays inside its block's padding, its text inside the badge, no badge overlaps
 * another one, and none covers the artist or the time.
 */
function expectBadgesInside(block: Block, measure: MeasureText): void {
  const texts = [...block.lines, ...(block.time ? [block.time] : [])];
  for (const [index, badge] of block.badges.entries()) {
    const label = badge.label;
    expect(badge.x, label.text).toBeGreaterThanOrEqual(block.x + 12 - EPSILON);
    expect(badge.x + badge.width, label.text).toBeLessThanOrEqual(
      block.x + block.width - 12 + EPSILON,
    );
    expect(badge.y, label.text).toBeGreaterThanOrEqual(block.y - EPSILON);
    expect(badge.y + badge.height, label.text).toBeLessThanOrEqual(
      block.y + block.height + EPSILON,
    );
    expect(label.x, label.text).toBeGreaterThanOrEqual(badge.x - EPSILON);
    expect(label.x + measure(label.text, label.font), label.text).toBeLessThanOrEqual(
      badge.x + badge.width + EPSILON,
    );
    expect(label.y, label.text).toBeGreaterThanOrEqual(badge.y - EPSILON);
    expect(label.y + fontSize(label.font), label.text).toBeLessThanOrEqual(
      badge.y + badge.height + EPSILON,
    );
    const previous = block.badges[index - 1];
    if (previous) {
      expect(badge.x, label.text).toBeGreaterThanOrEqual(previous.x + previous.width - EPSILON);
    }
    for (const text of texts) {
      const overlapsX =
        badge.x < text.x + measure(text.text, text.font) - EPSILON &&
        text.x < badge.x + badge.width - EPSILON;
      const overlapsY =
        badge.y < text.y + fontSize(text.font) - EPSILON &&
        text.y < badge.y + badge.height - EPSILON;
      expect(overlapsX && overlapsY, `${label.text} over ${text.text}`).toBe(false);
    }
  }
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Friday's Kidzapalooza 16:00 show ending `ms` after it starts: its block is that tall. */
function fridayEndingAfter(ms: number): Show[] {
  return showsOf("fri").map((item) =>
    item.id === "fri-kidzapalooza-1600"
      ? { ...item, endsAt: new Date(Date.parse(item.startsAt) + ms).toISOString() }
      : item,
  );
}

describe("wallpaperLayout with a group", () => {
  const ana = friend("Ana Pérez", "AP");
  const bruno = friend("Bruno Gómez", "BG");

  it("test-wallpaper-group-personal-unchanged: without a group the layout is FEAT-004's: no group label and no badges", () => {
    for (const dayId of DAY_IDS) {
      for (const selected of [new Set<string>(), new Set([TYLER, CHAPPELL])]) {
        const layout = layoutOf(dayId, selected);
        expect(layout.groupLabel).toBeNull();
        expect(layout.blocks.length).toBeGreaterThan(0);
        for (const block of layout.blocks) {
          expect(block.badges, block.showId).toStrictEqual([]);
        }
      }
    }
  });

  it("test-wallpaper-group-safe-zones: with a group, on the 3 days the image is 1290 × 2796 and no block, hour mark or badge is above y = 699 or below 2796 − 392", () => {
    const everything = crowd(
      19,
      SCHEDULE.shows.map((item) => item.id),
    );
    for (const dayId of DAY_IDS) {
      const layout = groupLayoutOf(dayId, everything);
      expect(layout.width).toBe(1290);
      expect(layout.height).toBe(2796);
      for (const block of layout.blocks) {
        expect(block.y, block.showId).toBeGreaterThanOrEqual(BAND_TOP);
        expect(block.y + block.height, block.showId).toBeLessThanOrEqual(BAND_BOTTOM);
        expect(block.badges.length, block.showId).toBeGreaterThan(0);
        for (const badge of block.badges) {
          expect(badge.y, block.showId).toBeGreaterThanOrEqual(BAND_TOP);
          expect(badge.y + badge.height, block.showId).toBeLessThanOrEqual(BAND_BOTTOM + EPSILON);
        }
      }
      for (const mark of layout.hourMarks) {
        expect(mark.y).toBeGreaterThanOrEqual(BAND_TOP);
        expect(mark.y).toBeLessThanOrEqual(BAND_BOTTOM);
        expect(mark.text.y).toBeGreaterThanOrEqual(BAND_TOP);
      }
      const label = groupLabelOf(layout);
      expect(label.text).toBe(GROUP_NAME);
      expect(label.y).toBeGreaterThanOrEqual(BAND_TOP);
      expect(label.y + fontSize(label.font)).toBeLessThanOrEqual(849);
    }
  });

  it("test-wallpaper-group-badges-lit: the user chose Tyler, The Creator and so did Ana and Bruno: the block is lit with Ana's and Bruno's badges", () => {
    const layout = groupLayoutOf(
      "fri",
      [friend("Ana Pérez", "AP", [TYLER]), friend("Bruno Gómez", "BG", [TYLER])],
      new Set([TYLER]),
    );
    const block = blockOf(layout, TYLER);
    expect(block.lit).toBe(true);
    expect(badgeTexts(block)).toStrictEqual(["AP", "BG"]);
    for (const badge of block.badges) {
      expect(badge.fill).toBe(BASE);
      expect(badge.label.color).toBe(TEXT);
      expect(badge.label.font).toBe(`600 20px ${FONT_FAMILY}`);
      expect(badge.height).toBe(24);
      expect(badge.radius).toBe(12);
      expect(badge.width).toBeCloseTo(measureText(badge.label.text, badge.label.font) + 12, 6);
      // The label is centered in its box: the same padding on both sides, and the 20 px text
      // centered in the 24 px height, so the canvas only paints it where it is.
      const left = badge.label.x - badge.x;
      const right =
        badge.x + badge.width - (badge.label.x + measureText(badge.label.text, badge.label.font));
      expect(left).toBeCloseTo(right, 6);
      expect(left).toBeCloseTo(6, 6);
      expect(badge.label.y).toBeCloseTo(badge.y + (24 - 20) / 2, 6);
    }
    expectBadgesInside(block, measureText);
  });

  it("test-wallpaper-group-badges-dimmed: the user did not choose Peggy Gou and Ana did: the block is not lit and has Ana's badge", () => {
    const layout = groupLayoutOf("fri", [friend("Ana Pérez", "AP", [PEGGY])], new Set([TYLER]));
    const block = blockOf(layout, PEGGY);
    expect(block.lit).toBe(false);
    expect(badgeTexts(block)).toStrictEqual(["AP"]);
    expectBadgesInside(block, measureText);
  });

  it("test-wallpaper-group-no-friends-no-badges: a show nobody chose stays dimmed and without badges", () => {
    const layout = groupLayoutOf("fri", [friend("Ana Pérez", "AP", [PEGGY])], new Set([TYLER]));
    const block = blockOf(layout, "fri-kidzapalooza-1600");
    expect(block.lit).toBe(false);
    expect(block.badges).toStrictEqual([]);
    // Only Peggy Gou carries badges.
    expect(
      layout.blocks.filter((item) => item.badges.length > 0).map((item) => item.showId),
    ).toStrictEqual([PEGGY]);
  });

  it("test-wallpaper-group-extra-badge: 5 friends on the same show give 3 initials and «+2», and never the user's initials", () => {
    const friends = [
      friend("Ana Pérez", "AP", [TYLER]),
      friend("Bruno Gómez", "BG", [TYLER]),
      friend("Carla Díaz", "CD", [TYLER]),
      friend("Dani Ruiz", "DR", [TYLER]),
      friend("Eva Sosa", "ES", [TYLER]),
    ];
    // The user ("Joaquín Vesco", "JV") also chose it: they are not one of `friends`.
    const layout = groupLayoutOf("fri", friends, new Set([TYLER]));
    const block = blockOf(layout, TYLER);
    expect(badgeTexts(block)).toStrictEqual(["AP", "BG", "CD", "+2"]);
    expect(badgeTexts(block)).not.toContain("JV");
    expectBadgesInside(block, measureText);
  });

  it("test-wallpaper-group-none-selected: on Saturday with nothing chosen by the user and Ana on Chappell Roan, every show is lit and Ana's badge is on Chappell Roan", () => {
    const layout = groupLayoutOf("sat", [friend("Ana Pérez", "AP", [CHAPPELL])]);
    expect(layout.blocks.every((block) => block.lit)).toBe(true);
    expect(badgeTexts(blockOf(layout, CHAPPELL))).toStrictEqual(["AP"]);
    expect(layout.blocks.filter((block) => block.badges.length > 0)).toHaveLength(1);
  });

  it("test-wallpaper-group-header: Friday for «Los del Lolla» shows «Viernes», «Los del Lolla» and «Mi Grilla», nothing says Lollapalooza, and the group's name ends before the brand", () => {
    const personal = layoutOf("fri");
    const layout = groupLayoutOf("fri", [ana, bruno]);
    // Title and brand do not move.
    expect(layout.title).toStrictEqual(personal.title);
    expect(layout.brand).toStrictEqual(personal.brand);

    const texts = allTexts(layout);
    expect(texts).toContain("Viernes");
    expect(texts).toContain("Los del Lolla");
    expect(texts).toContain("Mi Grilla");
    for (const text of texts) {
      expect(text.toLowerCase()).not.toContain("lollapalooza");
    }

    const label = groupLabelOf(layout);
    expect(label.text).toBe("Los del Lolla");
    expect(label.font).toBe(`600 32px ${FONT_FAMILY}`);
    expect(label.color).toBe(SUBTLE);
    // In the title's row: 24 px after the day's name, ending at least 24 px before the brand.
    expect(label.x).toBeCloseTo(
      layout.title.x + measureText(layout.title.text, layout.title.font) + 24,
      6,
    );
    expect(label.y).toBe(layout.brand.y);
    expect(label.x + measureText(label.text, label.font)).toBeLessThanOrEqual(layout.brand.x - 24);
  });

  it("test-wallpaper-group-legibility: on the 3 days with friends on every show, initials use 20 px, the artist 28 px, every 30 min show is ≥ 70 px, no badge leaves its block, and TEXT over BASE has a WCAG contrast ≥ 4.5", () => {
    expect(INITIALS_FONT_SIZE).toBe(20);
    expect(ARTIST_FONT_SIZE).toBe(28);
    const contrast = (luminance(TEXT) + 0.05) / (luminance(BASE) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);

    for (const count of [1, 3, 19]) {
      const friends = crowd(
        count,
        SCHEDULE.shows.map((item) => item.id),
      );
      for (const dayId of DAY_IDS) {
        const layout = groupLayoutOf(dayId, friends);
        const byId = new Map(showsOf(dayId).map((item) => [item.id, item]));
        for (const block of layout.blocks) {
          const item = byId.get(block.showId);
          expect(item).toBeDefined();
          if (item && minutes(item) >= 30) {
            expect(block.height, block.showId).toBeGreaterThanOrEqual(70);
          }
          // The time stays and the artist keeps at least the start of its name.
          expect(block.time, block.showId).not.toBeNull();
          expect(block.lines.length, block.showId).toBeGreaterThan(0);
          for (const line of block.lines) {
            expect(line.font).toBe(`600 28px ${FONT_FAMILY}`);
          }
          expect(friendCount(block), block.showId).toBe(count);
          for (const badge of block.badges) {
            expect(badge.label.font).toBe(`600 20px ${FONT_FAMILY}`);
            expect(badge.fill).toBe(BASE);
            expect(badge.label.color).toBe(TEXT);
          }
          expectInside(block, measureText);
          expectBadgesInside(block, measureText);
        }
      }
    }
  });

  it("test-wallpaper-group-short-block-inline: Sunday, Kidzapalooza 18:00 with a friend: the time stays, the artist is one line and the badge is to its right, inside the block", () => {
    const [first] = KIDS_SHORT;
    const layout = groupLayoutOf("sun", [friend("Ana Pérez", "AP", [first])]);
    const block = blockOf(layout, first);
    expect(block.height).toBeLessThan(86);
    expect(block.time?.text).toBe("18:00 – 18:20");
    expect(block.lines).toHaveLength(1);
    expect(badgeTexts(block)).toStrictEqual(["AP"]);

    const line = block.lines[0];
    const badge = block.badges[0];
    expect(line && badge).toBeTruthy();
    if (!line || !badge) {
      return;
    }
    // To the artist's right, with a gap, and centered on the artist's 30 px line.
    expect(badge.x).toBeGreaterThanOrEqual(line.x + measureText(line.text, line.font) + BADGE_GAP);
    expect(badge.y + badge.height / 2).toBeCloseTo(line.y + 30 / 2, 6);
    expect(badge.y + badge.height).toBeLessThanOrEqual(block.time?.y ?? 0);
    expectInside(block, measureText);
    expectBadgesInside(block, measureText);
  });

  it("test-wallpaper-group-short-block-crowded: the two 20 min blocks with 19 friends keep some artist text, the badges take at most half the usable width and initials + N add up to 19", () => {
    const layout = groupLayoutOf("sun", crowd(19, [...KIDS_SHORT]));
    for (const showId of KIDS_SHORT) {
      const block = blockOf(layout, showId);
      expect(block.lines, showId).toHaveLength(1);
      expect(block.lines[0]?.text.length, showId).toBeGreaterThan(0);
      expect(block.time, showId).not.toBeNull();
      const first = block.badges[0];
      const last = block.badges.at(-1);
      expect(first && last, showId).toBeTruthy();
      if (first && last) {
        expect(last.x + last.width - first.x, showId).toBeLessThanOrEqual(INNER_WIDTH / 2);
      }
      expect(badgeTexts(block).at(-1)?.startsWith("+"), showId).toBe(true);
      expect(friendCount(block), showId).toBe(19);
      expectInside(block, measureText);
      expectBadgesInside(block, measureText);
    }
  });

  it("test-wallpaper-group-wide-initials-folded: wide 4-grapheme initials that do not fit in the row fold into «+N», no badge leaves the block and the total stays exact", () => {
    // A font where "W" is as wide as the font size: a "WWWW" badge is 92 px, and 3 of them do not
    // fit in the 198.8 px row.
    // Like `measureText`, one UTF-16 unit at a time, but a "W" is 1 × the font size.
    const wide: MeasureText = (text, textFont) => {
      const wideCount = text.split("W").length - 1;
      return (wideCount + (text.length - wideCount) * 0.6) * fontSize(textFont);
    };
    const friends = [
      friend("Walter Uno", "WWWW", [TYLER]),
      friend("Walter Dos", "WWWW", [TYLER]),
      friend("Walter Tres", "WWWW", [TYLER]),
    ];
    const layout = groupLayoutOf("fri", friends, new Set(), { measureText: wide });
    const block = blockOf(layout, TYLER);
    expect(badgeTexts(block)).toStrictEqual(["WWWW", "+2"]);
    expect(friendCount(block)).toBe(3);
    expectBadgesInside(block, wide);
  });

  it("test-wallpaper-group-row-threshold: an 86 px block puts the badges in a row below the time, an 85 px one on the artist's line", () => {
    const ana1600 = [friend("Ana Pérez", "AP", ["fri-kidzapalooza-1600"])];
    // The axis is 1555 px for 720 min: `px × 720 / 1555` min, rounded to the side that keeps the
    // block at or above 86 px, and just below 85 px.
    const tall = layoutOf(
      "fri",
      new Set(),
      fridayEndingAfter(Math.ceil((86 * 43_200_000) / 1555)),
      {
        group: wallpaperGroup(ana1600),
      },
    );
    const row = blockOf(tall, "fri-kidzapalooza-1600");
    expect(row.height).toBeGreaterThanOrEqual(86);
    expect(row.height).toBeCloseTo(86, 3);
    expect(row.time).not.toBeNull();
    expect(row.badges).toHaveLength(1);
    expect(row.badges[0]?.y).toBeGreaterThanOrEqual((row.time?.y ?? Infinity) + 22);
    expect(row.badges[0]?.x).toBeCloseTo(row.x + 12, 6);
    expectInside(row, measureText);
    expectBadgesInside(row, measureText);

    const short = layoutOf(
      "fri",
      new Set(),
      fridayEndingAfter(Math.floor((85 * 43_200_000) / 1555)),
      { group: wallpaperGroup(ana1600) },
    );
    const inline = blockOf(short, "fri-kidzapalooza-1600");
    expect(inline.height).toBeLessThan(86);
    expect(inline.height).toBeCloseTo(85, 3);
    expect(inline.lines).toHaveLength(1);
    expect(inline.badges).toHaveLength(1);
    expect(inline.badges[0]?.y).toBeLessThan(inline.time?.y ?? -Infinity);
    expectInside(inline, measureText);
    expectBadgesInside(inline, measureText);
  });

  it("test-wallpaper-group-matches-picks: on the 3 days each block's initials are exactly those of picksByShow(group) for that show", () => {
    // Friend i picks every (i + 1)-th show of the festival: blocks with 0 to 19 friends.
    const friends = Array.from({ length: 19 }, (_, index) => {
      const letter = String.fromCharCode(65 + index);
      return friend(
        `Amiga ${letter}`,
        `${letter}${String.fromCharCode(97 + index)}`,
        SCHEDULE.shows.filter((_, position) => position % (index + 1) === 0).map((item) => item.id),
      );
    });
    const picks = picksByShow(groupPicks(friends));
    let withBadges = 0;
    for (const dayId of DAY_IDS) {
      const layout = groupLayoutOf(dayId, friends);
      for (const block of layout.blocks) {
        const expected = picks.get(block.showId) ?? [];
        const { initials } = indicatorParts(expected);
        const shown = shownInitials(block);
        // Same friends, same order; the ones without room are counted in "+N", never lost.
        expect(shown, block.showId).toStrictEqual(initials.slice(0, shown.length));
        expect(friendCount(block), block.showId).toBe(expected.length);
        if (block.height >= 86) {
          expect(shown, block.showId).toStrictEqual(initials);
        }
        withBadges += block.badges.length > 0 ? 1 : 0;
      }
    }
    expect(withBadges).toBe(SCHEDULE.shows.length);
  });

  it("test-wallpaper-group-no-full-names: no text of the layout contains a friend's full name", () => {
    const friends = [
      friend("Ana Pérez", "AP", [TYLER, PEGGY, CHAPPELL]),
      friend(
        "Bruno Gómez",
        "BG",
        SCHEDULE.shows.map((item) => item.id),
      ),
    ];
    for (const dayId of DAY_IDS) {
      const texts = allTexts(groupLayoutOf(dayId, friends));
      // Bruno picked every show: his initials are on every day, his name never.
      expect(texts).toContain("BG");
      for (const text of texts) {
        expect(text).not.toContain("Ana Pérez");
        expect(text).not.toContain("Bruno Gómez");
      }
    }
  });

  it("test-wallpaper-group-unknown-show-ignored: an invalid show id in a friend's picks draws no badge, and only the day's shows are asked for", () => {
    const queried: string[] = [];
    // Records every id the layout asks for.
    class RecordingMap extends Map<string, readonly FriendPicks[]> {
      override get(key: string): readonly FriendPicks[] | undefined {
        queried.push(key);
        return super.get(key);
      }
    }
    const stray = friend("Ana Pérez", "AP", ["nope", "<script>", "", CHAPPELL]);
    const friendsByShow = new RecordingMap(picksByShow(groupPicks([stray])));
    const layout = layoutOf("fri", new Set(), showsOf("fri"), {
      group: { name: GROUP_NAME, friendsByShow },
    });
    expect(layout.blocks.every((block) => block.badges.length === 0)).toBe(true);
    const fridayIds = new Set(showsOf("fri").map((item) => item.id));
    expect(queried.length).toBeGreaterThan(0);
    for (const id of queried) {
      expect(fridayIds.has(id), id).toBe(true);
    }
  });

  it("test-wallpaper-group-long-name-ellipsis: a group name too long for the header (invalid, 40 wide characters) ends in «…» and does not run past brand.x − 24", () => {
    const name = "M".repeat(40);
    const layout = layoutOf("fri", new Set(), showsOf("fri"), { group: wallpaperGroup([], name) });
    const label = groupLabelOf(layout);
    expect(label.text).toMatch(/^MMMM.*…$/u);
    expect(label.text.endsWith(ELLIPSIS)).toBe(true);
    expect(label.text.startsWith("MMMM")).toBe(true);
    expect(label.x + measureText(label.text, label.font)).toBeLessThanOrEqual(layout.brand.x - 24);
    expect(layout.brand).toStrictEqual(layoutOf("fri").brand);
  });

  it("test-wallpaper-group-friends-missing-picks: a group whose friends have no picks (empty showIds), or with no friends, puts no badge on any block and does not throw", () => {
    const personal = layoutOf("fri");
    for (const friends of [[friend("Ana Pérez", "AP"), friend("Bruno Gómez", "BG")], []]) {
      const layout = groupLayoutOf("fri", friends);
      expect(layout.groupLabel?.text).toBe(GROUP_NAME);
      expect(layout.blocks).toHaveLength(30);
      for (const [index, block] of layout.blocks.entries()) {
        expect(block.badges, block.showId).toStrictEqual([]);
        // Without friends on it, a block keeps the personal artist lines and time.
        expect(block.lines).toStrictEqual(personal.blocks[index]?.lines);
        expect(block.time).toStrictEqual(personal.blocks[index]?.time);
      }
    }
  });

  it("test-wallpaper-group-short-block-long-artist: a very long single-word artist in a 20 min block with 19 friends keeps the start of its name and «…» next to the badges", () => {
    const [first] = KIDS_SHORT;
    const shows = showsOf("sun").map((item) =>
      item.id === first ? { ...item, artist: "Supercalifragilisticoespialidoso" } : item,
    );
    const layout = layoutOf("sun", new Set(), shows, {
      group: wallpaperGroup(crowd(19, [first])),
    });
    const block = blockOf(layout, first);
    expect(block.height).toBeLessThan(86);
    expect(block.lines).toHaveLength(1);
    expect(block.lines[0]?.text).toMatch(/^Su.*…$/u);
    expect(block.badges.length).toBeGreaterThan(0);
    expect(friendCount(block)).toBe(19);
    expect(block.time).not.toBeNull();
    expectInside(block, measureText);
    expectBadgesInside(block, measureText);
  });

  it("test-wallpaper-group-defensive-badges-do-not-fit: when not even «+N» alone fits, a block gets no badges and, if short, the same artist line as without a group", () => {
    // Every 20 px badge text is 1000 px wide: no badge fits, in a row or inline. A 28 px character
    // is 19.8 px: 10 of them (198 px) fit the whole usable width (198.8 px) but not 4 px less.
    const huge: MeasureText = (text, textFont) => {
      const size = fontSize(textFont);
      if (size === INITIALS_FONT_SIZE) {
        return 1000;
      }
      return text.length * (size === ARTIST_FONT_SIZE ? 19.8 : size * 0.6);
    };
    const [first] = KIDS_SHORT;
    const shows = showsOf("sun").map((item) =>
      item.id === first ? { ...item, artist: "M".repeat(30) } : item,
    );
    const everyShow = shows.map((item) => item.id);
    const layout = layoutOf("sun", new Set(), shows, {
      measureText: huge,
      group: wallpaperGroup([friend("Ana Pérez", "AP", everyShow)]),
    });
    const personal = layoutOf("sun", new Set(), shows, { measureText: huge });

    expect(layout.blocks.some((block) => block.height >= 86)).toBe(true);
    for (const block of layout.blocks) {
      expect(block.badges, block.showId).toStrictEqual([]);
    }
    const short = blockOf(layout, first);
    expect(short.height).toBeLessThan(86);
    expect(short.lines).toStrictEqual(blockOf(personal, first).lines);
    expect(short.lines[0]?.text).toBe(`${"M".repeat(9)}…`);
    expect(short.time).toStrictEqual(blockOf(personal, first).time);
  });

  it("test-wallpaper-group-defensive-no-room-for-a-line: a block too short for one artist line gets no badges and the same texts as without a group", () => {
    // The next Kidzapalooza show starts 15 min after 16:00: the 16:00 block is capped at ≈ 28 px.
    const start = Date.parse(posterTimeToInstant("2026-03-13", "16:00").toISOString());
    const shows = showsOf("fri").map((item) =>
      item.id === "fri-kidzapalooza-1700"
        ? { ...item, startsAt: new Date(start + 15 * 60_000).toISOString() }
        : item,
    );
    const layout = layoutOf("fri", new Set(), shows, {
      group: wallpaperGroup([friend("Ana Pérez", "AP", ["fri-kidzapalooza-1600"])]),
    });
    const personal = blockOf(layoutOf("fri", new Set(), shows), "fri-kidzapalooza-1600");
    const block = blockOf(layout, "fri-kidzapalooza-1600");
    expect(block.height).toBeLessThan(2 * 4 + 30);
    expect(block.badges).toStrictEqual([]);
    expect(block.lines).toStrictEqual(personal.lines);
    expect(block.time).toStrictEqual(personal.time);
  });

  it("test-wallpaper-group-defensive-group-label-no-room: with a day name so wide that not even «…» fits before the brand, there is no group label and the header does not move", () => {
    const wideTitle: MeasureText = (text, textFont) =>
      fontSize(textFont) === 64 ? 2000 : measureText(text, textFont);
    const layout = groupLayoutOf("fri", [], new Set(), { measureText: wideTitle });
    const personal = layoutOf("fri", new Set(), showsOf("fri"), { measureText: wideTitle });
    expect(layout.groupLabel).toBeNull();
    expect(layout.title).toStrictEqual(personal.title);
    expect(layout.brand).toStrictEqual(personal.brand);
  });
});
