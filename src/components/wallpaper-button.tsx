"use client";

import { ImageDown, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { renderWallpaper } from "@/components/wallpaper-canvas";
import {
  canShareFile,
  downloadWallpaper,
  shareWallpaper,
  wallpaperFile,
} from "@/components/wallpaper-delivery";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";
import { WALLPAPER_HEIGHT, WALLPAPER_WIDTH, wallpaperFileName } from "@/lib/wallpaper-layout";
import {
  DOWNLOAD_IMAGE_LABEL,
  GENERATING_LABEL,
  RETRY_LABEL,
  SAVE_TO_PHOTOS_LABEL,
  WALLPAPER_BUTTON_LABEL,
  WALLPAPER_DONE_LABEL,
  WALLPAPER_GUIDE_STEPS,
  WALLPAPER_SHEET_TITLE,
  type WallpaperDelivery,
  wallpaperMessageFor,
  wallpaperPreviewAlt,
} from "@/lib/wallpaper-messages";

type WallpaperButtonProps = {
  /** The day on screen. */
  day: FestivalDay;
  stages: readonly Stage[];
  /** The day's shows. */
  shows: readonly Show[];
  /** The selection on screen (`ScheduleScreen`'s draft); untrusted, filtered by the layout (R-01). */
  selectedIds: ReadonlySet<string>;
};

/** What the sheet draws: a copy taken when it opens, so a retry draws the same image. */
type Snapshot = WallpaperButtonProps;

/** The drawn image, with the name of the day it was drawn for (the alt of the preview). */
type Preview = { blob: Blob; url: string; file: File; dayName: string };

type SheetState =
  | { status: "idle" }
  | { status: "generating" }
  | {
      status: "ready";
      preview: Preview;
      /** "Guardar en Fotos" (system share sheet) or "Descargar imagen". */
      share: boolean;
      alert: string | null;
      /** The share sheet is open: one at a time. */
      busy: boolean;
    }
  | { status: "done"; preview: Preview; delivery: WallpaperDelivery }
  | { status: "failed"; code: string };

// `downloadWallpaper` has no code of its own: anything outside the catalog gets the generic text.
const DOWNLOAD_FAILED = "DOWNLOAD_FAILED";

// The preview and its placeholder share the height cap, so the buttons below do not jump when the
// image arrives.
const PREVIEW_MAX_HEIGHT = "max-h-[45dvh]";

/** Releases the preview's object URL, if there is one, and forgets it. */
function revokePreview(url: { current: string | null }): void {
  if (url.current !== null) {
    URL.revokeObjectURL(url.current);
    url.current = null;
  }
}

/**
 * "Descargar fondo", at the end of the days row: it opens a sheet that draws the day's wallpaper
 * with the selection on screen, previews it and hands it over — "Guardar en Fotos" through the share
 * sheet on a phone that can share the file, "Descargar imagen" anywhere else — and then shows how
 * to set it on the lock screen (FR-01, FR-09, FR-11, FR-12).
 *
 * Two taps on every device: opening draws the image and the second tap delivers it, so the share
 * sheet always runs inside a fresh tap (WebKit, R-05). One drawing at a time: a result that arrives
 * after its sheet was closed is dropped (R-03), and the preview's object URL is revoked when the
 * sheet closes or the screen goes away. It does not look at the connection: nothing here needs it
 * (FR-10). Only codes reach the screen, never the browser's error message (R-04).
 *
 * The sheet is Vaul's (gestures): it follows the finger and closes with a swipe down; the preview
 * and the buttons are `data-vaul-no-drag`, and the body scrolls inside it without dragging the
 * sheet or the page (mobile-native, fixes 3 and 6).
 */
export function WallpaperButton({ day, stages, shows, selectedIds }: WallpaperButtonProps) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>({ status: "idle" });
  const snapshot = useRef<Snapshot | null>(null);
  // Bumped on every drawing and every close: a result whose number is not the current one is late.
  const generation = useRef(0);
  // The only holder of the preview's object URL: every revoke goes through `revokePreview`.
  const previewUrl = useRef<string | null>(null);

  // Unmounted with the sheet open: the late result is dropped and the preview's URL released.
  useEffect(
    () => () => {
      generation.current += 1;
      revokePreview(previewUrl);
    },
    [],
  );

  async function generate(input: Snapshot) {
    generation.current += 1;
    const token = generation.current;
    revokePreview(previewUrl);
    setSheet({ status: "generating" });

    let result: Awaited<ReturnType<typeof renderWallpaper>>;
    try {
      result = await renderWallpaper(input);
    } catch {
      // A drawing that throws instead of answering a code is reported as one (R-04).
      result = { ok: false, code: "ENCODE_FAILED" };
    }
    if (token !== generation.current) {
      // The sheet was closed (or redrawn) meanwhile: this image is never shown.
      return;
    }
    if (!result.ok) {
      setSheet({ status: "failed", code: result.code });
      return;
    }
    const url = URL.createObjectURL(result.blob);
    previewUrl.current = url;
    const file = wallpaperFile(result.blob, wallpaperFileName(input.day));
    setSheet({
      status: "ready",
      preview: { blob: result.blob, url, file, dayName: input.day.name },
      share: canShareFile(file),
      alert: null,
      busy: false,
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // The sheet is modal: what is on screen now is what gets drawn, retries included.
      snapshot.current = { day, stages, shows: [...shows], selectedIds: new Set(selectedIds) };
      void generate(snapshot.current);
    } else {
      generation.current += 1;
      revokePreview(previewUrl);
      setSheet({ status: "idle" });
    }
  }

  async function share(state: Extract<SheetState, { status: "ready" }>) {
    const token = generation.current;
    setSheet({ ...state, alert: null, busy: true });
    // Called before any other await, still inside the tap (R-05).
    const result = await shareWallpaper(state.preview.file);
    if (token !== generation.current) {
      return;
    }
    if (result.ok) {
      setSheet({ status: "done", preview: state.preview, delivery: "share" });
    } else if (result.code === "SHARE_CANCELLED") {
      // The person closed the system sheet: nothing went wrong, the image is still here.
      setSheet({ ...state, alert: null, busy: false });
    } else {
      // The share sheet failed: the download is the way out, and the preview can be long-pressed.
      setSheet({ ...state, share: false, alert: wallpaperMessageFor(result.code), busy: false });
    }
  }

  function download(state: Extract<SheetState, { status: "ready" }>) {
    try {
      downloadWallpaper(state.preview.blob, state.preview.file.name);
    } catch {
      // Not swallowed: the generic message is shown and the sheet stays ready to try again.
      setSheet({ ...state, alert: wallpaperMessageFor(DOWNLOAD_FAILED) });
      return;
    }
    // The browser does not say when the file is written: the click is the end (FR-12).
    setSheet({ status: "done", preview: state.preview, delivery: "download" });
  }

  function deliver() {
    if (sheet.status !== "ready" || sheet.busy) {
      return;
    }
    if (sheet.share) {
      void share(sheet);
    } else {
      download(sheet);
    }
  }

  function retry() {
    if (snapshot.current) {
      void generate(snapshot.current);
    }
  }

  const preview = sheet.status === "ready" || sheet.status === "done" ? sheet.preview : null;
  const generating = sheet.status === "generating";
  const alert =
    sheet.status === "failed"
      ? wallpaperMessageFor(sheet.code)
      : sheet.status === "ready"
        ? sheet.alert
        : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={WALLPAPER_BUTTON_LABEL}
          className="touch-manipulation select-none"
        >
          <ImageDown className="size-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
          <DrawerHeader className="p-0 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="text-xl">{WALLPAPER_SHEET_TITLE}</DrawerTitle>
          </DrawerHeader>

          <div data-vaul-no-drag className="flex flex-col gap-4">
            <div
              aria-busy={generating}
              className="flex justify-center rounded-lg bg-background/60 p-3"
            >
              {preview ? (
                // No select-none nor callout block: long-pressing it to "Agregar a Fotos" is the
                // iPhone fallback (mobile-native, fix 8).
                // oxlint-disable-next-line nextjs/no-img-element -- a blob URL drawn in the browser: next/image has nothing to optimize
                <img
                  src={preview.url}
                  alt={wallpaperPreviewAlt(preview.dayName)}
                  width={WALLPAPER_WIDTH}
                  height={WALLPAPER_HEIGHT}
                  className={`h-auto ${PREVIEW_MAX_HEIGHT} w-auto max-w-full rounded-md object-contain`}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className={`aspect-[1290/2796] h-[45dvh] ${PREVIEW_MAX_HEIGHT} max-w-full rounded-md bg-muted`}
                />
              )}
            </div>

            {/* Only the status text: the buttons below change too, and are not read out with it. */}
            {/* Never hidden, even empty: a live region has to exist before what it announces. */}
            <div aria-live="polite" className="flex flex-col gap-2">
              {generating ? <p className="sr-only">{GENERATING_LABEL}</p> : null}
              {sheet.status === "done" ? (
                <p className="text-sm font-semibold text-foreground">{WALLPAPER_DONE_LABEL}</p>
              ) : null}
              {alert ? (
                <p role="alert" className="text-sm text-destructive">
                  {alert}
                </p>
              ) : null}
            </div>

            {sheet.status === "done" ? (
              <ol className="flex flex-col gap-3">
                {WALLPAPER_GUIDE_STEPS[sheet.delivery].map((step, index) => (
                  <li key={step} className="flex gap-3 rounded-lg bg-background/60 p-4">
                    <span
                      aria-hidden="true"
                      className="tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                    >
                      {index + 1}
                    </span>
                    <p className="text-sm text-foreground">{step}</p>
                  </li>
                ))}
              </ol>
            ) : null}

            <div className="flex flex-col">
              {generating ? (
                <Button type="button" size="lg" className="w-full select-none" disabled aria-busy>
                  <LoaderCircle
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {GENERATING_LABEL}
                </Button>
              ) : null}
              {sheet.status === "ready" ? (
                <Button
                  type="button"
                  size="lg"
                  className="w-full select-none"
                  disabled={sheet.busy}
                  onClick={deliver}
                >
                  {sheet.share ? SAVE_TO_PHOTOS_LABEL : DOWNLOAD_IMAGE_LABEL}
                </Button>
              ) : null}
              {sheet.status === "failed" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full select-none"
                  onClick={retry}
                >
                  {RETRY_LABEL}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
