import { readFile } from "node:fs/promises";

import { expect, test, type Download, type Locator, type Page } from "@playwright/test";

import { signUp } from "./auth";
import {
  chooseDay,
  dayName,
  interval,
  pendingBar,
  saveSelection,
  showBlock,
  showById,
  showsOfDay,
  STAGES,
} from "./grid";
import {
  expectChosen,
  notice,
  readPendingIds,
  reopenOffline,
  saveOffline,
  signUpControlled,
} from "./offline";

// FEAT-004 end to end, against the production build with its service worker (ADR-002, ADR-005):
// the wallpaper comes out at 1290 × 2796, with the selection on screen, with and without a
// connection, through both deliveries. Runs in the three mobile projects (iphone-webkit,
// mobile-chromium, mobile-360): playwright.config.ts does not exclude this file from any of them.
// Every test signs up an account of its own.
//
// The delivery must not depend on the browser that emulates the phone (none of them has a system
// share sheet here), so an init script fixes it before the page loads: on the share path
// `navigator.canShare`/`navigator.share` are spies that keep the shared `File` (and
// `(pointer: coarse)` matches), on the download path both are removed. The PNG is decoded in the
// browser with `createImageBitmap` to read its size and a few pixels.

const BUTTON_LABEL = "Descargar fondo";
const SHEET_TITLE = "Fondo de pantalla";
const SAVE_TO_PHOTOS = "Guardar en Fotos";
const DOWNLOAD_IMAGE = "Descargar imagen";
const DONE_LABEL = "Listo. Así lo ponés de fondo:";
const SHARE_FAILED_MESSAGE = "No pudimos abrir la opción de guardar en Fotos. Descargá la imagen.";
const GUIDE_STEPS = 4;

const WIDTH = 1290;
const HEIGHT = 2796;
/** NFR-04: the PNG weighs 5 MB at most. */
const MAX_BYTES = 5 * 1024 * 1024;
/** AC-15, as a reference in iphone-webkit: from the tap to the preview. */
const PREVIEW_BUDGET_MS = 3000;
/** Drawing the image in a slow CI runner: the wait for the preview, not the budget. */
const PREVIEW_TIMEOUT_MS = 15_000;
const PHONE_WIDTHS = [
  { width: 360, height: 780 },
  { width: 430, height: 932 },
];
/** Why the timing test runs in one project (AGENTS.md: the reason, on the skipped line). */
const TIME_SKIP =
  "AC-15 se mide como referencia solo en iphone-webkit; el iPhone 12 real se mide a mano en VERIFY";

// Friday, the day the grid opens on outside the festival. By stable id, never by artist.
const TYLER = showById("fri-flow-2215").id; // Tyler, The Creator
const LORDE = showById("fri-samsung-2100").id; // Lorde
const UNCHOSEN = showById("fri-flow-1800").id;
// AC-09: two places on the Flow column that only Saturday's image paints the way it does. Friday and
// Saturday share the axis (13:00 to 01:00), so a place is the same pixel on both images.
/** Saturday's Flow runs to 23:45; Friday's ends at 23:30: at 23:38 only Saturday has a block. */
const SAT_ONLY = { show: showById("sat-flow-2215").id, at: "23:38" };
/** Friday's Flow plays from 20:00; Saturday's is empty from 19:00 to 20:15: 20:08 is background. */
const FRI_ONLY = { show: showById("fri-flow-2000").id, at: "20:08" };

