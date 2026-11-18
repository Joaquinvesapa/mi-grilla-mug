"use client";

import { TriangleAlert } from "lucide-react";
import { type CSSProperties, useId } from "react";

import { usePressed } from "@/components/pressable";
import { formatClock } from "@/lib/festival-time";
import { extraFriendsLabel, friendsPickedLabel } from "@/lib/group-messages";
import { type FriendPicks, indicatorParts } from "@/lib/group-picks";
import {
  blockGeometry,
  type DayAxis,
  dayAxis,
  heightWithFriends,
  hourMarks,
  NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS,
  PX_PER_MINUTE,
} from "@/lib/schedule-layout";
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
  /** For each show, the friends of the chosen group who picked it; empty with no group (FR-02). */
  friendPicks: ReadonlyMap<string, FriendPicks[]>;
  onToggle: (showId: string) => void;
};

/** Width of the sticky hour column; the stage columns share the rest, 3 at a time (FR-06). */
const HOURS_WIDTH = "3rem";
const MINUTE_MS = 60_000;
/** Room under the last hour mark, so its label (drawn below the line) is not cut off. */
const AXIS_TAIL_PX = 16;
/**
 * Room at the end of every column for the floating "En vivo" button, so any show can be scrolled
 * out from under it (FR-16): the button's 56 px (`size-14` in `live-button.tsx`) + its 16 px
 * bottom margin + 8 px. Tied to that size: changing the button means changing this.
 */
export const LIVE_BUTTON_CLEARANCE_PX = 80;

/** Where the next show of the same stage starts, by show id; the last one of a stage has none. */
function nextTops(shows: readonly Show[], axis: DayAxis): Map<string, number> {
  const byStart = [...shows].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const next = new Map<string, number>();
  for (const [index, show] of byStart.entries()) {
    const start = Date.parse(show.startsAt);
    const following = byStart
      .slice(index + 1)
      .find((other) => other.stageId === show.stageId && Date.parse(other.startsAt) > start);
    if (following) {
      next.set(show.id, blockGeometry(following, axis).top);
    }
  }
  return next;
}

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
  friendPicks,
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
  const nextTopOf = nextTops(shows, axis);
  const bodyHeight = ((axis.end.getTime() - axis.start.getTime()) / MINUTE_MS) * PX_PER_MINUTE;
  // The blocks keep their geometry: only the columns grow, below the last hour mark.
  const columnHeight = bodyHeight + AXIS_TAIL_PX + LIVE_BUTTON_CLEARANCE_PX;
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
          style={{ height: columnHeight }}
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
            style={{ height: columnHeight }}
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
                  nextTop={nextTopOf.get(show.id)}
                  friends={friendPicks.get(show.id) ?? []}
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
  /** Where the next show of the stage starts: a taller block for friends never reaches it. */
  nextTop: number | undefined;
  /** The friends who picked this show; empty with no group. */
  friends: readonly FriendPicks[];
  selected: boolean;
  pending: boolean;
  clash: boolean;
  onToggle: (showId: string) => void;
};

