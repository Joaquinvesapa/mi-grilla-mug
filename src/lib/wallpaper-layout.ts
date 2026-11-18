// Where everything sits on the lock-screen wallpaper (FEAT-004, ADR-005). Pure: no I/O and no
// canvas. Text is measured through the `measureText` it is given, so the canvas passes
// `ctx.measureText` and the tests a deterministic stand-in. Every text position is its top-left
// corner: draw it with `textAlign = "left"` and `textBaseline = "top"`.
//
// Only `dayAxis` and `hourMarks` come from the on-screen grid: its scale and minimum height are
// tuned for taps, not for a 1290 × 2796 image.
//
// With a `group` (FEAT-007) the same layout carries the group's name in the header and, on each
// show, a badge per friend who picked it: the same initials and "+N" as the grid.
import { formatClock } from "@/lib/festival-time";
import { extraFriendsLabel } from "@/lib/group-messages";
import { type FriendPicks, indicatorParts } from "@/lib/group-picks";
import { BASE, FOAM, SUBTLE, TEXT } from "@/lib/palette";
import { dayAxis, hourMarks, type DayAxis } from "@/lib/schedule-layout";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";
import { dayTint, stageTint } from "@/lib/stage-colors";

/** Any current iPhone (FR-02). */
export const WALLPAPER_WIDTH = 1290;
export const WALLPAPER_HEIGHT = 2796;
/** The top 25 % (clock and date on the lock screen), rounded up: nothing but background (FR-07). */
export const SAFE_TOP = 699;
/**
 * The bottom 14 % (flashlight and camera), rounded up (FR-07). On a real lock screen the buttons
 * start ≈ 347 px above the bottom edge; this leaves ≈ 45 px of air above them (FIX-003).
 */
export const SAFE_BOTTOM = 392;
/** Day title, brand and stage names, at the top of the usable band. */
const HEADER_HEIGHT = 150;
/** The artist's name: at least 28 px (NFR-02). */
export const ARTIST_FONT_SIZE = 28;
const TIME_FONT_SIZE = 22;
/**
 * A 30-minute show is never shorter than this (NFR-02). The wallpaper's minimum (70 px of a
 * 2796 px image), not the on-screen grid's (`MIN_BLOCK_HEIGHT` of `schedule-layout.ts`, 44 px).
 */
export const MIN_BLOCK_HEIGHT = 70;
/** The opacity of a show that was not chosen: at most 35 % of a lit one (NFR-03). */
export const DIMMED_OPACITY = 0.3;

/** Where the time axis starts and ends: the band below the header. */
const AXIS_TOP = SAFE_TOP + HEADER_HEIGHT;
const AXIS_BOTTOM = WALLPAPER_HEIGHT - SAFE_BOTTOM;
/** The stage columns (and the hour lines) span from here to `GRID_RIGHT`. */
export const GRID_LEFT = 120;
export const GRID_RIGHT = WALLPAPER_WIDTH - 24;

const GUTTER_LEFT = 24;
const COLUMN_GAP = 8;
const BLOCK_PADDING_X = 12;
// One artist line and the time take 2 × 4 + 30 + 22 = 60 px: they fit in the shortest real block
// (Sunday, Kidzapalooza 18:00–18:20, ≈ 60.8 px once capped by the next show).
const BLOCK_PADDING_Y = 4;
const ARTIST_LINE_HEIGHT = 30;
const TIME_LINE_HEIGHT = 22;
/** Room left between a block and the next show on its stage. */
const NEXT_SHOW_GAP = 4;
const TITLE_FONT_SIZE = 64;
const BRAND_FONT_SIZE = 32;
const STAGE_FONT_SIZE = 24;
const TITLE_TOP = SAFE_TOP + 24;
/** The bar under the day's title (≈ 3 px of the 390 px design, scaled to 1290). */
const TITLE_BAR_TOP = TITLE_TOP + TITLE_FONT_SIZE + 4;
const TITLE_BAR_HEIGHT = 8;
/** A stage's header: its top bar, then its name; the lane of the stage starts right below it. */
const HEADER_TOP = TITLE_BAR_TOP + TITLE_BAR_HEIGHT + 4;
const HEADER_BAR_HEIGHT = 6;
const STAGE_TOP = HEADER_TOP + HEADER_BAR_HEIGHT + 4;
const HEADER_BOTTOM = AXIS_TOP - 3;
/** How much of the stage color tints its lane and its header over BASE (artboard 02). */
const LANE_TINT_PERCENT = 7;
const HEADER_TINT_PERCENT = 9;
const HOUR_LABEL_GAP = 4;
const BRAND = "Mi Grilla";
const ELLIPSIS = "…";
const MINUTE_MS = 60_000;

