import { readFile } from "node:fs/promises";

import { expect, type Download, type Locator, type Page } from "@playwright/test";

import {
  DOWNLOAD_IMAGE_LABEL,
  SAVE_TO_PHOTOS_LABEL,
  WALLPAPER_BUTTON_LABEL,
  WALLPAPER_DONE_LABEL,
  WALLPAPER_GUIDE_STEPS,
  WALLPAPER_SHEET_TITLE,
  wallpaperPreviewAlt,
} from "@/lib/wallpaper-messages";

import { dayName, interval, showById, showsOfDay, STAGES } from "./grid";

// The steps the wallpaper E2E specs share (FEAT-004, FEAT-007): opening the sheet, waiting for the
// preview, forcing one delivery or the other, and decoding the PNG to read its size and a few pixels.
//
// The delivery must not depend on the browser that emulates the phone (none of them has a system
// share sheet here), so an init script fixes it before the page loads: on the share path
// `navigator.canShare`/`navigator.share` are spies that keep the shared `File` (and
// `(pointer: coarse)` matches), on the download path both are removed. The PNG is decoded in the
// browser with `createImageBitmap` to read its size and a few pixels.

export const BUTTON_LABEL = WALLPAPER_BUTTON_LABEL;
export const SAVE_TO_PHOTOS = SAVE_TO_PHOTOS_LABEL;
export const DOWNLOAD_IMAGE = DOWNLOAD_IMAGE_LABEL;
export const DONE_LABEL = WALLPAPER_DONE_LABEL;
/** Both guides have as many steps: the first one is where the image went. */
const GUIDE_STEPS = WALLPAPER_GUIDE_STEPS.download.length;

const WIDTH = 1290;
const HEIGHT = 2796;
/** NFR-04: the PNG weighs 5 MB at most. */
const MAX_BYTES = 5 * 1024 * 1024;
/** What the alt of every preview starts with, whatever its day and its group. */
const PREVIEW_ALT_PREFIX = wallpaperPreviewAlt("");
/** AC-15 of FEAT-004 (and AC-19 of FEAT-007), as a reference in iphone-webkit: tap to preview. */
export const PREVIEW_BUDGET_MS = 3000;
/** Drawing the image in a slow CI runner: the wait for the preview, not the budget. */
const PREVIEW_TIMEOUT_MS = 15_000;

// The image's geometry. The source of these constants is docs/daw/specs/spec-FEAT-004.md (Block 1
// and Block 2), with the axis end of docs/daw/specs/fix-FIX-003.md (the bottom 392 px stay free for
// the flashlight and camera): the hour axis from y = 849 to y = 2404, five equal columns from x = 120 to x = 1266
// with 8 px between them, blocks at least 70 px tall that stop 4 px before the next show of their
// stage, rounded with a 12 px radius, and 1 px hour lines at the rounded y of each whole hour. Each
// probe sits 5 px from its column's right edge, where the 12 px padding keeps any text away.
const AXIS_TOP = 849;
const AXIS_BOTTOM = 2404;
const GRID_LEFT = 120;
const GRID_RIGHT = 1266;
const COLUMN_GAP = 8;
const MIN_BLOCK_HEIGHT = 70;
const NEXT_SHOW_GAP = 4;
const BLOCK_RADIUS = 12;
const PROBE_FROM_TOP = 30;
const PROBE_FROM_RIGHT = 5;
/** A probe keeps this far from an hour line (rounded, 1 px) and from another block's edge. */
const LINE_CLEARANCE = 1;
export const EDGE_CLEARANCE = 2;
/** When the chosen y is not clear, the probe is moved by these offsets, in order, before failing. */
const PROBE_SHIFTS = [0, 3, -3, 6, -6, 9, -9];

type Rgb = [number, number, number];
const FOAM: Rgb = [0x9c, 0xcf, 0xd8];
const BASE: Rgb = [0x19, 0x17, 0x24];
/** FOAM drawn at `DIMMED_OPACITY` (0.3) over BASE. */
const DIMMED: Rgb = [0, 1, 2].map((i) => Math.round(FOAM[i]! * 0.3 + BASE[i]! * 0.7)) as Rgb;
const COLOR_TOLERANCE = 30;

