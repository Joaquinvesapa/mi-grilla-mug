// No "use client" of its own: no hooks, and it only renders inside LiveButton, a client component.
import { Check, TriangleAlert } from "lucide-react";

import { LiveDot } from "@/components/live-dot";
import { formatClock } from "@/lib/festival-time";
import {
  CLASH_LABEL,
  DONE_FOR_TODAY,
  FESTIVAL_OVER,
  minutesLeftLabel,
  minutesUntilLabel,
  NEXT_PREFIX,
  NO_LIVE_SHOWS,
  NOTHING_NOW,
  NOW_LABEL,
  nextShowLabel,
  PROGRESS_LABEL,
  SELECTED_LABEL,
} from "@/lib/live-messages";
import type { LiveStage, LiveView } from "@/lib/live-now";
import type { Show } from "@/lib/schedule-types";
import { stageStyle } from "@/lib/stage-colors";
import { cn } from "@/lib/utils";

function clockOf(instant: string): string {
  return formatClock(new Date(instant));
}

/** The mark of a chosen show next to the next show's name (FR-08): foam check, hidden name. */
function SelectedMark() {
  return (
    <>
      {" "}
      <Check aria-hidden="true" className="inline size-4 align-[-0.15em] text-primary" />
      <span className="sr-only">{SELECTED_LABEL}</span>
    </>
  );
}

/**
 * «Ahora» with the live dot, and the marks of a chosen show: check + «Elegido» (the text stays
 * for screen readers and the sighted alike) and, on a clash, a text-colored triangle + «Choque»:
 * the status is never only a color (S6).
 */
function PlayingStatus({ selected, clash }: { selected: boolean; clash: boolean }) {
  return (
    <span data-live-status className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold">
      <span className="flex items-center gap-1.5 text-foreground">
        <LiveDot />
        {NOW_LABEL}
      </span>{" "}
      {selected ? (
        <span className="ml-auto flex items-center gap-2 text-[11px] font-semibold">
          <span className="flex items-center gap-1 text-foreground">
            <Check aria-hidden="true" className="size-3.5 text-primary" />
            {SELECTED_LABEL}
          </span>{" "}
          {clash ? (
            <span className="flex items-center gap-1 text-foreground">
              <TriangleAlert aria-hidden="true" className="size-3.5 text-foreground" />
              {CLASH_LABEL}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** What plays now on a stage: the artist, its time range, what is left and the progress (FR-03). */
function NowBlock({ row, show }: { row: LiveStage; show: Show }) {
  const progress = row.currentProgress;
  return (
    <div data-live-now className="mt-1.5 min-w-0 [overflow-wrap:anywhere]">
      <p className="text-[17px] leading-tight font-bold">{show.artist}</p>{" "}
      <p className="tabular mt-1 text-[13px] text-muted-foreground">
        {clockOf(show.startsAt)} – {clockOf(show.endsAt)}
        {progress ? <> · {minutesLeftLabel(progress.minutesLeft)}</> : null}
      </p>
      {progress ? (
        <div
          role="progressbar"
          aria-label={PROGRESS_LABEL}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          className="mt-2 h-[5px] overflow-hidden rounded-[3px] bg-rp-highlight-med"
        >
          <div
            className="h-full rounded-[3px] bg-rp-love"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** What comes next on a stage: artist, start and minutes left, or "Terminó por hoy" (FR-04). */
function NextLine({ next, selected }: { next: LiveStage["next"]; selected: boolean }) {
  return (
    <p data-live-next className="mt-1.5 min-w-0 text-[13px] [overflow-wrap:anywhere]">
      <span className="text-muted-foreground">{NEXT_PREFIX}</span>{" "}
      {next ? (
        <>
          <span className="font-semibold">{next.show.artist}</span>{" "}
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
 * One stage: an overlay card with a 4 px bar and a chip in the stage's color. Playing: full
 * opacity, «Ahora» with the live dot, the artist and the progress. Not playing: dimmed and with no
 * live dot (S5); the bar and the chip are softer, the texts at 60 %.
 */
function StageRow({ row }: { row: LiveStage }) {
  const playing = row.current !== null;
  return (
    <li
      data-live-stage={row.stage.id}
      data-playing={playing ? "true" : "false"}
      style={stageStyle(row.stage.id)}
      className="relative min-w-0 overflow-hidden rounded-2xl bg-rp-overlay py-3 pr-3.5 pl-[18px]"
    >
      <span
        aria-hidden="true"
        data-live-bar
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          playing
            ? "bg-(--stage)"
            : "bg-[color-mix(in_srgb,var(--stage)_45%,var(--color-rp-overlay))]",
        )}
      />
      <div className="flex min-h-6 items-center gap-2">
        <h3
          data-live-chip
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs leading-[18px] font-bold text-(--on-stage)",
            playing
              ? "bg-(--stage)"
              : "bg-[color-mix(in_srgb,var(--stage)_68%,var(--color-rp-overlay))]",
          )}
        >
          {row.stage.name}
        </h3>
        {playing ? <PlayingStatus selected={row.currentSelected} clash={row.currentClash} /> : null}
      </div>
      <div className={cn(!playing && "opacity-60")}>
        {row.current ? (
          <NowBlock row={row} show={row.current} />
        ) : (
          <p
            data-live-now
            className="mt-1.5 min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]"
          >
            {NOTHING_NOW}
          </p>
        )}
        <NextLine next={row.next} selected={row.nextSelected} />
      </div>
    </li>
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
    <ul className="flex min-w-0 flex-col gap-2">
      {view.stages.map((row) => (
        <StageRow key={row.stage.id} row={row} />
      ))}
    </ul>
  );
}
