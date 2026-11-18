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

    for (const delivery of ["share", "download"] as const) {
      expect(WALLPAPER_GUIDE_STEPS[delivery]).toHaveLength(4);
      for (const step of WALLPAPER_GUIDE_STEPS[delivery]) {
        expect(step.length).toBeGreaterThan(0);
      }
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

  it("test-wallpaper-guide-delivery: step 1 depends on how the image was saved, the other 3 are the same, and the perspective zoom step says where it is", () => {
    const { share, download } = WALLPAPER_GUIDE_STEPS;
    expect(share[0]).toBe("Abrí Fotos y buscá la imagen de Mi Grilla.");
    expect(download[0]).toBe(
      "La imagen quedó en Descargas (en el iPhone, en la app Archivos). Abrila, tocá Compartir y elegí «Guardar imagen» para pasarla a Fotos. Después abrila en Fotos.",
    );
    expect(download.slice(1)).toStrictEqual(share.slice(1));

    // The setting is named as iOS shows it, with the way to reach it.
    const zoom = share.filter((step) => step.includes("Zoom de perspectiva"));
    expect(zoom).toHaveLength(1);
    expect(zoom[0]).toContain("editor del fondo");
    expect(zoom[0]).toContain("«⋯»");
  });

  it("test-wallpaper-share-failed-fallback: SHARE_FAILED offers the download and long-pressing the preview", () => {
    expect(wallpaperMessageFor("SHARE_FAILED")).toBe(
      "No pudimos abrir la opción de guardar en Fotos. Descargá la imagen o mantené apretada la vista previa para guardarla en Fotos.",
    );
  });
});
