import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWallpaper, type RenderWallpaperInput } from "@/components/wallpaper-canvas";
import { BASE, FOAM, HIGHLIGHT_MED } from "@/lib/palette";
import {
  DIMMED_OPACITY,
  GRID_LEFT,
  GRID_RIGHT,
  WALLPAPER_HEIGHT,
  WALLPAPER_WIDTH,
  wallpaperLayout,
} from "@/lib/wallpaper-layout";

import { DAYS, STAGES, showsOf } from "./schedule-fixture";

// jsdom has no canvas: `getContext` returns a fake 2D context that records what is drawn (with the
// fill style, alpha and font in effect at each call) and `toBlob` hands back a PNG Blob. jsdom has
// no `document.fonts` either: each test installs the one it needs. The body's family comes from a
// stylesheet, as `next/font` sets it, never from an inline style.

const FAMILY = '"Public Sans", "Public Sans Fallback", sans-serif';
const FRIDAY = DAYS[0] ?? { id: "fri", name: "Viernes", date: "2026-03-13", position: 1 };
const FRIDAY_SHOWS = showsOf("fri");

type DrawCall = {
  op: string;
  args: unknown[];
  fillStyle: string;
  globalAlpha: number;
  font: string;
};

class FakeContext {
  fillStyle = "#000000";
  globalAlpha = 1;
  font = "10px sans-serif";
  textAlign = "start";
  textBaseline = "alphabetic";
  readonly calls: DrawCall[] = [];
  readonly fonts: string[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {}

  private record(op: string, args: unknown[]): void {
    this.calls.push({
      op,
      args,
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      font: this.font,
    });
  }

  fillRect(...args: number[]): void {
    this.record("fillRect", args);
  }
  fillText(text: string, x: number, y: number): void {
    this.fonts.push(this.font);
    this.record("fillText", [text, x, y, this.textAlign, this.textBaseline]);
  }
  beginPath(): void {
    this.record("beginPath", []);
  }
  roundRect(...args: number[]): void {
    this.record("roundRect", args);
  }
  moveTo(...args: number[]): void {
    this.record("moveTo", args);
  }
  arcTo(...args: number[]): void {
    this.record("arcTo", args);
  }
  closePath(): void {
    this.record("closePath", []);
  }
  fill(): void {
    this.record("fill", []);
  }
  measureText(text: string): { width: number } {
    this.fonts.push(this.font);
    return { width: text.length * 10 };
  }
}

type ContextMode = "ok" | "null" | "no-round-rect";
type BlobMode = "png" | "null" | "throws";

let contexts: FakeContext[];
let contextMode: ContextMode;
let blobMode: BlobMode;
let toBlobType: string | undefined;
/** The canvas size at the moment `toBlob` was called (it is released right after). */
let toBlobSize: { width: number; height: number } | undefined;
let bodyStyle: HTMLStyleElement | undefined;

function setBodyFamily(family: string | null): void {
  bodyStyle?.remove();
  bodyStyle = undefined;
  if (family === null) {
    return;
  }
  bodyStyle = document.createElement("style");
  bodyStyle.textContent = `body { font-family: ${family}; }`;
  document.head.append(bodyStyle);
}

function stubFonts(load: (font: string) => Promise<unknown[]>): ReturnType<typeof vi.fn> {
  const spy = vi.fn(load);
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: spy } });
  return spy;
}

beforeEach(() => {
  contexts = [];
  contextMode = "ok";
  blobMode = "png";
  toBlobType = undefined;
  toBlobSize = undefined;
  setBodyFamily(FAMILY);
  stubFonts(async () => [{}]);

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    if (contextMode === "null") {
      return null;
    }
    const context = new FakeContext(this);
    if (contextMode === "no-round-rect") {
      Object.defineProperty(context, "roundRect", { value: undefined });
    }
    contexts.push(context);
    return context as unknown as CanvasRenderingContext2D;
  } as HTMLCanvasElement["getContext"]);

  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    toBlobType = type;
    toBlobSize = { width: this.width, height: this.height };
    if (blobMode === "throws") {
      throw new DOMException("The canvas has been tainted.", "SecurityError");
    }
    callback(blobMode === "null" ? null : new Blob(["png"], { type: "image/png" }));
  } as HTMLCanvasElement["toBlob"]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  setBodyFamily(null);
  Reflect.deleteProperty(document, "fonts");
});

