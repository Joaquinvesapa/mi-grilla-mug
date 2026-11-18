// Where everything sits on the lock-screen wallpaper (FEAT-004, ADR-005). Pure: no I/O and no
// canvas. Text is measured through the `measureText` it is given, so the canvas passes
// `ctx.measureText` and the tests a deterministic stand-in. Every text position is its top-left
// corner: draw it with `textAlign = "left"` and `textBaseline = "top"`.
//
// Only `dayAxis` and `hourMarks` come from the on-screen grid: its scale and minimum height are
// tuned for taps, not for a 1290 × 2796 image.
import { formatClock } from "@/lib/festival-time";
import { BASE, FOAM, SUBTLE, TEXT } from "@/lib/palette";
import { dayAxis, hourMarks, type DayAxis } from "@/lib/schedule-layout";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";

/** Any current iPhone (FR-02). */
export const WALLPAPER_WIDTH = 1290;
export const WALLPAPER_HEIGHT = 2796;
/** The top 25 % (clock and date on the lock screen), rounded up: nothing but background (FR-07). */
export const SAFE_TOP = 699;
/** The bottom 8 % (flashlight and camera), rounded up (FR-07). */
export const SAFE_BOTTOM = 224;
/** Day title, brand and stage names, at the top of the usable band. */
export const HEADER_HEIGHT = 150;
/** The artist's name: at least 28 px (NFR-02). */
export const ARTIST_FONT_SIZE = 28;
export const TIME_FONT_SIZE = 22;
/**
 * A 30-minute show is never shorter than this (NFR-02). The wallpaper's minimum (70 px of a
 * 2796 px image), not the on-screen grid's (`MIN_BLOCK_HEIGHT` of `schedule-layout.ts`, 44 px).
 */
export const MIN_BLOCK_HEIGHT = 70;
/** The opacity of a show that was not chosen: at most 35 % of a lit one (NFR-03). */
export const DIMMED_OPACITY = 0.3;

/** Where the time axis starts and ends: the band below the header. */
export const AXIS_TOP = SAFE_TOP + HEADER_HEIGHT;
export const AXIS_BOTTOM = WALLPAPER_HEIGHT - SAFE_BOTTOM;
/** The stage columns (and the hour lines) span from here to `GRID_RIGHT`. */
export const GRID_LEFT = 120;
export const GRID_RIGHT = WALLPAPER_WIDTH - 24;

const GUTTER_LEFT = 24;
const COLUMN_GAP = 8;
const BLOCK_PADDING_X = 12;
// One artist line and the time take 2 × 6 + 30 + 22 = 64 px: they fit in the shortest real block
// (Sunday, Kidzapalooza 18:00–18:20, ≈ 67.8 px once capped by the next show).
const BLOCK_PADDING_Y = 6;
const ARTIST_LINE_HEIGHT = 30;
const TIME_LINE_HEIGHT = 22;
/** Room left between a block and the next show on its stage. */
const NEXT_SHOW_GAP = 4;
const TITLE_FONT_SIZE = 64;
const BRAND_FONT_SIZE = 32;
const STAGE_FONT_SIZE = 24;
const TITLE_TOP = SAFE_TOP + 24;
const STAGE_TOP = SAFE_TOP + 104;
const HOUR_LABEL_GAP = 4;
const BRAND = "Mi Grilla";
const ELLIPSIS = "…";
const MINUTE_MS = 60_000;

/** Width in px of `text` drawn with the canvas `font` (`ctx.measureText(text).width`). */
export type MeasureText = (text: string, font: string) => number;

export type WallpaperText = { text: string; x: number; y: number; font: string; color: string };

export type WallpaperStageLabel = WallpaperText & { stageId: string };

/** A whole hour: its line at `y` (from `GRID_LEFT` to `GRID_RIGHT`) and its label in the gutter. */
export type WallpaperHourMark = { label: string; y: number; text: WallpaperText };

/** A show: a `FOAM` rectangle, at full opacity if `lit` and at `DIMMED_OPACITY` if not. */
export type WallpaperBlock = {
  showId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lit: boolean;
  /** The artist's name, wrapped to the block; the last line ends in "…" if it did not fit. */
  lines: WallpaperText[];
  /** "23:30 – 01:00", or `null` when the block has no room left for it. */
  time: WallpaperText | null;
};

export type WallpaperLayout = {
  width: number;
  height: number;
  title: WallpaperText;
  brand: WallpaperText;
  stageLabels: WallpaperStageLabel[];
  hourMarks: WallpaperHourMark[];
  blocks: WallpaperBlock[];
};

export type WallpaperInput = {
  day: Pick<FestivalDay, "id" | "name">;
  stages: readonly Stage[];
  /** The day's shows; at least one. */
  shows: readonly Show[];
  /** Untrusted (it may come from `localStorage`): only asked `has(id)` for the day's shows. */
  selectedIds: ReadonlySet<string>;
  /** The resolved family (`getComputedStyle(document.body).fontFamily`), used as-is in `font`. */
  fontFamily: string;
  measureText: MeasureText;
};