/** A pixel to read: `id` names it in the report, `stageId` is its column. */
type Probe = { id: string; stageId: string; x: number; y: number };

type BlockBox = { showId: string; top: number; bottom: number };

/** "HH:MM" in minutes of the festival day, which runs 06:00 to 06:00 (as `interval`). */
function minutesOfClock(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  const absolute = (hours ?? 0) * 60 + (minutes ?? 0);
  return absolute < 6 * 60 ? absolute + 24 * 60 : absolute;
}

/** The day's axis, in minutes of the festival day: whole hours around its shows. */
function axisOf(dayId: string): { start: number; end: number; scale: number } {
  const day = showsOfDay(dayId).map(interval);
  const start = Math.floor(Math.min(...day.map((item) => item.start)) / 60) * 60;
  const end = Math.ceil(Math.max(...day.map((item) => item.end)) / 60) * 60;
  return { start, end, scale: (AXIS_BOTTOM - AXIS_TOP) / (end - start) };
}

function yOf(dayId: string, minutes: number): number {
  const axis = axisOf(dayId);
  return AXIS_TOP + (minutes - axis.start) * axis.scale;
}

/** The y of each hour line of the day's image, rounded as it is drawn. */
function hourLines(dayId: string): number[] {
  const axis = axisOf(dayId);
  const lines: number[] = [];
  for (let minutes = axis.start; minutes <= axis.end; minutes += 60) {
    lines.push(Math.round(yOf(dayId, minutes)));
  }
  return lines;
}

/** The blocks of a stage on a day's image: from its start, ≥ 70 px, 4 px short of the next show. */
export function stageBlocks(dayId: string, stageId: string): BlockBox[] {
  const shows = showsOfDay(dayId)
    .filter((show) => show.stageId === stageId)
    .sort((a, b) => interval(a).start - interval(b).start);
  return shows.map((show, index) => {
    const top = yOf(dayId, interval(show).start);
    const natural = yOf(dayId, interval(show).end) - top;
    const next = shows[index + 1];
    const limit = Math.min(
      AXIS_BOTTOM,
      next ? yOf(dayId, interval(next).start) - NEXT_SHOW_GAP : AXIS_BOTTOM,
    );
    return {
      showId: show.id,
      top,
      bottom: top + Math.min(Math.max(natural, MIN_BLOCK_HEIGHT), limit - top),
    };
  });
}

/** The shows whose block, grown by `margin` px (shrunk if negative), holds `y` on that column. */
export function showsAt(dayId: string, stageId: string, y: number, margin: number): string[] {
  return stageBlocks(dayId, stageId)
    .filter((block) => y >= block.top - margin && y <= block.bottom + margin)
    .map((block) => block.showId);
}

/**
 * Why `y` is not a clean place to read `showId`'s color (or the background, with `null`) on the
 * day's image, or `null` when it is: away from the hour lines, inside the block clear of its rounded
 * corners, and away from any other block of the column (the next show's included).
 */
function probeProblem(dayId: string, stageId: string, y: number, showId: string | null) {
  if (y < AXIS_TOP || y > AXIS_BOTTOM) return `y = ${y} queda fuera del eje`;
  const line = hourLines(dayId).find((lineY) => Math.abs(lineY - y) <= LINE_CLEARANCE);
  if (line !== undefined) return `y = ${y} cae sobre la línea de hora de y = ${line}`;
  if (showId !== null && !showsAt(dayId, stageId, y, -(BLOCK_RADIUS + 1)).includes(showId)) {
    return `y = ${y} no cae dentro del bloque de ${showId} lejos de sus esquinas redondeadas`;
  }
  const others = showsAt(dayId, stageId, y, EDGE_CLEARANCE).filter((id) => id !== showId);
  if (others.length > 0) return `y = ${y} cae en (o al borde de) el bloque de ${others.join(", ")}`;
  return null;
}

