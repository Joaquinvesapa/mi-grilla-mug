// Draws the lock-screen wallpaper on a canvas and encodes it as PNG (FEAT-004, ADR-005). No
// "use client" of its own: only `wallpaper-button.tsx` imports it. Every position comes from
// `wallpaperLayout` (src/lib): this file only paints it. No network in any step, so it works the
// same offline. The font family is the one `next/font` registered on the body; if the faces cannot
// be loaded the canvas falls back along that same family list and the image is still produced.
import { BASE, FOAM, HIGHLIGHT_MED } from "@/lib/palette";
import {
  DIMMED_OPACITY,
  GRID_LEFT,
  GRID_RIGHT,
  WALLPAPER_HEIGHT,
  WALLPAPER_WIDTH,
  type WallpaperInput,
  type WallpaperLayout,
  type WallpaperText,
  wallpaperLayout,
} from "@/lib/wallpaper-layout";

/** The same data as `wallpaperLayout`; the family and the measuring come from the browser. */
export type RenderWallpaperInput = Omit<WallpaperInput, "fontFamily" | "measureText">;

export type RenderWallpaperResult =
  | { ok: true; blob: Blob; fontFallback: boolean }
  | { ok: false; code: "CANVAS_UNSUPPORTED" | "ENCODE_FAILED" };

const BLOCK_RADIUS = 12;
const HOUR_LINE_HEIGHT = 1;
const GENERIC_FAMILY = "sans-serif";
/** The only weights the layout uses: 600 (names, stages, times, brand) and 700 (the day's title). */
const FONT_PROBES = ["600 28px", "700 64px"] as const;
/** How long the faces may take to load before drawing goes on with the fallback (FR-10, NFR-01). */
const FONT_LOAD_TIMEOUT_MS = 1500;

/** The resolved family list of the body, e.g. `"Public Sans", "Public Sans Fallback"`. */
function bodyFontFamily(): string {
  const family = getComputedStyle(document.body).fontFamily.trim();
  return family || GENERIC_FAMILY;
}

/**
 * Waits for the faces to load, for `FONT_LOAD_TIMEOUT_MS` at most: a load that never settles must
 * not hang the wallpaper. `true` when any weight could not be loaded in time (fallback in use).
 */
async function loadFonts(family: string): Promise<boolean> {
  const fonts = (document as Partial<Pick<Document, "fonts">>).fonts;
  if (!fonts) {
    return true;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<true>((resolve) => {
    timer = setTimeout(() => resolve(true), FONT_LOAD_TIMEOUT_MS);
  });
  try {
    const loaded = Promise.all(FONT_PROBES.map((probe) => fonts.load(`${probe} ${family}`))).then(
      (faces) => faces.some((face) => face.length === 0),
    );
    return await Promise.race([loaded, timedOut]);
  } catch {
    // A face that fails to load is not a failure: the canvas draws with the fallback family.
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * A filled rounded rectangle, with `roundRect` when the context has it (older WebKit does not).
 * The blocks use `BLOCK_RADIUS`; the badges, their own `radius`.
 */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, cornerRadius);
  } else {
    const radius = Math.min(cornerRadius, width / 2, height / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }
  ctx.fill();
}

function drawText(ctx: CanvasRenderingContext2D, text: WallpaperText): void {
  ctx.font = text.font;
  ctx.fillStyle = text.color;
  ctx.fillText(text.text, text.x, text.y);
}

function draw(ctx: CanvasRenderingContext2D, layout: WallpaperLayout): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, layout.width, layout.height);

  // Every text position in the layout is its top-left corner.
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  drawText(ctx, layout.title);
  drawText(ctx, layout.brand);
  for (const label of layout.stageLabels) {
    drawText(ctx, label);
  }

  for (const mark of layout.hourMarks) {
    ctx.fillStyle = HIGHLIGHT_MED;
    ctx.fillRect(GRID_LEFT, Math.round(mark.y), GRID_RIGHT - GRID_LEFT, HOUR_LINE_HEIGHT);
    drawText(ctx, mark.text);
  }

  for (const block of layout.blocks) {
    // The block and its text share the alpha: a show that was not chosen is dimmed as a whole.
    ctx.globalAlpha = block.lit ? 1 : DIMMED_OPACITY;
    ctx.fillStyle = FOAM;
    roundedRect(ctx, block.x, block.y, block.width, block.height, BLOCK_RADIUS);
    for (const line of block.lines) {
      drawText(ctx, line);
    }
    if (block.time) {
      drawText(ctx, block.time);
    }
    // The friends' badges are always at full opacity, even on a dimmed show (NFR-03). Their label
    // is already centered by the layout: it is painted where it is, nothing is measured here.
    ctx.globalAlpha = 1;
    for (const badge of block.badges) {
      ctx.fillStyle = badge.fill;
      roundedRect(ctx, badge.x, badge.y, badge.width, badge.height, badge.radius);
      drawText(ctx, badge.label);
    }
  }
  ctx.globalAlpha = 1;
  // The group's name, untrusted text, only ever reaches the image through `fillText` (R-02).
  if (layout.groupLabel) {
    drawText(ctx, layout.groupLabel);
  }
}

/** The canvas as a PNG Blob, or `null` when the browser cannot encode it (or refuses to). */
function encodePng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, "image/png");
    } catch {
      // `SecurityError` (a tainted canvas) and the like: reported to the caller as ENCODE_FAILED.
      resolve(null);
    }
  });
}

/** Draws one day's wallpaper (1290 × 2796) and encodes it as PNG. */
export async function renderWallpaper(input: RenderWallpaperInput): Promise<RenderWallpaperResult> {
  const fontFamily = bodyFontFamily();
  const fontFallback = await loadFonts(fontFamily);

  const canvas = document.createElement("canvas");
  canvas.width = WALLPAPER_WIDTH;
  canvas.height = WALLPAPER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { ok: false, code: "CANVAS_UNSUPPORTED" };
  }

  const layout = wallpaperLayout({
    ...input,
    fontFamily,
    measureText: (text, font) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    },
  });
  draw(ctx, layout);

  const blob = await encodePng(canvas);
  // A 0 × 0 canvas lets WebKit free the bitmap right away instead of on GC (R-03).
  canvas.width = canvas.height = 0;
  if (!blob) {
    return { ok: false, code: "ENCODE_FAILED" };
  }
  return { ok: true, blob, fontFallback };
}