function input(selectedIds: string[] = []): RenderWallpaperInput {
  return {
    day: FRIDAY,
    stages: STAGES,
    shows: FRIDAY_SHOWS,
    selectedIds: new Set(selectedIds),
  };
}

function onlyContext(): FakeContext {
  expect(contexts).toHaveLength(1);
  const context = contexts[0];
  if (!context) {
    throw new Error("no context");
  }
  return context;
}

describe("renderWallpaper", () => {
  it("test-render-wallpaper-png: un lienzo de 1290 × 2796, un rectángulo por show y un Blob PNG", async () => {
    const result = await renderWallpaper(input());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.blob.type).toBe("image/png");
    expect(result.fontFallback).toBe(false);
    expect(toBlobType).toBe("image/png");

    const context = onlyContext();
    expect(toBlobSize).toEqual({ width: WALLPAPER_WIDTH, height: WALLPAPER_HEIGHT });
    // Once encoded, the canvas is shrunk to 0 × 0 so WebKit frees its bitmap (R-03).
    expect(context.canvas.width).toBe(0);
    expect(context.canvas.height).toBe(0);

    // The whole canvas is painted BASE first.
    expect(context.calls[0]).toMatchObject({
      op: "fillRect",
      args: [0, 0, WALLPAPER_WIDTH, WALLPAPER_HEIGHT],
      fillStyle: BASE,
    });

    const blocks = context.calls.filter((call) => call.op === "roundRect");
    expect(blocks).toHaveLength(FRIDAY_SHOWS.length);
    for (const block of blocks) {
      expect(block.fillStyle).toBe(FOAM);
      expect(block.args[4]).toBe(12);
    }
    expect(context.calls.filter((call) => call.op === "fill")).toHaveLength(FRIDAY_SHOWS.length);

    // Hour lines: exactly one per hour mark of the layout, 1 px tall, HIGHLIGHT_MED, across the
    // stage columns, at the mark's y rounded to a whole pixel.
    const layout = wallpaperLayout({
      ...input(),
      fontFamily: FAMILY,
      measureText: (text) => text.length * 10,
    });
    expect(layout.hourMarks.length).toBeGreaterThan(0);
    const lines = context.calls.filter(
      (call) => call.op === "fillRect" && call.fillStyle === HIGHLIGHT_MED,
    );
    expect(lines.map((line) => line.args)).toEqual(
      layout.hourMarks.map((mark) => [GRID_LEFT, Math.round(mark.y), GRID_RIGHT - GRID_LEFT, 1]),
    );

    // Every text is anchored at its top-left corner, as the layout places it.
    const texts = context.calls.filter((call) => call.op === "fillText");
    expect(texts.map((call) => call.args[0])).toEqual(
      expect.arrayContaining(["Viernes", "Mi Grilla", "Flow", "Peggy Gou", "23:30 – 01:00"]),
    );
    for (const text of texts) {
      expect(text.args[3]).toBe("left");
      expect(text.args[4]).toBe("top");
    }
  });

  it("dibuja los bloques redondeados con un path si el contexto no tiene roundRect", async () => {
    contextMode = "no-round-rect";

    const result = await renderWallpaper(input());

    expect(result.ok).toBe(true);
    const context = onlyContext();
    expect(context.calls.filter((call) => call.op === "roundRect")).toHaveLength(0);
    expect(context.calls.filter((call) => call.op === "arcTo")).toHaveLength(
      FRIDAY_SHOWS.length * 4,
    );
    expect(context.calls.filter((call) => call.op === "fill")).toHaveLength(FRIDAY_SHOWS.length);
  });

  it("test-render-wallpaper-dimmed: los no elegidos con globalAlpha 0.3 y los elegidos con 1", async () => {
    const result = await renderWallpaper(input(["fri-samsung-2330"]));

    expect(result.ok).toBe(true);
    const context = onlyContext();
    const blocks = context.calls.filter((call) => call.op === "roundRect");
    expect(blocks).toHaveLength(FRIDAY_SHOWS.length);
    const lit = blocks.filter((call) => call.globalAlpha === 1);
    const dimmed = blocks.filter((call) => call.globalAlpha === DIMMED_OPACITY);
    expect(lit).toHaveLength(1);
    expect(dimmed).toHaveLength(FRIDAY_SHOWS.length - 1);

    // The text of a show shares its block's alpha, in BASE.
    const peggy = context.calls.find(
      (call) => call.op === "fillText" && call.args[0] === "Peggy Gou",
    );
    expect(peggy).toMatchObject({ globalAlpha: 1, fillStyle: BASE });
    const djo = context.calls.find((call) => call.op === "fillText" && call.args[0] === "DJO");
    expect(djo).toMatchObject({ globalAlpha: DIMMED_OPACITY, fillStyle: BASE });

    // The header is never dimmed.
    const title = context.calls.find(
      (call) => call.op === "fillText" && call.args[0] === "Viernes",
    );
    expect(title?.globalAlpha).toBe(1);
  });

  it("test-render-wallpaper-font-family: ctx.font usa la familia computada del body", async () => {
    const load = stubFonts(async () => [{}]);
    // The family lives in a stylesheet: reading the body's inline style would find nothing.
    expect(document.body.style.fontFamily).toBe("");

    await renderWallpaper(input());

    // The family as the browser resolves it (jsdom drops the quotes; a real browser keeps them).
    const computed = getComputedStyle(document.body).fontFamily;
    expect(computed).toContain("Public Sans");
    const context = onlyContext();
    expect(context.fonts.length).toBeGreaterThan(0);
    for (const used of context.fonts) {
      expect(used.endsWith(` ${computed}`)).toBe(true);
      expect(used).not.toContain("var(");
    }
    const requested = load.mock.calls.map(([requestedFont]) => String(requestedFont));
    expect(requested).toContain(`600 28px ${computed}`);
    expect(requested).toContain(`700 64px ${computed}`);
  });

  it("sin familia computada en el body dibuja con sans-serif", async () => {
    // jsdom resolves an unset family to its own default, so the empty value is stubbed.
    vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
      fontFamily: "  ",
    } as CSSStyleDeclaration);
    const load = stubFonts(async () => [{}]);

    const result = await renderWallpaper(input());

    expect(result.ok).toBe(true);
    const context = onlyContext();
    expect(context.fonts.length).toBeGreaterThan(0);
    for (const used of context.fonts) {
      expect(used.endsWith(" sans-serif")).toBe(true);
    }
    expect(load.mock.calls.map(([requestedFont]) => String(requestedFont))).toContain(
      "600 28px sans-serif",
    );
  });

  it("test-render-wallpaper-context-unsupported-error: getContext da null → CANVAS_UNSUPPORTED", async () => {
    contextMode = "null";

    await expect(renderWallpaper(input())).resolves.toEqual({
      ok: false,
      code: "CANVAS_UNSUPPORTED",
    });
  });

  it("test-render-wallpaper-encode-failed-error: toBlob con null o que lanza → ENCODE_FAILED", async () => {
    blobMode = "null";
    await expect(renderWallpaper(input())).resolves.toEqual({ ok: false, code: "ENCODE_FAILED" });

    blobMode = "throws";
    await expect(renderWallpaper(input())).resolves.toEqual({ ok: false, code: "ENCODE_FAILED" });

    // The bitmap is released on a failed encode too (R-03).
    expect(contexts).toHaveLength(2);
    for (const context of contexts) {
      expect(context.canvas.width).toBe(0);
      expect(context.canvas.height).toBe(0);
    }
  });

  it("test-render-wallpaper-font-missing: document.fonts.load rechazado → ok con fontFallback", async () => {
    stubFonts(() => Promise.reject(new Error("network")));

    const rejected = await renderWallpaper(input());
    expect(rejected).toMatchObject({ ok: true, fontFallback: true });

    // Resolving without any face is a miss too.
    stubFonts(async () => []);
    const empty = await renderWallpaper(input());
    expect(empty).toMatchObject({ ok: true, fontFallback: true });
  });

  it("sin document.fonts dibuja con el respaldo y fontFallback", async () => {
    Reflect.deleteProperty(document, "fonts");

    await expect(renderWallpaper(input())).resolves.toMatchObject({
      ok: true,
      fontFallback: true,
    });
  });

  it("test-render-wallpaper-font-timeout: document.fonts.load que no resuelve → a los 1500 ms sigue con el respaldo", async () => {
    vi.useFakeTimers();
    stubFonts(() => new Promise<unknown[]>(() => {}));

    let settled: Awaited<ReturnType<typeof renderWallpaper>> | undefined;
    void renderWallpaper(input()).then((result) => {
      settled = result;
    });

    await vi.advanceTimersByTimeAsync(1499);
    expect(settled).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toMatchObject({ ok: true, fontFallback: true });
  });
});