function ShowBlock({
  show,
  geometry,
  nextTop,
  friends,
  selected,
  pending,
  clash,
  onToggle,
}: ShowBlockProps) {
  const pressed = usePressed<HTMLButtonElement>();
  const clashId = useId();
  const pendingId = useId();
  const friendsId = useId();
  const withFriends = friends.length > 0;
  const { initials, extra } = indicatorParts(friends);
  // The marks describe the block; its name stays "Artista … horario", so a screen reader announces
  // the show first and no block answers to the names of other buttons ("Guardar").
  const describedBy = [
    clash ? clashId : null,
    pending ? pendingId : null,
    withFriends ? friendsId : null,
  ]
    .filter(Boolean)
    .join(" ");
  // The row of initials goes under the time line, which is never hidden: a short block grows to
  // 60 px for it, up to where the next show of the stage starts.
  const height = withFriends ? heightWithFriends(geometry, nextTop) : geometry.height;
  // Too short for the name in 2 lines plus the time line and the row: the name takes 1 line, with
  // "…". Only visual: the accessible name keeps the whole name.
  const clampName = withFriends && height < NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS;

  return (
    <button
      type="button"
      data-show-id={show.id}
      data-pending={pending ? "true" : undefined}
      aria-pressed={selected}
      aria-describedby={describedBy || undefined}
      onClick={() => onToggle(show.id)}
      // Geometry straight from blockGeometry: the height is the duration at scale (FR-03), never
      // under 44 px (NFR-03). The 1 px inset and 4 px padding only narrow it: at 360 px they leave
      // the name 92 px, which is what "Partysani Klezmer Band" and "Las Canciones de Ainé" need to
      // fit in 2 lines at 13 px semibold (NFR-04).
      style={{ top: geometry.top, height }}
      className={cn(
        "absolute inset-x-px flex flex-col items-start gap-0.5 overflow-hidden rounded-md border px-1 py-1 text-left transition-[background-color,border-color,transform] duration-100 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[pressed=true]:scale-[0.97]",
        selected
          ? "border-background bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent/40 data-[pressed=true]:bg-accent/60",
        // Unsaved: a dashed outline, which takes no room from the name or the time line.
        pending && "border-dashed",
      )}
      {...pressed}
    >
      <span className="flex w-full">
        {/* Spanish hyphenation (html lang="es-AR") breaks a long word before it is split blindly
            ("Desen-chufados"); overflow-wrap:anywhere stays as the fallback where the browser has
            no dictionary. The slightly tight tracking is the other margin NFR-04 needs. The name
            has the row to itself: no mark takes width from it. */}
        <span
          className={cn(
            "min-w-0 flex-1 text-[13px] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] hyphens-auto",
            clampName && "line-clamp-1",
          )}
        >
          {show.artist}
        </span>
      </span>
      {/* Whitespace between the parts: a flex container does not draw it, but it keeps the
          words apart in the accessible name ("DJO 18:00 – 19:00"). */}{" "}
      {show.subtitle ? (
        <span
          className={cn(
            "w-full text-[12px] leading-tight [overflow-wrap:anywhere] hyphens-auto opacity-80",
            // One line, so the time line and the initials keep their room.
            withFriends && "line-clamp-1",
          )}
        >
          {show.subtitle}
        </span>
      ) : null}{" "}
      {/* Its own line height, 12 px × 1.25 = 15 px: otherwise its strut keeps the body's 16 px and
          24 px and leaves no room for the initials in a 60 px block. */}
      <span data-time-line className="relative w-full text-[12px] leading-tight">
        <span className="tabular text-[12px] leading-tight tracking-[-0.03em] opacity-80">
          {timeRange(show)}
        </span>
        {clash ? (
          // At the end of the time line, in the room the time leaves plus 2 px of the right padding:
          // at 360 px the time measures 78–82 px of the name's 92 (with its tight tracking), so a
          // 12 px icon keeps 2 px from it and 2 px from the border, and never takes width from the
          // name (NFR-04). Gold filled, dark outlined: legible on the foam of a chosen block, the
          // only kind that can clash.
          <TriangleAlert
            aria-hidden="true"
            className="absolute top-1/2 -right-[2px] size-3 -translate-y-1/2 fill-warning text-rp-base"
          />
        ) : null}
      </span>
      {withFriends ? (
        // Decorative: the description names the friends, so the initials are not read twice.
        <span data-friend-picks aria-hidden="true" className="flex w-full gap-0.5">
          {initials.map((initial, index) => (
            <FriendChip key={index} selected={selected}>
              {initial}
            </FriendChip>
          ))}
          {extra > 0 ? (
            <FriendChip selected={selected}>{extraFriendsLabel(extra)}</FriendChip>
          ) : null}
        </span>
      ) : null}
      {clash ? (
        <span id={clashId} hidden>
          Choca con otro show elegido
        </span>
      ) : null}
      {pending ? (
        <span id={pendingId} hidden>
          Sin guardar
        </span>
      ) : null}
      {withFriends ? (
        <span id={friendsId} hidden>
          {friendsPickedLabel(friends.map((friend) => friend.name))}
        </span>
      ) : null}
    </button>
  );
}

/**
 * One friend's initials, or "+N". Rosé Pine's overlay on an unchosen block; on a chosen one, the
 * foam darkened by the base, which keeps the dark text legible. Never iris.
 */
function FriendChip({ selected, children }: { selected: boolean; children: string }) {
  return (
    <span
      className={cn(
        "tabular rounded-sm px-1 text-[12px] leading-4 font-semibold",
        selected ? "bg-rp-base/25" : "bg-rp-overlay text-foreground",
      )}
    >
      {children}
    </span>
  );
}