function font(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

/** Vertical position of an instant on the axis. Multiplies before dividing, so the axis end is exact. */
function axisY(instant: number, axis: DayAxis): number {
  const minutes = (instant - axis.start.getTime()) / MINUTE_MS;
  const axisMinutes = (axis.end.getTime() - axis.start.getTime()) / MINUTE_MS;
  return AXIS_TOP + (minutes * (AXIS_BOTTOM - AXIS_TOP)) / axisMinutes;
}

/**
 * `text` cut short so that it and a trailing "…" fit in `maxWidth`. An empty string when not even
 * "…" fits: the line is left out rather than drawn past the block.
 */
function ellipsize(text: string, maxWidth: number, textFont: string, measure: MeasureText): string {
  let kept = text;
  while (kept.length > 0 && measure(`${kept}${ELLIPSIS}`, textFont) > maxWidth) {
    kept = kept.slice(0, -1).trimEnd();
  }
  const ellipsized = `${kept}${ELLIPSIS}`;
  return measure(ellipsized, textFont) <= maxWidth ? ellipsized : "";
}

/**
 * Word wrap into at most `maxLines` lines of `maxWidth`. If the name does not fit — more lines than
 * allowed, or a single word wider than the block — the last line shown ends in "…" (or is left out
 * if not even "…" fits).
 */
function wrap(
  text: string,
  maxWidth: number,
  maxLines: number,
  textFont: string,
  measure: MeasureText,
): string[] {
  const fits = (candidate: string): boolean => measure(candidate, textFont) <= maxWidth;
  const full: string[] = [];
  let current = "";
  // Greedy fill: a word goes on the current line while it fits, otherwise it starts the next one.
  // A word alone on its line is kept even if too wide: the pass below cuts it short.
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && !fits(candidate)) {
      full.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) {
    full.push(current);
  }

  const lines: string[] = [];
  for (const [index, line] of full.entries()) {
    // No room for another line (also covers `maxLines` = 0).
    if (lines.length === maxLines) {
      break;
    }
    const isLastAllowed = lines.length === maxLines - 1;
    const hasMore = index < full.length - 1;
    // A word wider than the block, or the last line allowed with words still left: it ends in "…"
    // and nothing follows it.
    if (!fits(line) || (isLastAllowed && hasMore)) {
      const cut = ellipsize(line, maxWidth, textFont, measure);
      if (cut) {
        lines.push(cut);
      }
      break;
    }
    // The line fits and either it is not the last allowed or it is the last of the name.
    lines.push(line);
  }
  return lines;
}

type Box = { x: number; y: number; width: number; height: number };

/** A stage's column on the image. */
type Column = { stage: Stage; x: number };

/** The stages in `position` order, side by side between `GRID_LEFT` and `GRID_RIGHT`. */
function stageColumns(stages: readonly Stage[]): { columns: Column[]; width: number } {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const width =
    (GRID_RIGHT - GRID_LEFT - (ordered.length - 1) * COLUMN_GAP) / Math.max(ordered.length, 1);
  return {
    columns: ordered.map((stage, index) => ({
      stage,
      x: GRID_LEFT + index * (width + COLUMN_GAP),
    })),
    width,
  };
}

/** For each show, the start (ms) of the next show on its stage; absent for the stage's last one. */
function nextStartByShow(shows: readonly Show[]): Map<string, number> {
  const ordered = [...shows].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const nextStart = new Map<string, number>();
  // Walking backwards, the last start seen on a stage is the next one for the show at hand.
  const laterOnStage = new Map<string, number>();
  for (const show of ordered.reverse()) {
    const next = laterOnStage.get(show.stageId);
    if (next !== undefined) {
      nextStart.set(show.id, next);
    }
    laterOnStage.set(show.stageId, Date.parse(show.startsAt));
  }
  return nextStart;
}

/**
 * A show's rectangle: from its start, at least `MIN_BLOCK_HEIGHT` tall, but never past the axis end
 * nor closer than `NEXT_SHOW_GAP` to the next show on its stage (`nextStart`).
 */
function blockBox(
  show: Show,
  column: { x: number; width: number },
  axis: DayAxis,
  nextStart: number | undefined,
): Box {
  const y = axisY(Date.parse(show.startsAt), axis);
  const natural = axisY(Date.parse(show.endsAt), axis) - y;
  const bottom = Math.min(
    AXIS_BOTTOM,
    nextStart === undefined ? AXIS_BOTTOM : axisY(nextStart, axis) - NEXT_SHOW_GAP,
  );
  return {
    x: column.x,
    y,
    width: column.width,
    height: Math.min(Math.max(natural, MIN_BLOCK_HEIGHT), bottom - y),
  };
}

