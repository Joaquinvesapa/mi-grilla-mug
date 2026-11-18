"use client";

import { ImageDown, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { GroupPicker } from "@/components/group-picker";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { renderWallpaper, type RenderWallpaperInput } from "@/components/wallpaper-canvas";
import {
  canShareFile,
  downloadWallpaper,
  shareWallpaper,
  wallpaperFile,
} from "@/components/wallpaper-delivery";
import { type GroupPicks, picksByShow, wallpaperGroupDefault } from "@/lib/group-picks";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";
import { WALLPAPER_HEIGHT, WALLPAPER_WIDTH, wallpaperFileName } from "@/lib/wallpaper-layout";
import {
  DOWNLOAD_IMAGE_LABEL,
  GENERATING_LABEL,
  PERSONAL_OPTION_LABEL,
  RETRY_LABEL,
  SAVE_TO_PHOTOS_LABEL,
  WALLPAPER_BUTTON_LABEL,
  WALLPAPER_CHOICE_LABEL,
  WALLPAPER_DONE_LABEL,
  WALLPAPER_GROUP_LABEL,
  WALLPAPER_GUIDE_STEPS,
  WALLPAPER_SHEET_TITLE,
  WITH_FRIENDS_OPTION_LABEL,
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
  /**
   * The user's groups with their friends' saved picks, the most recent first (FEAT-007): the
   * page's, or the device copy's without signal. `null` when the page could not load them.
   */
  groups: readonly GroupPicks[] | null;
  /** The grid picker's group: `null` for "Sin grupo", `undefined` without groups. */
  groupId: string | null | undefined;
};

/** What the sheet draws: a copy taken when it opens, so a retry or a group change draws the same. */
type Snapshot = Omit<WallpaperButtonProps, "groups"> & { groups: readonly GroupPicks[] };

/** "Grilla sola" or "Con amigos" (FEAT-007, FR-01). */
type WallpaperOption = "personal" | "group";

/** The drawn image, with the day and the group it was drawn for (the alt of the preview). */
type Preview = { blob: Blob; url: string; file: File; dayName: string; groupName: string | null };

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

// The two options: no tap delay nor text selection (mobile-native, fixes 1, 2 and 5), refused while
// drawing without losing the focus (`aria-disabled`), and a ring on the one pressed.
const OPTION_CLASS =
  "w-full touch-manipulation select-none aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-ring aria-pressed:ring-offset-2 aria-pressed:ring-offset-background";

// The primary action's box (FEAT-007, the user's decision): `sticky bottom-0` inside the body that
// scrolls, on the drawer's own surface and bled to the body's edges (`-mx-5 px-5`), with the
// bottom padding the body no longer has. The safe area is the drawer's, not padded again here.
const ACTION_BOX_CLASS = "sticky bottom-0 z-10 -mx-5 flex flex-col bg-card px-5 pt-2 pb-6";

/** What `renderWallpaper` gets for `option`: the group only with "Con amigos" and a known id. */
function drawingOf(
  input: Snapshot,
  option: WallpaperOption,
  groupId: string | undefined,
): { drawing: RenderWallpaperInput; group: GroupPicks | undefined } {
  const base = {
    day: input.day,
    stages: input.stages,
    shows: input.shows,
    selectedIds: input.selectedIds,
  };
  const group = option === "group" ? input.groups.find((item) => item.id === groupId) : undefined;
  if (!group) {
    return { drawing: base, group: undefined };
  }
  return {
    drawing: { ...base, group: { name: group.name, friendsByShow: picksByShow(group) } },
    group,
  };
}

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
 *
 * In a group (FEAT-007), the sheet opens with "Grilla sola" chosen and drawn (color-en-vivo, S7),
 * exactly as without groups; both options stay on screen, the chosen one filled, so "Con amigos"
 * is a tap away and switching redraws. "Con amigos"
 * starts with the grid picker's group (or the most recent one, `wallpaperGroupDefault`, FR-02) and,
 * with two or more groups, a select changes it. Without groups — or when the page could not load
 * them — it draws the personal one on opening, as before (FR-03).
 */
export function WallpaperButton({
  day,
  stages,
  shows,
  selectedIds,
  groups,
  groupId,
}: WallpaperButtonProps) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>({ status: "idle" });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // The option pressed in the sheet (`null` until one is) and the group chosen in it: the sheet's
  // own, apart from the grid picker's `groupId` of the copy.
  const [option, setOption] = useState<WallpaperOption | null>(null);
  const [sheetGroupId, setSheetGroupId] = useState<string | undefined>(undefined);
  const questionId = useId();
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

  async function generate(input: Snapshot, chosen: WallpaperOption, chosenGroupId?: string) {
    generation.current += 1;
    const token = generation.current;
    revokePreview(previewUrl);
    setSheet({ status: "generating" });
    const { drawing, group } = drawingOf(input, chosen, chosenGroupId);

    let result: Awaited<ReturnType<typeof renderWallpaper>>;
    try {
      result = await renderWallpaper(drawing);
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
    const file = wallpaperFile(result.blob, wallpaperFileName(input.day, group?.name));
    setSheet({
      status: "ready",
      preview: {
        blob: result.blob,
        url,
        file,
        dayName: input.day.name,
        groupName: group?.name ?? null,
      },
      share: canShareFile(file),
      alert: null,
      busy: false,
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // The sheet is modal: what is on screen now is what gets drawn, retries and group changes
      // included — the draft with its unsaved marks, and the friends' saved picks (FR-11).
      const copy: Snapshot = {
        day,
        stages,
        shows: [...shows],
        selectedIds: new Set(selectedIds),
        groups: [...(groups ?? [])],
        groupId,
      };
      setSnapshot(copy);
      setSheetGroupId(wallpaperGroupDefault(copy.groups, copy.groupId));
      // Always "Grilla sola" first, with or without groups (FR-03; color-en-vivo, S7): drawn on
      // opening, so the preview is never an empty placeholder. "Con amigos" is a tap away.
      setOption("personal");
      void generate(copy, "personal");
    } else {
      generation.current += 1;
      revokePreview(previewUrl);
      setOption(null);
      setSheet({ status: "idle" });
    }
  }

  /** "Grilla sola" or "Con amigos": draws it, and switching redraws without closing the sheet. */
  function pick(next: WallpaperOption) {
    if (!snapshot || sheet.status === "generating") {
      return;
    }
    if (next === option && (sheet.status === "ready" || sheet.status === "done")) {
      // Already on screen.
      return;
    }
    setOption(next);
    void generate(snapshot, next, sheetGroupId);
  }

  /** The sheet's group select: only a group of the copy, and only a different one, redraws (R-05). */
  function pickGroup(next: string | null) {
    if (!snapshot || sheet.status === "generating" || option !== "group") {
      return;
    }
    if (next === null || next === sheetGroupId || !snapshot.groups.some((g) => g.id === next)) {
      return;
    }
    setSheetGroupId(next);
    void generate(snapshot, "group", next);
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
    // The same copy, the same option and the same group as the drawing that failed.
    if (snapshot && option) {
      void generate(snapshot, option, sheetGroupId);
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
        {/* No bottom padding here: the action's box below carries it, and the drawer pads the
            home indicator under both (mobile-native, fix 7). */}
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-2">
          <DrawerHeader className="p-0 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="text-xl">{WALLPAPER_SHEET_TITLE}</DrawerTitle>
          </DrawerHeader>

          <div data-vaul-no-drag className="flex flex-col gap-4">
            {snapshot && snapshot.groups.length > 0 ? (
              // Always on screen above the preview, never unmounted: switching keeps the focus.
              <div role="group" aria-labelledby={questionId} className="flex flex-col gap-2">
                <p id={questionId} className="text-sm font-medium text-muted-foreground">
                  {WALLPAPER_CHOICE_LABEL}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={option === "personal" ? "default" : "outline"}
                    size="lg"
                    aria-pressed={option === "personal"}
                    aria-disabled={generating || undefined}
                    className={OPTION_CLASS}
                    onClick={() => pick("personal")}
                  >
                    {PERSONAL_OPTION_LABEL}
                  </Button>
                  <Button
                    type="button"
                    variant={option === "group" ? "default" : "outline"}
                    size="lg"
                    aria-pressed={option === "group"}
                    aria-disabled={generating || undefined}
                    className={OPTION_CLASS}
                    onClick={() => pick("group")}
                  >
                    {WITH_FRIENDS_OPTION_LABEL}
                  </Button>
                </div>
                {option === "group" && snapshot.groups.length > 1 && sheetGroupId !== undefined ? (
                  // Without "Sin grupo": the wallpaper of a group always has one (AC-03: a single
                  // group needs no select).
                  <GroupPicker
                    groups={snapshot.groups}
                    value={sheetGroupId}
                    onChange={pickGroup}
                    withNoGroup={false}
                    label={WALLPAPER_GROUP_LABEL}
                    disabled={generating}
                  />
                ) : null}
              </div>
            ) : null}

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
                  alt={wallpaperPreviewAlt(preview.dayName, preview.groupName)}
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

            {/* Stuck to the bottom of the scrolling body, opaque as the drawer, always mounted: the
                question, the select and the preview scroll above it, so the action is always on
                screen — with a group too — and swapping its button never moves anything. */}
            <div className={ACTION_BOX_CLASS}>
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