/**
 * A probe on `stageId` near `wantedY` that reads `showId`'s block (or the background, with `null`)
 * on the day's image. If `wantedY` is not clean it moves a few px; if no nearby y is, the test fails
 * here saying why, instead of reading a line or a neighbour and failing somewhere else.
 */
export function placeProbe(
  id: string,
  dayId: string,
  stageId: string,
  wantedY: number,
  showId: string | null,
): Probe {
  const column = STAGES.findIndex((stage) => stage.id === stageId);
  const columnWidth = (GRID_RIGHT - GRID_LEFT - COLUMN_GAP * (STAGES.length - 1)) / STAGES.length;
  const x = Math.floor(
    GRID_LEFT + column * (columnWidth + COLUMN_GAP) + columnWidth - PROBE_FROM_RIGHT,
  );
  const base = Math.round(wantedY);
  const y = PROBE_SHIFTS.map((shift) => base + shift).find(
    (candidate) => probeProblem(dayId, stageId, candidate, showId) === null,
  );
  expect(
    y === undefined ? probeProblem(dayId, stageId, base, showId) : null,
    `la sonda ${id} no tiene un píxel limpio a ±${Math.max(...PROBE_SHIFTS)} px: elegí otro punto`,
  ).toBeNull();
  return { id, stageId, x, y: y! };
}

/** Where to read the color of each show's block in the image of its day: 30 px below its top. */
export function probesFor(showIds: readonly string[]): Probe[] {
  return showIds.map((id) => {
    const show = showById(id);
    const top = yOf(show.dayId, interval(show).start);
    return placeProbe(id, show.dayId, show.stageId, top + PROBE_FROM_TOP, id);
  });
}

/** A probe at a clock time on a stage of the day's image, reading `showId` or the background. */
export function probeAt(
  id: string,
  dayId: string,
  stageId: string,
  at: string,
  showId: string | null,
): Probe {
  return placeProbe(id, dayId, stageId, yOf(dayId, minutesOfClock(at)), showId);
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** "lit" (FOAM), "dimmed" (FOAM at 0.3), "background" (BASE) or the color found. */
function shade(rgb: Rgb): string {
  if (distance(rgb, FOAM) <= COLOR_TOLERANCE) return "lit";
  if (distance(rgb, DIMMED) <= COLOR_TOLERANCE) return "dimmed";
  if (distance(rgb, BASE) <= COLOR_TOLERANCE) return "background";
  return `rgb(${rgb.join(", ")})`;
}

type PngSource =
  | { kind: "shared" }
  | { kind: "preview" }
  | { kind: "bytes"; base64: string; name: string };

type PngReport = {
  name: string | null;
  type: string;
  size: number;
  width: number;
  height: number;
  shades: Record<string, string>;
};

/**
 * Decodes a PNG in the browser: the `File` handed to the spied `share`, the preview on screen, or
 * the bytes of a downloaded file. Returns its name, type, weight, size and the shade of each probe.
 */
export async function readPng(
  page: Page,
  source: PngSource,
  probes: Probe[] = [],
): Promise<PngReport> {
  const report = await page.evaluate(
    async ({ source, probes, altPrefix }) => {
      let blob: Blob;
      let name: string | null = null;
      if (source.kind === "shared") {
        const file = (window as unknown as { __wallpaperShare: { file: File | null } })
          .__wallpaperShare.file;
        if (!file) throw new Error("share no recibió ningún archivo");
        blob = file;
        name = file.name;
      } else if (source.kind === "preview") {
        const img = [...document.querySelectorAll<HTMLImageElement>("img")].find((item) =>
          item.alt.startsWith(altPrefix),
        );
        if (!img) throw new Error("no hay vista previa");
        blob = await (await fetch(img.src)).blob();
      } else {
        const binary = atob(source.base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: "image/png" });
        name = source.name;
      }
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("sin canvas 2d para leer la imagen");
      context.drawImage(bitmap, 0, 0);
      const colors: Record<string, [number, number, number]> = {};
      for (const probe of probes) {
        const data = context.getImageData(probe.x, probe.y, 1, 1).data;
        colors[probe.id] = [data[0]!, data[1]!, data[2]!];
      }
      return {
        name,
        type: blob.type,
        size: blob.size,
        width: bitmap.width,
        height: bitmap.height,
        colors,
      };
    },
    { source, probes, altPrefix: PREVIEW_ALT_PREFIX },
  );
  const shades: Record<string, string> = {};
  for (const [id, rgb] of Object.entries(report.colors)) shades[id] = shade(rgb);
  return {
    name: report.name,
    type: report.type,
    size: report.size,
    width: report.width,
    height: report.height,
    shades,
  };
}