function blockTexts(
  show: Show,
  box: Box,
  fontFamily: string,
  measure: MeasureText,
): Pick<WallpaperBlock, "lines" | "time"> {
  const artistFont = font(600, ARTIST_FONT_SIZE, fontFamily);
  const timeFont = font(600, TIME_FONT_SIZE, fontFamily);
  const inner = box.height - 2 * BLOCK_PADDING_Y;
  // One line and the time take 52 px: every real block (≥ ≈ 67.8 px) has both.
  const withTime = inner >= ARTIST_LINE_HEIGHT + TIME_LINE_HEIGHT;
  const maxLines = Math.max(
    0,
    Math.floor((withTime ? inner - TIME_LINE_HEIGHT : inner) / ARTIST_LINE_HEIGHT),
  );
  const textX = box.x + BLOCK_PADDING_X;
  const textTop = box.y + BLOCK_PADDING_Y;
  const lines = wrap(
    show.artist,
    box.width - 2 * BLOCK_PADDING_X,
    maxLines,
    artistFont,
    measure,
  ).map((text, index): WallpaperText => ({
    text,
    x: textX,
    y: textTop + index * ARTIST_LINE_HEIGHT,
    font: artistFont,
    color: BASE,
  }));
  const time: WallpaperText | null = withTime
    ? {
        text: `${formatClock(new Date(show.startsAt))} – ${formatClock(new Date(show.endsAt))}`,
        x: textX,
        y: textTop + lines.length * ARTIST_LINE_HEIGHT,
        font: timeFont,
        color: BASE,
      }
    : null;
  return { lines, time };
}

/**
 * The wallpaper of one day: header, stage columns in `position` order, hour marks and one block per
 * show, all inside the band from `SAFE_TOP` to `WALLPAPER_HEIGHT - SAFE_BOTTOM`. Shows of another
 * day or on an unknown stage are left out. If none of the day's shows is selected, all are lit
 * (FR-05). Throws `RangeError` (from `dayAxis`) for a day without shows.
 */
export function wallpaperLayout(input: WallpaperInput): WallpaperLayout {
  const { day, fontFamily, measureText, selectedIds } = input;
  const { columns, width: columnWidth } = stageColumns(input.stages);
  const columnByStage = new Map(columns.map((column) => [column.stage.id, column]));

  // The day's shows, each with its column already resolved: the rest are left out.
  const placed = input.shows.flatMap((show) => {
    const column = columnByStage.get(show.stageId);
    return show.dayId === day.id && column ? [{ show, column }] : [];
  });
  const shows = placed.map(({ show }) => show);
  const axis = dayAxis(shows);
  const anySelected = shows.some((show) => selectedIds.has(show.id));

  const titleFont = font(700, TITLE_FONT_SIZE, fontFamily);
  const brandFont = font(600, BRAND_FONT_SIZE, fontFamily);
  const stageFont = font(600, STAGE_FONT_SIZE, fontFamily);
  const hourFont = font(600, TIME_FONT_SIZE, fontFamily);

  const title: WallpaperText = {
    text: day.name,
    x: GUTTER_LEFT,
    y: TITLE_TOP,
    font: titleFont,
    color: TEXT,
  };
  const brand: WallpaperText = {
    text: BRAND,
    x: GRID_RIGHT - measureText(BRAND, brandFont),
    y: TITLE_TOP + (TITLE_FONT_SIZE - BRAND_FONT_SIZE) / 2,
    font: brandFont,
    color: FOAM,
  };

  const stageLabels = columns.map(({ stage, x }): WallpaperStageLabel => {
    const center = x + columnWidth / 2;
    return {
      stageId: stage.id,
      text: stage.name,
      x: center - measureText(stage.name, stageFont) / 2,
      y: STAGE_TOP,
      font: stageFont,
      color: SUBTLE,
    };
  });

  const marks = hourMarks(axis).map((instant): WallpaperHourMark => {
    const label = formatClock(instant);
    const y = axisY(instant.getTime(), axis);
    return {
      label,
      y,
      // In the gutter, right-aligned, just above its line: the last one stays inside the band.
      text: {
        text: label,
        x: GRID_LEFT - BLOCK_PADDING_X - measureText(label, hourFont),
        y: y - TIME_FONT_SIZE - HOUR_LABEL_GAP,
        font: hourFont,
        color: SUBTLE,
      },
    };
  });

  const nextStart = nextStartByShow(shows);
  const blocks = placed.map(({ show, column }): WallpaperBlock => {
    const box = blockBox(show, { x: column.x, width: columnWidth }, axis, nextStart.get(show.id));
    return {
      showId: show.id,
      ...box,
      lit: !anySelected || selectedIds.has(show.id),
      ...blockTexts(show, box, fontFamily, measureText),
    };
  });

  return {
    width: WALLPAPER_WIDTH,
    height: WALLPAPER_HEIGHT,
    title,
    brand,
    stageLabels,
    hourMarks: marks,
    blocks,
  };
}

/** `mi-grilla-viernes.png`: the day's name in lowercase, without accents (FR-11). */
export function wallpaperFileName(day: Pick<FestivalDay, "name">): string {
  const slug = day.name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `mi-grilla-${slug}.png`;
}
