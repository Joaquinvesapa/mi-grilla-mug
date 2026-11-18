import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canShareFile,
  downloadWallpaper,
  shareWallpaper,
  wallpaperFile,
} from "@/components/wallpaper-delivery";

// jsdom has no Web Share API, no matchMedia and no object URLs: each test stubs what it needs with
// vi.stubGlobal / Object.defineProperty, and afterEach takes everything back.

const NAME = "mi-grilla-viernes.png";

function png(): Blob {
  return new Blob(["png"], { type: "image/png" });
}

function stubPointer(coarse: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: coarse && query === "(pointer: coarse)",
    media: query,
  }));
}

function stubNavigator(key: "canShare" | "share", value: unknown): void {
  Object.defineProperty(navigator, key, { configurable: true, writable: true, value });
}

const URL_KEYS = ["createObjectURL", "revokeObjectURL"] as const;
const ORIGINAL_URL = new Map(
  URL_KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(URL, key)] as const),
);

function stubObjectUrls(): {
  createObjectURL: ReturnType<typeof vi.fn>;
  revokeObjectURL: ReturnType<typeof vi.fn>;
} {
  const createObjectURL = vi.fn(() => "blob:wallpaper");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "canShare");
  Reflect.deleteProperty(navigator, "share");
  // Put back whatever jsdom had (or nothing, if it had none), not an unconditional delete.
  for (const [key, descriptor] of ORIGINAL_URL) {
    if (descriptor) {
      Object.defineProperty(URL, key, descriptor);
    } else {
      Reflect.deleteProperty(URL, key);
    }
  }
});

describe("wallpaperFile", () => {
  it("arma un File PNG con el nombre del día", () => {
    const file = wallpaperFile(png(), NAME);
    expect(file.name).toBe(NAME);
    expect(file.type).toBe("image/png");
  });
});

describe("canShareFile", () => {
  it("test-delivery-can-share: true solo con canShare del archivo real y pointer: coarse", () => {
    const file = wallpaperFile(png(), NAME);
    const canShare = vi.fn((data?: ShareData) => data?.files?.[0] === file);
    stubNavigator("canShare", canShare);

    stubPointer(true);
    expect(canShareFile(file)).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [file] });

    // A desktop with file sharing (Safari on macOS) downloads instead.
    stubPointer(false);
    expect(canShareFile(file)).toBe(false);

    // A browser that cannot share this file.
    stubPointer(true);
    stubNavigator("canShare", () => false);
    expect(canShareFile(file)).toBe(false);

    // A browser without canShare at all.
    Reflect.deleteProperty(navigator, "canShare");
    expect(canShareFile(file)).toBe(false);
  });

  it("si canShare lanza no comparte", () => {
    stubPointer(true);
    stubNavigator("canShare", () => {
      throw new TypeError("Illegal invocation");
    });
    expect(canShareFile(wallpaperFile(png(), NAME))).toBe(false);
  });

  it("sin matchMedia no comparte", () => {
    stubNavigator("canShare", () => true);
    vi.stubGlobal("matchMedia", undefined);
    expect(canShareFile(wallpaperFile(png(), NAME))).toBe(false);
  });
});

describe("downloadWallpaper", () => {
  it("test-delivery-download-name: click en un <a download> y revoca el object URL", () => {
    vi.useFakeTimers();
    const blob = png();
    const { createObjectURL, revokeObjectURL } = stubObjectUrls();
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadWallpaper(blob, NAME);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe(NAME);
    expect(clicked[0]?.href).toBe("blob:wallpaper");
    // The link does not stay in the document.
    expect(document.querySelector("a[download]")).toBeNull();

    // Revoked on the next tick, once the browser has taken the click.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wallpaper");
  });

  it("revoca el object URL y saca el <a> aunque el click lance", () => {
    vi.useFakeTimers();
    const { revokeObjectURL } = stubObjectUrls();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click blocked");
    });

    expect(() => downloadWallpaper(png(), NAME)).toThrow("click blocked");
    expect(document.querySelector("a[download]")).toBeNull();

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wallpaper");
  });
});

describe("shareWallpaper", () => {
  it("comparte el archivo y resuelve ok", async () => {
    const file = wallpaperFile(png(), NAME);
    const share = vi.fn(async () => {});
    stubNavigator("share", share);

    await expect(shareWallpaper(file)).resolves.toEqual({ ok: true });
    expect(share).toHaveBeenCalledWith({ files: [file] });
  });

  it("test-delivery-share-cancelled: AbortError → SHARE_CANCELLED", async () => {
    stubNavigator("share", () => Promise.reject(new DOMException("Share canceled", "AbortError")));

    await expect(shareWallpaper(wallpaperFile(png(), NAME))).resolves.toEqual({
      ok: false,
      code: "SHARE_CANCELLED",
    });
  });

  it("test-delivery-share-failed-error: NotAllowedError o TypeError → SHARE_FAILED, sin el mensaje", async () => {
    const file = wallpaperFile(png(), NAME);

    stubNavigator("share", () =>
      Promise.reject(new DOMException("Must be handling a user gesture", "NotAllowedError")),
    );
    const notAllowed = await shareWallpaper(file);
    expect(notAllowed).toEqual({ ok: false, code: "SHARE_FAILED" });
    expect(JSON.stringify(notAllowed)).not.toContain("gesture");

    stubNavigator("share", () => Promise.reject(new TypeError("files not supported")));
    await expect(shareWallpaper(file)).resolves.toEqual({ ok: false, code: "SHARE_FAILED" });

    // No Web Share API at all.
    Reflect.deleteProperty(navigator, "share");
    await expect(shareWallpaper(file)).resolves.toEqual({ ok: false, code: "SHARE_FAILED" });
  });
});
