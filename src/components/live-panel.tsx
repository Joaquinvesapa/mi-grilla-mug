// No "use client" of its own: no hooks, and it only renders inside LiveButton, a client component.
import { Check } from "lucide-react";

import { formatClock } from "@/lib/festival-time";
import {
  DONE_FOR_TODAY,
  FESTIVAL_OVER,
  minutesUntilLabel,
  NEXT_PREFIX,
  NO_LIVE_SHOWS,
  NOTHING_NOW,
  NOW_PREFIX,
  nextShowLabel,
  SELECTED_LABEL,
} from "@/lib/live-messages";
import type { LiveStage, LiveView } from "@/lib/live-now";
import type { Show } from "@/lib/schedule-types";

function clockOf(instant: string): string {
  return formatClock(new Date(instant));
}

/** The mark of a chosen show (FR-08): foam, as a chosen block in the grid, with a hidden name. */
function SelectedMark() {
  return (
    <>
      {" "}
      <Check aria-hidden="true" className="inline size-4 align-[-0.15em] text-primary" />
      <span className="sr-only">{SELECTED_LABEL}</span>
    </>
  );
}

/** What plays now on a stage: the artist and its time range, or "Nada ahora" (FR-03). */
function NowLine({ show, selected }: { show: Show | null; selected: boolean }) {
  return (
    <p data-live-now className="min-w-0 text-sm [overflow-wrap:anywhere]">
      <span className="text-muted-foreground">{NOW_PREFIX}</span>{" "}
      {show ? (
        <>
          <span className="font-medium">{show.artist}</span>{" "}
          <span className="tabular text-muted-foreground">
            {clockOf(show.startsAt)} – {clockOf(show.endsAt)}
          </span>
          {selected ? <SelectedMark /> : null}
        </>
      ) : (
        <span className="text-muted-foreground">{NOTHING_NOW}</span>
      )}
    </p>
  );
}

/** What comes next on a stage: artist, start and minutes left, or "Terminó por hoy" (FR-04). */
function NextLine({ next, selected }: { next: LiveStage["next"]; selected: boolean }) {
  return (
    <p data-live-next className="min-w-0 text-sm [overflow-wrap:anywhere]">
      <span className="text-muted-foreground">{NEXT_PREFIX}</span>{" "}
      {next ? (
        <>
          <span className="font-medium">{next.show.artist}</span>{" "}
          <span className="tabular text-muted-foreground">
            {clockOf(next.show.startsAt)} ({minutesUntilLabel(next.minutesUntil)})
          </span>
          {selected ? <SelectedMark /> : null}
        </>
      ) : (
        <span className="text-muted-foreground">{DONE_FOR_TODAY}</span>
      )}
    </p>
  );
}

/**
 * The content of the "En vivo" panel for a `LiveView`: one row per stage while shows play, in the
 * order `liveNow` gives (chosen ones first, FR-07); otherwise when the next show is (FR-10) or that
 * the festival is over (FR-11). Every text is a React child, never HTML (R-06), and wraps instead
 * of scrolling sideways (NFR-04). No `aria-live`: a minute-by-minute announcement would be noise.
 */
export function LivePanel({ view }: { view: LiveView }) {
  if (view.kind === "over") {
    return <p className="py-2 text-base font-medium">{FESTIVAL_OVER}</p>;
  }

  if (view.kind === "idle") {
    return (
      <div className="flex min-w-0 flex-col gap-1 py-2">
        <p className="text-base font-medium">{NO_LIVE_SHOWS}</p>
        <p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">
          {nextShowLabel(view.next)}
        </p>
      </div>
    );
  }

  return (
    <ul className="flex min-w-0 flex-col divide-y divide-border">
      {view.stages.map((row) => (
        <li
          key={row.stage.id}
          data-live-stage={row.stage.id}
          className="flex min-w-0 flex-col gap-1 py-3 first:pt-0 last:pb-0"
        >
          <h3 className="text-base font-semibold">{row.stage.name}</h3>
          <NowLine show={row.current} selected={row.currentSelected} />
          <NextLine next={row.next} selected={row.nextSelected} />
        </li>
      ))}
    </ul>
  );
}
