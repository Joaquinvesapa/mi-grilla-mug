"use client";

import { TriangleAlert } from "lucide-react";
import { type CSSProperties, useId } from "react";

import { usePressed } from "@/components/pressable";
import { formatClock } from "@/lib/festival-time";
import { blockGeometry, dayAxis, hourMarks, PX_PER_MINUTE } from "@/lib/schedule-layout";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";
import { cn } from "@/lib/utils";

export type ScheduleGridProps = {
  day: FestivalDay;
  stages: readonly Stage[];
  /** The shows of `day`. */
  shows: readonly Show[];
  /** The draft: what the person has chosen right now, saved or not. */
  selectedIds: ReadonlySet<string>;
  /** The shows whose choice differs from what is saved. */
  pendingIds: ReadonlySet<string>;
  /** Chosen shows that share at least one minute with another chosen one (FR-14). */
  clashIds: ReadonlySet<string>;
  onToggle: (showId: string) => void;
};

/** Width of the sticky hour column; the stage columns share the rest, 3 at a time (FR-06). */
const HOURS_WIDTH = "3rem";
const MINUTE_MS = 60_000;
/** Room under the last hour mark, so its label (drawn below the line) is not cut off. */
const AXIS_TAIL_PX = 16;

function timeRange(show: Show): string {
  return `${formatClock(new Date(show.startsAt))} – ${formatClock(new Date(show.endsAt))}`;
}

/**
 * The day as the poster draws it: stages in columns, hours in rows (FR-02, FR-03). The region is
 * the only thing that scrolls on the screen, on both axes and with the browser's own momentum
 * (gestures); the stage row stays on top and the hour column on the left (FR-07).
 */
export function ScheduleGrid({
  day,
  stages,
  shows,
  selectedIds,
  pendingIds,
  clashIds,
  onToggle,
}: ScheduleGridProps) {
  const columns = [...stages].sort((a, b) => a.position - b.position);
  const label = `Grilla del ${day.name}`;

  if (shows.length === 0) {
    return (
      <div role="region" aria-label={label} className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground">No hay shows este día.</p>
      </div>
    );
  }

  const axis = dayAxis(shows);
  const marks = hourMarks(axis);
  const bodyHeight = ((axis.end.getTime() - axis.start.getTime()) / MINUTE_MS) * PX_PER_MINUTE;
  const offsetOf = (mark: Date) =>
    ((mark.getTime() - axis.start.getTime()) / MINUTE_MS) * PX_PER_MINUTE;

  // Percentages here are of the scroll container's width: each stage column measures a third of
  // what the hour column leaves, so exactly 3 fit on a 360–430 px phone and the rest scroll in.
  const track: CSSProperties = {
    width: `calc(${HOURS_WIDTH} + (100% - ${HOURS_WIDTH}) / 3 * ${columns.length})`,
    gridTemplateColumns: `${HOURS_WIDTH} repeat(${columns.length}, minmax(0, 1fr))`,
  };

  return (
    <div role="region" aria-label={label} className="schedule-scroll relative min-h-0 flex-1">
      <div className="grid" style={track}>
        {/* The corner stays over both sticky edges. */}
        <div className="sticky top-0 left-0 z-30 bg-background" />
        {columns.map((stage) => (
          <div
            key={stage.id}
            data-stage-header
            className="sticky top-0 z-20 flex h-10 items-center justify-center truncate border-b border-border bg-background px-1 text-[13px] font-semibold"
          >
            {stage.name}
          </div>
        ))}

        <div
          aria-hidden="true"
          className="sticky left-0 z-10 bg-background"
          style={{ height: bodyHeight + AXIS_TAIL_PX }}
        >
          {marks.map((mark) => (
            <span
              key={mark.getTime()}
              data-hour-mark
              className="tabular absolute right-1.5 left-0 text-right text-[12px] leading-none text-muted-foreground"
              style={{ top: offsetOf(mark) + 2 }}
            >
              {formatClock(mark)}
            </span>
          ))}
        </div>

        {columns.map((stage) => (
          <div
            key={stage.id}
            data-stage-column={stage.id}
            className="relative border-l border-border/40"
            style={{ height: bodyHeight + AXIS_TAIL_PX }}
          >
            {marks.map((mark) => (
              <div
                key={mark.getTime()}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-border/40"
                style={{ top: offsetOf(mark) }}
              />
            ))}
            {shows
              .filter((show) => show.stageId === stage.id)
              .map((show) => (
                <ShowBlock
                  key={show.id}
                  show={show}
                  geometry={blockGeometry(show, axis)}
                  selected={selectedIds.has(show.id)}
                  pending={pendingIds.has(show.id)}
                  clash={clashIds.has(show.id)}
                  onToggle={onToggle}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type ShowBlockProps = {
  show: Show;
  geometry: { top: number; height: number };
  selected: boolean;
  pending: boolean;
  clash: boolean;
  onToggle: (showId: string) => void;
};

function ShowBlock({ show, geometry, selected, pending, clash, onToggle }: ShowBlockProps) {
  const pressed = usePressed<HTMLButtonElement>();
  const clashId = useId();
  const pendingId = useId();
  // The marks describe the block; its name stays "Artista … horario", so a screen reader announces
  // the show first and no block answers to the names of other buttons ("Guardar").
  const describedBy = [clash ? clashId : null, pending ? pendingId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      data-show-id={show.id}
      data-pending={pending ? "true" : undefined}
      aria-pressed={selected}
      aria-describedby={describedBy || undefined}
      onClick={() => onToggle(show.id)}
      // Geometry straight from blockGeometry: the height is the duration at scale (FR-03), never
      // under 44 px (NFR-03). The 2 px inset only narrows it.
      style={{ top: geometry.top, height: geometry.height }}
      className={cn(
        "absolute inset-x-0.5 flex flex-col items-start gap-0.5 overflow-hidden rounded-md border px-1.5 py-1 text-left transition-[background-color,border-color,transform] duration-100 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[pressed=true]:scale-[0.97]",
        selected
          ? "border-background bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent/40 data-[pressed=true]:bg-accent/60",
      )}
      {...pressed}
    >
      <span className="flex w-full items-start gap-1">
        <span className="min-w-0 flex-1 text-[13px] leading-tight font-semibold [overflow-wrap:anywhere]">
          {show.artist}
        </span>
        {clash ? (
          <span
            className={cn(
              "shrink-0 rounded-sm",
              selected ? "bg-background px-0.5 text-warning" : "text-warning",
            )}
          >
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            <span id={clashId} hidden>
              Choca con otro show elegido
            </span>
          </span>
        ) : null}
      </span>
      {/* Whitespace between the parts: a flex container does not draw it, but it keeps the
          words apart in the accessible name ("DJO 18:00 – 19:00"). */}{" "}
      {show.subtitle ? (
        <span className="w-full text-[12px] leading-tight [overflow-wrap:anywhere] opacity-80">
          {show.subtitle}
        </span>
      ) : null}{" "}
      <span className="tabular text-[12px] leading-tight opacity-80">{timeRange(show)}</span>
      {pending ? (
        <span className="absolute right-1 bottom-1 flex items-center">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
          <span id={pendingId} hidden>
            Sin guardar
          </span>
        </span>
      ) : null}
    </button>
  );
}
