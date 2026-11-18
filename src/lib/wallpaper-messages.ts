/**
 * The Spanish texts of the wallpaper sheet (FEAT-004): its buttons, the guide to set the image as
 * the lock screen, and the messages for the codes the canvas and the delivery return. Pure: no
 * I/O. The browser's own error message never reaches the screen, only these texts (R-04).
 */

export type WallpaperMessageCode = "CANVAS_UNSUPPORTED" | "ENCODE_FAILED" | "SHARE_FAILED";

/** The button on the days row that opens the sheet (FR-01). */
export const WALLPAPER_BUTTON_LABEL = "Descargar fondo";

/** The sheet's title. */
export const WALLPAPER_SHEET_TITLE = "Fondo de pantalla";

/** Delivery through the system share sheet, where the image can be saved to Photos (FR-11). */
export const SAVE_TO_PHOTOS_LABEL = "Guardar en Fotos";

/** Delivery as a downloaded `mi-grilla-<día>.png` file (FR-11). */
export const DOWNLOAD_IMAGE_LABEL = "Descargar imagen";

/** While the image is being drawn. */
export const GENERATING_LABEL = "Generando…";

/** Announced once the image is saved, right before the guide (FR-12). */
export const WALLPAPER_DONE_LABEL = "Listo. Así lo ponés de fondo:";

/** Draw the image again after a failure. */
export const RETRY_LABEL = "Reintentar";

/** The `alt` of the preview: "Vista previa del fondo del Viernes". */
export function wallpaperPreviewAlt(dayName: string): string {
  return `Vista previa del fondo del ${dayName}`;
}

/** How to set the image as the lock screen on an iPhone, shown once it is saved (FR-12). */
export const WALLPAPER_GUIDE_STEPS = [
  "Abrí Fotos y buscá la imagen de Mi Grilla.",
  "Tocá Compartir y elegí «Usar como fondo de pantalla».",
  "Desactivá el zoom de perspectiva y el efecto de profundidad, así la grilla no se corta ni se mueve.",
  "Tocá «Agregar» y usala en la pantalla de bloqueo.",
] as const;

const GENERIC_MESSAGE = "No pudimos preparar el fondo. Probá de nuevo.";

const CATALOG = {
  CANVAS_UNSUPPORTED:
    "Este navegador no puede dibujar la imagen. Probá desde Safari o Chrome actualizados.",
  ENCODE_FAILED: "No pudimos generar la imagen. Probá de nuevo.",
  SHARE_FAILED: "No pudimos abrir la opción de guardar en Fotos. Descargá la imagen.",
} as const satisfies Record<WallpaperMessageCode, string>;

// A Map, so `toString` or `__proto__` are not catalog entries.
const MESSAGES: ReadonlyMap<string, string> = new Map(Object.entries(CATALOG));

/** The catalog text for a code; anything outside the catalog gets a generic message. */
export function wallpaperMessageFor(code: string): string {
  return MESSAGES.get(code) ?? GENERIC_MESSAGE;
}