// The image's geometry. The source of these constants is docs/daw/specs/spec-FEAT-004.md (Block 1
// and Block 2): the hour axis from y = 849 to y = 2572, five equal columns from x = 120 to x = 1266
// with 8 px between them, blocks at least 70 px tall that stop 4 px before the next show of their
// stage, rounded with a 12 px radius, and 1 px hour lines at the rounded y of each whole hour. Each
// probe sits 5 px from its column's right edge, where the 12 px padding keeps any text away.
const AXIS_TOP = 849;
const AXIS_BOTTOM = 2572;
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
const EDGE_CLEARANCE = 2;
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
function stageBlocks(dayId: string, stageId: string): BlockBox[] {
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
function showsAt(dayId: string, stageId: string, y: number, margin: number): string[] {
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
function placeProbe(
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
function probesFor(showIds: readonly string[]): Probe[] {
  return showIds.map((id) => {
    const show = showById(id);
    const top = yOf(show.dayId, interval(show).start);
    return placeProbe(id, show.dayId, show.stageId, top + PROBE_FROM_TOP, id);
  });
}

/** A probe at a clock time on a stage of the day's image, reading `showId` or the background. */
function probeAt(
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
async function readPng(page: Page, source: PngSource, probes: Probe[] = []): Promise<PngReport> {
  const report = await page.evaluate(
    async ({ source, probes }) => {
      let blob: Blob;
      let name: string | null = null;
      if (source.kind === "shared") {
        const file = (window as unknown as { __wallpaperShare: { file: File | null } })
          .__wallpaperShare.file;
        if (!file) throw new Error("share no recibió ningún archivo");
        blob = file;
        name = file.name;
      } else if (source.kind === "preview") {
        const img = document.querySelector<HTMLImageElement>('img[alt^="Vista previa del fondo"]');
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
    { source, probes },
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
async function readDownload(page: Page, download: Download, probes: Probe[] = []) {
  const path = await download.path();
  const bytes = await readFile(path);
  return readPng(
    page,
    { kind: "bytes", base64: bytes.toString("base64"), name: download.suggestedFilename() },
    probes,
  );
}

function expectWallpaperPng(png: PngReport) {
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
async function useShareSpy(page: Page, rejectWith?: string): Promise<void> {
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
async function withoutShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const key of ["canShare", "share"]) {
      Reflect.deleteProperty(Navigator.prototype, key);
      Reflect.deleteProperty(navigator, key);
    }
  });
}

async function readShareSpy(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __wallpaperShare: { calls: number; asked: string[] } })
        .__wallpaperShare,
  );
}

function wallpaperButton(page: Page): Locator {
  return page.getByRole("button", { name: BUTTON_LABEL, exact: true });
}

function sheet(page: Page): Locator {
  return page.getByRole("dialog", { name: SHEET_TITLE });
}

function preview(page: Page, dayId: string): Locator {
  return sheet(page).getByRole("img", { name: `Vista previa del fondo del ${dayName(dayId)}` });
}

/**
 * Taps "Descargar fondo" and waits for the preview and its delivery button, settled in place (the
 * sheet slides in: a click during the slide can land where the button used to be).
 */
async function openWallpaper(page: Page, dayId: string, delivery: string): Promise<Locator> {
  await wallpaperButton(page).click();
  await expect(sheet(page)).toBeVisible();
  await expect(preview(page, dayId)).toBeVisible({ timeout: PREVIEW_TIMEOUT_MS });
  await expect
    .poll(() => preview(page, dayId).evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(WIDTH);
  const action = sheet(page).getByRole("button", { name: delivery, exact: true });
  await expect(action).toBeEnabled();
  await expect(action).toBeInViewport({ ratio: 0.99 });
  return action;
}

async function expectGuide(page: Page) {
  await expect(sheet(page).getByText(DONE_LABEL)).toBeVisible();
  await expect(sheet(page).getByRole("list").getByRole("listitem")).toHaveCount(GUIDE_STEPS);
}

/** Taps the delivery button and returns the download it starts. */
async function downloadFrom(page: Page, action: Locator): Promise<Download> {
  const started = page.waitForEvent("download");
  await action.click();
  return started;
}

test.describe("el fondo de pantalla (FEAT-004)", () => {
  test('test-e2e-wallpaper-share: viernes con Tyler y Lorde guardados, "Guardar en Fotos" comparte un PNG de 1290 × 2796 y ≤ 5 MB llamado mi-grilla-viernes.png y muestra la guía (AC-01, AC-03, AC-13, NFR-04)', async ({
    page,
  }, testInfo) => {
    await useShareSpy(page);
    await signUpControlled(page, testInfo);
    await showBlock(page, TYLER).click();
    await showBlock(page, LORDE).click();
    await saveSelection(page);

    const action = await openWallpaper(page, "fri", SAVE_TO_PHOTOS);
    await action.click();
    await expectGuide(page);

    const spy = await readShareSpy(page);
    expect(spy.calls, "share se llamó una vez").toBe(1);
    // canShare was asked about the very file that was shared.
    expect(spy.asked).toContain("mi-grilla-viernes.png");
    const png = await readPng(page, { kind: "shared" }, probesFor([TYLER, LORDE, UNCHOSEN]));
    expect(png.name).toBe("mi-grilla-viernes.png");
    expectWallpaperPng(png);
    // The saved selection lit, the rest dimmed (AC-05).
    expect(png.shades).toEqual({ [TYLER]: "lit", [LORDE]: "lit", [UNCHOSEN]: "dimmed" });
  });

  test('test-e2e-wallpaper-download: sin canShare, en el sábado "Descargar imagen" descarga mi-grilla-sabado.png (AC-02, AC-09)', async ({
    page,
  }, testInfo) => {
    await withoutShare(page);
    await signUpControlled(page, testInfo);
    await chooseDay(page, "sat");

    const action = await openWallpaper(page, "sat", DOWNLOAD_IMAGE);
    await expect(sheet(page).getByRole("button", { name: SAVE_TO_PHOTOS })).toHaveCount(0);
    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-sabado.png");
    await expectGuide(page);

    // AC-09: the image is Saturday's grid. Nothing is chosen, so every show is lit (FR-05): the
    // place only Saturday fills is lit, and the place only Friday fills is background.
    const satOnly = probeAt("solo-sábado", "sat", "flow", SAT_ONLY.at, SAT_ONLY.show);
    const friOnly = probeAt("solo-viernes", "fri", "flow", FRI_ONLY.at, FRI_ONLY.show);
    const friOnlyOnSat = placeProbe("solo-viernes", "sat", "flow", friOnly.y, null);
    // The two places tell the days apart: each is empty on the other day's image.
    expect(
      showsAt("fri", "flow", satOnly.y, EDGE_CLEARANCE),
      "el viernes no está vacío ahí",
    ).toEqual([]);
    expect(friOnlyOnSat.y, "la sonda del viernes se movió en la imagen del sábado").toBe(friOnly.y);
    const png = await readDownload(page, download, [satOnly, friOnlyOnSat]);
    expectWallpaperPng(png);
    expect(png.shades).toEqual({ "solo-sábado": "lit", "solo-viernes": "background" });
  });

  test("test-e2e-wallpaper-unsaved: un show marcado sin Guardar entra en el fondo y el cambio sigue pendiente (AC-10)", async ({
    page,
  }, testInfo) => {
    await withoutShare(page);
    await signUpControlled(page, testInfo);
    await showBlock(page, TYLER).click();
    await expect(pendingBar(page)).toBeVisible();

    const action = await openWallpaper(page, "fri", DOWNLOAD_IMAGE);
    const probes = probesFor([TYLER, LORDE]);
    // The preview already draws the draft: only the unsaved show is lit.
    expect((await readPng(page, { kind: "preview" }, probes)).shades).toEqual({
      [TYLER]: "lit",
      [LORDE]: "dimmed",
    });
    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-viernes.png");
    const png = await readDownload(page, download, probes);
    expectWallpaperPng(png);
    expect(png.shades).toEqual({ [TYLER]: "lit", [LORDE]: "dimmed" });

    // Downloading did not save anything: the change is still pending on screen.
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(pendingBar(page)).toBeVisible();
    await expectChosen(page, TYLER, true);
  });

  test("test-e2e-wallpaper-offline-pending: sin conexión guarda un show, recarga / sin conexión y el fondo se genera y se descarga con esa selección (AC-11, AC-12)", async ({
    page,
    context,
  }, testInfo) => {
    await withoutShare(page);
    const { userId } = await signUpControlled(page, testInfo);
    await saveOffline(page, context, TYLER);
    expect(await readPendingIds(page, userId)).toEqual([TYLER]);

    await reopenOffline(page);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(notice(page)).toBeVisible();
    await expectChosen(page, TYLER, true);
    await expect(wallpaperButton(page)).toBeEnabled();

    const action = await openWallpaper(page, "fri", DOWNLOAD_IMAGE);
    const probes = probesFor([TYLER, LORDE]);
    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-viernes.png");
    await expectGuide(page);
    const png = await readDownload(page, download, probes);
    expectWallpaperPng(png);
    // The pending selection, not yet on the server, is what the image lights.
    expect(png.shades).toEqual({ [TYLER]: "lit", [LORDE]: "dimmed" });
    // Still pending: nothing here syncs it.
    expect(await readPendingIds(page, userId)).toEqual([TYLER]);
  });

  test('test-e2e-wallpaper-share-rejected-error: share rechazado con NotAllowedError muestra la alerta y "Descargar imagen" descarga el fondo', async ({
    page,
  }, testInfo) => {
    await useShareSpy(page, "NotAllowedError");
    await signUpControlled(page, testInfo);

    const share = await openWallpaper(page, "fri", SAVE_TO_PHOTOS);
    await share.click();

    await expect(sheet(page).getByRole("alert")).toHaveText(SHARE_FAILED_MESSAGE);
    // Neither the browser's message nor the guide: the image was not saved.
    await expect(sheet(page).getByText("rechazado por el test")).toHaveCount(0);
    await expect(sheet(page).getByText(DONE_LABEL)).toHaveCount(0);
    expect((await readShareSpy(page)).calls).toBe(1);

    const download = sheet(page).getByRole("button", { name: DOWNLOAD_IMAGE, exact: true });
    await expect(download).toBeEnabled();
    const file = await downloadFrom(page, download);
    expect(file.suggestedFilename()).toBe("mi-grilla-viernes.png");
    await expectGuide(page);
    expectWallpaperPng(await readDownload(page, file));
  });

  test("test-e2e-wallpaper-time: desde el toque hasta la vista previa pasan ≤ 3000 ms (referencia de AC-15)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "iphone-webkit", TIME_SKIP); // AC-15 se mide solo en WebKit (iPhone)
    await withoutShare(page);
    // Timed by the page itself: from the first pointerdown on the button to the preview's load.
    await page.addInitScript((buttonLabel) => {
      const timing = { tap: null as number | null, preview: null as number | null };
      Object.assign(window, { __wallpaperTiming: timing });
      document.addEventListener(
        "pointerdown",
        (event) => {
          const target = event.target instanceof Element ? event.target : null;
          if (timing.tap === null && target?.closest(`[aria-label="${buttonLabel}"]`)) {
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
            timing.preview === null &&
            target instanceof HTMLImageElement &&
            target.alt.startsWith("Vista previa del fondo")
          ) {
            timing.preview = performance.now();
          }
        },
        true,
      );
    }, BUTTON_LABEL);
    await signUpControlled(page, testInfo);
    await showBlock(page, TYLER).click();
    await saveSelection(page);

    await openWallpaper(page, "fri", DOWNLOAD_IMAGE);
    const timing = await page.evaluate(
      () =>
        (window as unknown as { __wallpaperTiming: { tap: number | null; preview: number | null } })
          .__wallpaperTiming,
    );
    expect(timing.tap, "no se registró el toque").not.toBeNull();
    expect(timing.preview, "no se registró la carga de la vista previa").not.toBeNull();
    const elapsed = timing.preview! - timing.tap!;
    testInfo.annotations.push({
      type: "AC-15",
      description: `del toque a la vista previa: ${Math.round(elapsed)} ms`,
    });
    expect(elapsed, "la vista previa tardó más de 3 s (AC-15)").toBeLessThanOrEqual(
      PREVIEW_BUDGET_MS,
    );
  });

  for (const viewport of PHONE_WIDTHS) {
    test(`test-e2e-wallpaper-tap-target: a ${viewport.width} px el botón mide ≥ 44 × 44 y la fila de los días no tiene scroll horizontal`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await signUp(page, testInfo);
      await expect(page.getByRole("tab", { name: "Viernes", exact: true })).toBeVisible();

      const button = wallpaperButton(page);
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box, "el botón no tiene caja").not.toBeNull();
      expect(box!.width, "ancho del botón").toBeGreaterThanOrEqual(44);
      expect(box!.height, "alto del botón").toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, "el botón se sale de la pantalla").toBeLessThanOrEqual(
        viewport.width,
      );

      // The row is the tab list's parent: the days and the button, side by side.
      const row = page.getByRole("tablist").locator("xpath=..");
      await expect(row.getByRole("button", { name: BUTTON_LABEL })).toHaveCount(1);
      const sizes = await row.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        right: element.getBoundingClientRect().right,
        documentScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(sizes.scrollWidth, "la fila de los días scrollea en horizontal").toBeLessThanOrEqual(
        sizes.clientWidth,
      );
      expect(sizes.right, "la fila de los días se sale de la pantalla").toBeLessThanOrEqual(
        viewport.width,
      );
      expect(sizes.documentScrollWidth, "la página scrollea en horizontal").toBeLessThanOrEqual(
        sizes.innerWidth,
      );
      // Every day still has its tap target next to the button.
      for (const tab of await page.getByRole("tab").all()) {
        const tabBox = await tab.boundingBox();
        expect(tabBox!.height, "alto del día").toBeGreaterThanOrEqual(44);
      }
    });
  }
});
