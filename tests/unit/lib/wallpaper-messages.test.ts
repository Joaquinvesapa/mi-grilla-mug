import { describe, expect, it } from "vitest";

import {
  DOWNLOAD_IMAGE_LABEL,
  GENERATING_LABEL,
  RETRY_LABEL,
  SAVE_TO_PHOTOS_LABEL,
  WALLPAPER_BUTTON_LABEL,
  WALLPAPER_DONE_LABEL,
  WALLPAPER_GUIDE_STEPS,
  WALLPAPER_SHEET_TITLE,
  type WallpaperMessageCode,
  wallpaperMessageFor,
  wallpaperPreviewAlt,
} from "@/lib/wallpaper-messages";

const CODES: WallpaperMessageCode[] = ["CANVAS_UNSUPPORTED", "ENCODE_FAILED", "SHARE_FAILED"];

describe("wallpaper-messages", () => {
  it("test-wallpaper-messages-unknown-code: an unknown (invalid) code gets the generic message, and the guide has 4 steps", () => {
    const generic = wallpaperMessageFor("NOPE");
    expect(generic.length).toBeGreaterThan(0);
    for (const unknown of ["", "toString", "__proto__", "SHARE_CANCELLED", "NotAllowedError"]) {
      expect(wallpaperMessageFor(unknown)).toBe(generic);
    }

    // Every known code has its own text, different from the generic one and from each other.
    const known = CODES.map((code) => wallpaperMessageFor(code));
    for (const text of known) {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toBe(generic);
    }
    expect(new Set(known).size).toBe(CODES.length);

    expect(WALLPAPER_GUIDE_STEPS).toHaveLength(4);
    for (const step of WALLPAPER_GUIDE_STEPS) {
      expect(step.length).toBeGreaterThan(0);
    }

    expect(WALLPAPER_BUTTON_LABEL).toBe("Descargar fondo");
    expect(SAVE_TO_PHOTOS_LABEL).toBe("Guardar en Fotos");
    expect(DOWNLOAD_IMAGE_LABEL).toBe("Descargar imagen");
    expect(GENERATING_LABEL).toBe("Generando…");
    expect(WALLPAPER_SHEET_TITLE).toBe("Fondo de pantalla");
    expect(RETRY_LABEL).toBe("Reintentar");
    expect(WALLPAPER_DONE_LABEL).toBe("Listo. Así lo ponés de fondo:");
    expect(wallpaperPreviewAlt("Viernes")).toBe("Vista previa del fondo del Viernes");
  });
});
