"use client";

import { Radio, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useAppNow } from "@/components/demo-clock";
import { LivePanel } from "@/components/live-panel";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { CLOSE_LABEL, LIVE_LABEL } from "@/lib/live-messages";
import { liveNow, type LiveView } from "@/lib/live-now";
import type { Schedule } from "@/lib/schedule-types";
import { cn } from "@/lib/utils";

export type LiveButtonProps = {
  /** The whole festival: "what comes next" can be on another day (FR-10). */
  schedule: Schedule;
  /** The selection on screen (`ScheduleScreen`'s draft, FR-09); unknown ids are ignored (R-01). */
  selectedIds: ReadonlySet<string>;
  /** No pending bar below: the button also clears the home indicator (mobile-native, fix 7). */
  clearHomeIndicator: boolean;
};

/**
 * The floating "En vivo" button and the sheet it opens (FEAT-005a). The button is 56 × 56
 * (`size-14`): `LIVE_BUTTON_CLEARANCE_PX` in `schedule-grid.tsx` is sized from it, so changing one
 * means changing the other. It is `absolute` in the grid's wrapper, not inside the grid's scroll
 * (it would scroll away) nor `fixed` (it would leave the `max-w-md` column).
 *
 * The sheet is Vaul's, as in `AppMenu`: it follows the finger, closes with a swipe down, a tap
 * outside or "Cerrar" (`data-vaul-no-drag`, so a tap never starts a drag), and `data-live-panel`
 * takes its animation down to 250 ms (rule in `globals.css`, NFR-01). The time is only read, and
 * the panel only computed, while it is open.
 */
export function LiveButton({ schedule, selectedIds, clearHomeIndicator }: LiveButtonProps) {
  const [open, setOpen] = useState(false);
  // Inside `/demo`, the time of its clock (FEAT-005b); anywhere else, the real time.
  const now = useAppNow(open);
  const current = useMemo(
    () => (open ? liveNow(schedule, now, selectedIds) : null),
    [open, schedule, now, selectedIds],
  );
  // Vaul keeps the sheet mounted while it slides down: it shows the last view it had, not an
  // empty body, without computing anything while closed. Adjusted while rendering (React's
  // pattern for state derived from other state).
  const [lastView, setLastView] = useState<LiveView | null>(null);
  if (current !== null && current !== lastView) {
    setLastView(current);
  }
  const view = current ?? lastView;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          size="icon"
          aria-label={LIVE_LABEL}
          className={cn(
            "absolute right-[max(1rem,env(safe-area-inset-right,0px))] z-20 size-14 touch-manipulation rounded-full shadow-lg shadow-rp-base/60 select-none",
            clearHomeIndicator ? "bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]" : "bottom-4",
          )}
        >
          <Radio className="size-6" />
        </Button>
      </DrawerTrigger>
      <DrawerContent data-live-panel aria-describedby={undefined}>
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
          <DrawerHeader className="flex-row items-center justify-between gap-3 px-5 pt-2 pb-2 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="text-xl">{LIVE_LABEL}</DrawerTitle>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={CLOSE_LABEL}
                data-vaul-no-drag
                className="-mr-2 size-11 touch-manipulation select-none"
              >
                <X className="size-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          {/* Five stages can be taller than 80dvh at 360 × 640: the body scrolls on its own and
              does not chain to the page (mobile-native, fix 6). */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
            {view ? <LivePanel view={view} /> : null}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