/** A friend's initials on a badge: at least 20 px (NFR-02). */
export const INITIALS_FONT_SIZE = 20;
const BADGE_HEIGHT = 24;
const BADGE_PADDING_X = 6;
/** Between two badges, and between the artist and the first badge on its line. */
const BADGE_GAP = 4;
/** Between the time and the row of badges below it. */
const BADGE_ROW_GAP = 2;
const GROUP_LABEL_FONT_SIZE = 32;
/** Room on each side of the group's name: after the day's name and before the brand. */
const GROUP_LABEL_GAP = 24;
/**
 * The shortest block with a row of badges below the time: 2 × 4 + 30 + 22 + 2 + 24 = 86 px. A
 * shorter one (the two 20 min shows on Sunday) puts them on the artist's line instead.
 */
const BADGE_ROW_MIN_HEIGHT =
  2 * BLOCK_PADDING_Y + ARTIST_LINE_HEIGHT + TIME_LINE_HEIGHT + BADGE_ROW_GAP + BADGE_HEIGHT;

/** Width in px of `text` drawn with the canvas `font` (`ctx.measureText(text).width`). */
export type MeasureText = (text: string, font: string) => number;

export type WallpaperText = { text: string; x: number; y: number; font: string; color: string };

type WallpaperStageLabel = WallpaperText & { stageId: string };

/** A whole hour: its line at `y` (from `GRID_LEFT` to `GRID_RIGHT`) and its label in the gutter. */
type WallpaperHourMark = { label: string; y: number; text: WallpaperText };

/**
 * A friend's initials (or "+N") on a show: a rounded `fill` box, always drawn at full opacity, with
 * its `label` already centered in it, so the canvas measures nothing.
 */
export type WallpaperBadge = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill: string;
  label: WallpaperText;
};

/** A plain filled rectangle (no rounding): lanes, headers, bars. */
export type WallpaperRect = { x: number; y: number; width: number; height: number; fill: string };

/** A stage's lane: its column tinted at 7 % over BASE, from its header down to the axis end. */
type WallpaperLane = WallpaperRect & { stageId: string };

/** A stage's header: tinted at 9 % over BASE, with a `barHeight` bar in the stage color on top. */
type WallpaperStageHeader = WallpaperRect & {
  stageId: string;
  barColor: string;
  barHeight: number;
};

/**
 * A show: a rectangle of its stage's color (`fill`), at full opacity if `lit` and at
 * `DIMMED_OPACITY` if not. Its text is in the stage's `onColor`.
 */
type WallpaperBlock = {
  showId: string;
  fill: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lit: boolean;
  /** The artist's name, wrapped to the block; the last line ends in "…" if it did not fit. */
  lines: WallpaperText[];
  /** "23:30 – 01:00", or `null` when the block has no room left for it. */
  time: WallpaperText | null;
  /** The friends who picked the show, left to right; empty without a group or without friends. */
  badges: WallpaperBadge[];
};

export type WallpaperLayout = {
  width: number;
  height: number;
  title: WallpaperText;
  brand: WallpaperText;
  /** The group's name, between the title and the brand; `null` without a group. */
  groupLabel: WallpaperText | null;
  /** The bar under the title, in the day's color. */
  titleBar: WallpaperRect;
  lanes: WallpaperLane[];
  headers: WallpaperStageHeader[];
  stageLabels: WallpaperStageLabel[];
  hourMarks: WallpaperHourMark[];
  blocks: WallpaperBlock[];
};

/** The group drawn on the wallpaper: its name and, per show id, the friends who picked it. */
export type WallpaperGroup = {
  name: string;
  /** Only asked `get(id)` for the day's shows (R-01). */
  friendsByShow: ReadonlyMap<string, readonly FriendPicks[]>;
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
  /** The group's wallpaper (FEAT-007); without it, the personal one of FEAT-004. */
  group?: WallpaperGroup;
};