/** A downloaded PNG, read from disk and decoded in the browser. */
export async function readDownload(page: Page, download: Download, probes: Probe[] = []) {
  const path = await download.path();
  const bytes = await readFile(path);
  return readPng(
    page,
    { kind: "bytes", base64: bytes.toString("base64"), name: download.suggestedFilename() },
    probes,
  );
}

export function expectWallpaperPng(png: PngReport) {
  expect(png.type).toBe("image/png");
  expect(png.width, "ancho del fondo").toBe(WIDTH);
  expect(png.height, "alto del fondo").toBe(HEIGHT);
  expect(png.size, "peso del fondo (NFR-04)").toBeGreaterThan(0);
  expect(png.size, "peso del fondo (NFR-04)").toBeLessThanOrEqual(MAX_BYTES);
}

/**
 * The share path: `canShare` answers true for PNG files (and records what it was asked),
 * `(pointer: coarse)` matches, and `share` keeps the file it gets. With `rejectWith`, `share`
 * rejects with a `DOMException` of that name, as WebKit does without a fresh tap.
 */
export async function useShareSpy(page: Page, rejectWith?: string): Promise<void> {
  await page.addInitScript((rejectWith) => {
    const state = { calls: 0, file: null as File | null, asked: [] as string[] };
    Object.assign(window, { __wallpaperShare: state });
    const isPngFiles = (data?: ShareData) =>
      Array.isArray(data?.files) &&
      data.files.length > 0 &&
      data.files.every((file) => file instanceof File && file.type === "image/png");
    Object.defineProperty(Navigator.prototype, "canShare", {
      configurable: true,
      writable: true,
      value(data?: ShareData) {
        for (const file of data?.files ?? []) state.asked.push(file.name);
        return isPngFiles(data);
      },
    });
    Object.defineProperty(Navigator.prototype, "share", {
      configurable: true,
      writable: true,
      async value(data?: ShareData) {
        state.calls += 1;
        state.file = data?.files?.[0] ?? null;
        if (rejectWith) throw new DOMException("rechazado por el test", rejectWith);
      },
    });
    // A real MediaQueryList that answers `matches: true`: its methods are the real list's, bound to
    // it, so a component that subscribes does not hit "Illegal invocation".
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => {
      const list = matchMedia(query);
      if (query.replace(/\s+/g, "") !== "(pointer:coarse)") return list;
      const coarse = Object.create(list) as MediaQueryList;
      Object.defineProperty(coarse, "matches", { value: true });
      Object.defineProperty(coarse, "media", { value: list.media });
      Object.defineProperty(coarse, "onchange", {
        get: () => list.onchange,
        set: (handler: MediaQueryList["onchange"]) => {
          list.onchange = handler;
        },
      });
      for (const method of [
        "addEventListener",
        "removeEventListener",
        "addListener",
        "removeListener",
        "dispatchEvent",
      ] as const) {
        Object.defineProperty(coarse, method, { value: list[method].bind(list) });
      }
      return coarse;
    };
  }, rejectWith ?? null);
}

/** The download path: the browser has no Web Share API at all. */
export async function withoutShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const key of ["canShare", "share"]) {
      Reflect.deleteProperty(Navigator.prototype, key);
      Reflect.deleteProperty(navigator, key);
    }
  });
}

