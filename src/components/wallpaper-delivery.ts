// Hands the wallpaper over to the person (FEAT-004, ADR-005): the system share sheet on a touch
// device that can share the file (on an iPhone, "Save Image" puts it in Photos), a plain download
// everywhere else. No "use client" of its own: only `wallpaper-button.tsx` imports it. The browser's
// error message never leaves this file: callers get a code (R-04).

export type ShareWallpaperResult =
  | { ok: true }
  | { ok: false; code: "SHARE_CANCELLED" | "SHARE_FAILED" };

const PNG = "image/png";

/** The PNG as a `File` named `name` (always `wallpaperFileName(day)`, never text from the person). */
export function wallpaperFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: PNG });
}

/**
 * Whether to offer the share sheet: the browser must accept this very file and the device must be
 * touch-first. A desktop that can share files (Safari on macOS) downloads instead (AC-02).
 */
export function canShareFile(file: File): boolean {
  if (typeof navigator.canShare !== "function" || typeof globalThis.matchMedia !== "function") {
    return false;
  }
  let canShare: boolean;
  try {
    canShare = navigator.canShare({ files: [file] });
  } catch {
    // Some browsers throw instead of answering false (a file type or a context they reject). Not
    // being able to ask means not sharing: the caller downloads instead.
    return false;
  }
  return canShare && globalThis.matchMedia("(pointer: coarse)").matches;
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

/** Opens the system share sheet with the file. Must run inside a fresh tap (WebKit, R-05). */
export async function shareWallpaper(file: File): Promise<ShareWallpaperResult> {
  try {
    await navigator.share({ files: [file] });
    return { ok: true };
  } catch (error) {
    // AbortError: the person closed the sheet. Anything else (NotAllowedError, TypeError, no Web
    // Share API) is a failure; only the code goes out.
    return { ok: false, code: isAbort(error) ? "SHARE_CANCELLED" : "SHARE_FAILED" };
  }
}

/**
 * Downloads the PNG as `name` through a temporary `<a download>`; the URL is revoked next tick. If
 * appending or clicking throws, the error reaches the caller, and the link and the URL are still
 * cleaned up.
 */
export function downloadWallpaper(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // The browser has taken the click by the next tick; revoking sooner can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