function font(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

/** `color` at `percent` % over BASE, as an opaque hex (what the canvas paints). */
function overBase(color: string, percent: number): string {
  const channels = [1, 3, 5].map((start) => {
    const top = Number.parseInt(color.slice(start, start + 2), 16);
    const bottom = Number.parseInt(BASE.slice(start, start + 2), 16);
    const mixed = Math.round((top * percent) / 100 + (bottom * (100 - percent)) / 100);
    return mixed.toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
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

/** The artist's name wrapped to `maxWidth` and `maxLines`, one line every `ARTIST_LINE_HEIGHT`. */
function artistLines(
  show: Show,
  maxWidth: number,
  maxLines: number,
  origin: { x: number; y: number },
  artistFont: string,
  measure: MeasureText,
  color: string,
): WallpaperText[] {
  return wrap(show.artist, maxWidth, maxLines, artistFont, measure).map(
    (text, index): WallpaperText => ({
      text,
      x: origin.x,
      y: origin.y + index * ARTIST_LINE_HEIGHT,
      font: artistFont,
      color,
    }),
  );
}

/** "23:30 – 01:00" at `x`, `y`. */
function timeText(
  show: Show,
  x: number,
  y: number,
  timeFont: string,
  color: string,
): WallpaperText {
  return {
    text: `${formatClock(new Date(show.startsAt))} – ${formatClock(new Date(show.endsAt))}`,
    x,
    y,
    font: timeFont,
    color,
  };
}

function blockTexts(
  show: Show,
  box: Box,
  fontFamily: string,
  measure: MeasureText,
): Pick<WallpaperBlock, "lines" | "time"> {
  const { onColor } = stageTint(show.stageId);
  const artistFont = font(600, ARTIST_FONT_SIZE, fontFamily);
  const timeFont = font(600, TIME_FONT_SIZE, fontFamily);
  const inner = box.height - 2 * BLOCK_PADDING_Y;
  // One line and the time take 52 px inside the padding: every real block (≥ ≈ 60.8 px) has both.
  const withTime = inner >= ARTIST_LINE_HEIGHT + TIME_LINE_HEIGHT;
  const maxLines = Math.max(
    0,
    Math.floor((withTime ? inner - TIME_LINE_HEIGHT : inner) / ARTIST_LINE_HEIGHT),
  );
  const textX = box.x + BLOCK_PADDING_X;
  const textTop = box.y + BLOCK_PADDING_Y;
  const lines = artistLines(
    show,
    box.width - 2 * BLOCK_PADDING_X,
    maxLines,
    { x: textX, y: textTop },
    artistFont,
    measure,
    onColor,
  );
  const time = withTime
    ? timeText(show, textX, textTop + lines.length * ARTIST_LINE_HEIGHT, timeFont, onColor)
    : null;
  return { lines, time };
}

/** A badge's text and its width: the text plus `BADGE_PADDING_X` on each side. */
type BadgeSize = { text: string; width: number };

/** The width of `badges` side by side, `BADGE_GAP` apart. */
function rowWidth(badges: readonly BadgeSize[]): number {
  return (
    badges.reduce((sum, badge) => sum + badge.width, 0) + Math.max(0, badges.length - 1) * BADGE_GAP
  );
}

/**
 * The grid's badges for `friends` (up to 3 initials and "+N") that fit in `maxWidth`: while they do
 * not, the last initials shown fold into "+N", so initials + N is always the number of friends
 * (NFR-05) and no badge is ever cut. Empty if not even "+N" alone fits, rather than overflowing.
 */
function fitBadges(
  friends: readonly FriendPicks[],
  maxWidth: number,
  badgeFont: string,
  measure: MeasureText,
): BadgeSize[] {
  const { initials, extra } = indicatorParts(friends);
  const sized = (text: string): BadgeSize => ({
    text,
    width: measure(text, badgeFont) + 2 * BADGE_PADDING_X,
  });
  for (let shown = initials.length; shown >= 0; shown -= 1) {
    const folded = extra + initials.length - shown;
    const badges = [
      ...initials.slice(0, shown),
      ...(folded > 0 ? [extraFriendsLabel(folded)] : []),
    ].map(sized);
    if (rowWidth(badges) <= maxWidth) {
      return badges;
    }
  }
  return [];
}

/** `badges` side by side from `x`, their tops at `y`, each with its text centered. */
function placeBadges(
  badges: readonly BadgeSize[],
  x: number,
  y: number,
  badgeFont: string,
): WallpaperBadge[] {
  let left = x;
  return badges.map((badge): WallpaperBadge => {
    const placed: WallpaperBadge = {
      x: left,
      y,
      width: badge.width,
      height: BADGE_HEIGHT,
      radius: BADGE_HEIGHT / 2,
      fill: BASE,
      label: {
        text: badge.text,
        x: left + BADGE_PADDING_X,
        y: y + (BADGE_HEIGHT - INITIALS_FONT_SIZE) / 2,
        font: badgeFont,
        color: TEXT,
      },
    };
    left += badge.width + BADGE_GAP;
    return placed;
  });
}

/**
 * A block with friends on it. Tall enough (`BADGE_ROW_MIN_HEIGHT`), the badges go in a row below
 * the time, as wide as the block, and the artist keeps the lines left (at least one). Shorter, the
 * artist gets one line and the badges go to its right, in at most half the block's width; the time
 * stays (decision of the user, decisions-FEAT-007.md). Without room for even one line, no badges.
 */
function blockWithBadges(
  show: Show,
  box: Box,
  friends: readonly FriendPicks[],
  fontFamily: string,
  measure: MeasureText,
): Pick<WallpaperBlock, "lines" | "time" | "badges"> {
  const { onColor } = stageTint(show.stageId);
  const artistFont = font(600, ARTIST_FONT_SIZE, fontFamily);
  const timeFont = font(600, TIME_FONT_SIZE, fontFamily);
  const badgeFont = font(600, INITIALS_FONT_SIZE, fontFamily);
  const inner = box.height - 2 * BLOCK_PADDING_Y;
  const innerWidth = box.width - 2 * BLOCK_PADDING_X;
  const origin = { x: box.x + BLOCK_PADDING_X, y: box.y + BLOCK_PADDING_Y };

  if (box.height >= BADGE_ROW_MIN_HEIGHT) {
    const maxLines = Math.max(
      1,
      Math.floor((inner - TIME_LINE_HEIGHT - BADGE_ROW_GAP - BADGE_HEIGHT) / ARTIST_LINE_HEIGHT),
    );
    const lines = artistLines(show, innerWidth, maxLines, origin, artistFont, measure, onColor);
    const time = timeText(
      show,
      origin.x,
      origin.y + lines.length * ARTIST_LINE_HEIGHT,
      timeFont,
      onColor,
    );
    const rowTop = time.y + TIME_LINE_HEIGHT + BADGE_ROW_GAP;
    const badges = fitBadges(friends, innerWidth, badgeFont, measure);
    return { lines, time, badges: placeBadges(badges, origin.x, rowTop, badgeFont) };
  }

  if (inner < ARTIST_LINE_HEIGHT) {
    return { ...blockTexts(show, box, fontFamily, measure), badges: [] };
  }

  const badges = fitBadges(friends, innerWidth / 2, badgeFont, measure);
  // The badges take at most half the useful width, so the artist keeps at least
  // `innerWidth / 2 - BADGE_GAP` (≈ 95 px): room for the start of its name and "…" at 28 px. Without
  // badges (not even "+N" fits) there is no gap to leave: the same width as without a group.
  const artistWidth = badges.length > 0 ? innerWidth - rowWidth(badges) - BADGE_GAP : innerWidth;
  const lines = artistLines(show, artistWidth, 1, origin, artistFont, measure, onColor);
  const [line] = lines;
  const badgesX = line ? line.x + measure(line.text, line.font) + BADGE_GAP : origin.x;
  const badgesTop = origin.y + (ARTIST_LINE_HEIGHT - BADGE_HEIGHT) / 2;
  // The time keeps its place below the artist's line, even if the name did not fit at all.
  const time =
    inner >= ARTIST_LINE_HEIGHT + TIME_LINE_HEIGHT
      ? timeText(show, origin.x, origin.y + ARTIST_LINE_HEIGHT, timeFont, onColor)
      : null;
  return { lines, time, badges: placeBadges(badges, badgesX, badgesTop, badgeFont) };
}

/**
 * The group's name in the title's row: `GROUP_LABEL_GAP` after the day's name, cut short with "…"
 * to end `GROUP_LABEL_GAP` before the brand. `null` when not even "…" fits.
 */
function groupLabelText(
  name: string,
  title: WallpaperText,
  brand: WallpaperText,
  fontFamily: string,
  measure: MeasureText,
): WallpaperText | null {
  const labelFont = font(600, GROUP_LABEL_FONT_SIZE, fontFamily);
  const x = title.x + measure(title.text, title.font) + GROUP_LABEL_GAP;
  const maxWidth = brand.x - GROUP_LABEL_GAP - x;
  const text =
    measure(name, labelFont) <= maxWidth ? name : ellipsize(name, maxWidth, labelFont, measure);
  return text
    ? {
        text,
        x,
        y: TITLE_TOP + (TITLE_FONT_SIZE - GROUP_LABEL_FONT_SIZE) / 2,
        font: labelFont,
        color: SUBTLE,
      }
    : null;
}

/**
 * The wallpaper of one day: header, stage columns in `position` order, hour marks and one block per
 * show, all inside the band from `SAFE_TOP` to `WALLPAPER_HEIGHT - SAFE_BOTTOM`. Shows of another
 * day or on an unknown stage are left out. If none of the day's shows is selected, all are lit
 * (FR-05). Throws `RangeError` (from `dayAxis`) for a day without shows.
 */
export function wallpaperLayout(input: WallpaperInput): WallpaperLayout {
  const { day, fontFamily, measureText, selectedIds, group } = input;
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
    color: dayTint(day.id).color,
  };
  const titleBar: WallpaperRect = {
    x: GUTTER_LEFT,
    y: TITLE_BAR_TOP,
    width: GRID_RIGHT - GUTTER_LEFT,
    height: TITLE_BAR_HEIGHT,
    fill: dayTint(day.id).color,
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
      color: TEXT,
    };
  });

  const lanes = columns.map(({ stage, x }): WallpaperLane => ({
    stageId: stage.id,
    x,
    y: HEADER_BOTTOM,
    width: columnWidth,
    height: AXIS_BOTTOM - HEADER_BOTTOM,
    fill: overBase(stageTint(stage.id).color, LANE_TINT_PERCENT),
  }));
  const headers = columns.map(({ stage, x }): WallpaperStageHeader => {
    const { color } = stageTint(stage.id);
    return {
      stageId: stage.id,
      x,
      y: HEADER_TOP,
      width: columnWidth,
      height: HEADER_BOTTOM - HEADER_TOP,
      fill: overBase(color, HEADER_TINT_PERCENT),
      barColor: color,
      barHeight: HEADER_BAR_HEIGHT,
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
    // Only the day's shows are looked up (R-01). `lit` is the user's alone: a show only friends
    // picked stays dimmed (FR-07).
    const friends = group?.friendsByShow.get(show.id) ?? [];
    return {
      showId: show.id,
      fill: stageTint(show.stageId).color,
      ...box,
      lit: !anySelected || selectedIds.has(show.id),
      ...(friends.length > 0
        ? blockWithBadges(show, box, friends, fontFamily, measureText)
        : { ...blockTexts(show, box, fontFamily, measureText), badges: [] }),
    };
  });

  return {
    width: WALLPAPER_WIDTH,
    height: WALLPAPER_HEIGHT,
    title,
    brand,
    groupLabel: group ? groupLabelText(group.name, title, brand, fontFamily, measureText) : null,
    titleBar,
    lanes,
    headers,
    stageLabels,
    hourMarks: marks,
    blocks,
  };
}

/** `text` in lowercase, without accents, reduced to `[a-z0-9-]`, with no "-" at either end. */
function fileSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * `mi-grilla-viernes.png`, or `mi-grilla-viernes-los-del-lolla.png` with a group (FEAT-007, FR-13):
 * the day's name and the group's, each through `fileSlug` (FR-11, R-06). A name with nothing left
 * after that is left out, so the result is never `mi-grilla-.png`: both empty give `mi-grilla.png`.
 */
export function wallpaperFileName(day: Pick<FestivalDay, "name">, groupName?: string): string {
  const slugs = [day.name, groupName ?? ""].map(fileSlug).filter(Boolean);
  return `${["mi-grilla", ...slugs].join("-")}.png`;
}