export async function readShareSpy(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __wallpaperShare: { calls: number; asked: string[] } })
        .__wallpaperShare,
  );
}

export function wallpaperButton(page: Page): Locator {
  return page.getByRole("button", { name: BUTTON_LABEL, exact: true });
}

export function sheet(page: Page): Locator {
  return page.getByRole("dialog", { name: WALLPAPER_SHEET_TITLE });
}

/** The preview of the day's wallpaper: the personal one, or the group's with `groupName`. */
function preview(page: Page, dayId: string, groupName?: string): Locator {
  return sheet(page).getByRole("img", {
    name: wallpaperPreviewAlt(dayName(dayId), groupName),
    exact: true,
  });
}

/**
 * Waits for the preview (the group's, with `groupName`) and its delivery button, settled in place
 * (the sheet slides in: a click during the slide can land where the button used to be).
 *
 * The button has to be fully on screen without scrolling anything, with or without a group: it is
 * stuck to the bottom of the sheet's body, and the question, the select and the preview scroll
 * above it (FEAT-007, the user's decision in decisions-FEAT-007.md).
 */
export async function waitForPreview(
  page: Page,
  dayId: string,
  delivery: string,
  groupName?: string,
): Promise<Locator> {
  const image = preview(page, dayId, groupName);
  await expect(image).toBeVisible({ timeout: PREVIEW_TIMEOUT_MS });
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(WIDTH);
  const action = sheet(page).getByRole("button", { name: delivery, exact: true });
  await expect(action).toBeEnabled();
  await expect(action, `"${delivery}" no está entero en pantalla sin scrollear`).toBeInViewport({
    ratio: 0.99,
  });
  return action;
}

type PreviewTiming = { tap: number | null; preview: number | null };

/**
 * Times the preview from the page itself, before it loads: from the first pointerdown on the button
 * named `tapLabel` (its `aria-label` or its text) to the `load` of the first preview after it.
 * Read it with `readPreviewTiming`.
 */
export async function trackPreviewTiming(page: Page, tapLabel: string): Promise<void> {
  await page.addInitScript(
    ({ tapLabel, altPrefix }) => {
      const timing = { tap: null as number | null, preview: null as number | null };
      Object.assign(window, { __wallpaperTiming: timing });
      document.addEventListener(
        "pointerdown",
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          const button = target?.closest("button");
          const name = button?.getAttribute("aria-label") ?? button?.textContent?.trim();
          if (timing.tap === null && name === tapLabel) {
            timing.tap = performance.now();
          }
        },
        true,
      );
      document.addEventListener(
        "load",
        (event) => {
          const target = event.target;
          if (
            timing.tap !== null &&
            timing.preview === null &&
            target instanceof HTMLImageElement &&
            target.alt.startsWith(altPrefix)
          ) {
            timing.preview = performance.now();
          }
        },
        true,
      );
    },
    { tapLabel, altPrefix: PREVIEW_ALT_PREFIX },
  );
}

/** What `trackPreviewTiming` recorded: when the tap and the preview's load happened, if they did. */
export async function readPreviewTiming(page: Page): Promise<PreviewTiming> {
  return page.evaluate(
    () => (window as unknown as { __wallpaperTiming: PreviewTiming }).__wallpaperTiming,
  );
}

/** Taps "Descargar fondo" and waits for the personal preview and its delivery button. */
export async function openWallpaper(page: Page, dayId: string, delivery: string): Promise<Locator> {
  await wallpaperButton(page).click();
  await expect(sheet(page)).toBeVisible();
  return waitForPreview(page, dayId, delivery);
}

export async function expectGuide(page: Page) {
  await expect(sheet(page).getByText(DONE_LABEL)).toBeVisible();
  await expect(sheet(page).getByRole("list").getByRole("listitem")).toHaveCount(GUIDE_STEPS);
}

/** Taps the delivery button and returns the download it starts. */
export async function downloadFrom(page: Page, action: Locator): Promise<Download> {
  const started = page.waitForEvent("download");
  await action.click();
  return started;
}
