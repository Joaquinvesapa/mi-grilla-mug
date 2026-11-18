"use client";

import { TriangleAlert } from "lucide-react";
import { type CSSProperties, useId } from "react";

import { useAppNow } from "@/components/demo-clock";
import { LiveDot } from "@/components/live-dot";
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
  nowOffset,
  showPhase,
  type ShowPhase,
  NAME_TWO_LINES_MIN_HEIGHT_WITH_FRIENDS,
  PX_PER_MINUTE,
} from "@/lib/schedule-layout";
import type { FestivalDay, Show, Stage } from "@/lib/schedule-types";
import { stageStyle } from "@/lib/stage-colors";
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
/** Height of the sticky stage row (`h-10`): the body, and so the now-line, starts under it. */
const HEADER_PX = 40;
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
  // The real time outside /demo, the simulated one inside; it moves the now-line and tells which
  // shows are over or playing.
  const now = useAppNow(true);
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
  const nowTop = nowOffset(axis, now);
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
      <div className="relative grid" style={track}>
        {/* The corner stays over both sticky edges. */}
        <div className="sticky top-0 left-0 z-30 bg-background" />
        {columns.map((stage) => (
          <div
            key={stage.id}
            data-stage-header
            style={stageStyle(stage.id)}
            // A 3 px bar of the stage color on top and a 9 % tint, mixed with the base so the
            // header stays opaque over the blocks that scroll under it; the text stays foreground.
            className="sticky top-0 z-20 flex h-10 items-center justify-center truncate border-t-[3px] border-b border-border border-t-(--stage) bg-[color-mix(in_srgb,var(--stage)_9%,var(--color-rp-base))] px-1 text-[13px] font-semibold"
          >
            {stage.name}
          </div>
        ))}

        <div
          aria-hidden="true"
          data-hour-column
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
          {nowTop !== null ? (
            <span
              data-now-chip
              className="tabular absolute inset-x-0.5 z-10 flex h-5 -translate-y-1/2 items-center justify-center rounded-full bg-rp-love text-[12px] leading-none font-bold text-rp-base motion-safe:transition-[top] motion-safe:duration-200"
              style={{ top: nowTop }}
            >
              {formatClock(now)}
            </span>
          ) : null}
        </div>

        {columns.map((stage) => (
          <div
            key={stage.id}
            data-stage-column={stage.id}
            className="relative border-l border-border/40 bg-[color-mix(in_srgb,var(--stage)_7%,transparent)]"
            style={{ ...stageStyle(stage.id), height: columnHeight }}
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
                  phase={showPhase(show, now)}
                  onToggle={onToggle}
                />
              ))}
          </div>
        ))}

        {nowTop !== null ? (
          // Over the lanes and under the sticky stage row (z-20) and hour column (z-10): it
          // crosses every column from the hour column's edge, and it never takes a tap.
          <div
            aria-hidden="true"
            data-now-line
            className="pointer-events-none absolute right-0 z-[5] h-0.5 bg-rp-love motion-safe:animate-now-glow motion-safe:transition-[top] motion-safe:duration-200"
            style={{ top: HEADER_PX + nowTop - 1, left: HOURS_WIDTH }}
          />
        ) : null}
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
  /** Over, playing or still to come at the app time. */
  phase: ShowPhase;
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
  phase,
  onToggle,
}: ShowBlockProps) {
  const pressed = usePressed<HTMLButtonElement>();
  const clashId = useId();
  const pendingId = useId();
  const friendsId = useId();
  const playingId = useId();
  const past = phase === "past";
  const playing = phase === "playing";
  const withFriends = friends.length > 0;
  const { initials, extra } = indicatorParts(friends);
  // The marks describe the block; its name stays "Artista … horario", so a screen reader announces
  // the show first and no block answers to the names of other buttons ("Guardar").
  const describedBy = [
    clash ? clashId : null,
    pending ? pendingId : null,
    withFriends ? friendsId : null,
    playing ? playingId : null,
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
      style={{ ...stageStyle(show.stageId), top: geometry.top, height }}
      className={cn(
        "absolute inset-x-px flex flex-col items-start gap-0.5 overflow-hidden rounded-md border px-1 py-1 text-left transition-[background-color,border-color,transform] duration-100 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[pressed=true]:scale-[0.97]",
        selected
          ? [
              "text-(--on-stage)",
              // Over, a chosen show dims: its stage color at 72 % over the base.
              past
                ? "bg-[color-mix(in_srgb,var(--stage)_72%,var(--color-rp-base))]"
                : "bg-(--stage)",
              // An unsaved one outlines in the base, so the dashes show on the fill.
              pending
                ? "border-background"
                : past
                  ? "border-[color-mix(in_srgb,var(--stage)_72%,var(--color-rp-base))]"
                  : "border-(--stage)",
            ]
          : [
              "bg-card text-foreground hover:bg-accent/40 data-[pressed=true]:bg-accent/60",
              past ? "border-(--stage)/27" : "border-(--stage)/45",
            ],
        // Unsaved: a dashed outline, which takes no room from the name or the time line.
        pending && "border-dashed",
      )}
      {...pressed}
    >
      {clash ? (
        // A hatched left edge in the text color of the fill: status never by color alone, and not
        // the gold warning triangle of before, which now reads as Samsung. An overlay inside the
        // 4 px padding: it takes no width from the name (NFR-04).
        <span
          aria-hidden="true"
          data-clash-edge
          className="absolute inset-y-0 left-0 w-[3px] bg-[repeating-linear-gradient(45deg,var(--on-stage)_0_2px,transparent_2px_4px)] opacity-60"
        />
      ) : null}
      {playing ? (
        <LiveDot className="absolute top-1.5 right-1.5 shadow-[0_0_0_2px_var(--color-rp-base)]" />
      ) : null}
      <span className="flex w-full">
        {/* Spanish hyphenation (html lang="es-AR") breaks a long word before it is split blindly
            ("Desen-chufados"); overflow-wrap:anywhere stays as the fallback where the browser has
            no dictionary. The slightly tight tracking is the other margin NFR-04 needs. The name
            has the row to itself: no mark takes width from it. */}
        <span
          className={cn(
            "min-w-0 flex-1 text-[13px] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] hyphens-auto",
            !selected && past && "text-muted-foreground",
            // Room for the live dot at the top right, as a float the first lines wrap around.
            playing && "before:float-right before:h-3 before:w-3 before:content-['']",
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
      </span>
      {clash ? (
        // Visible words next to the icon, in the text color; decorative because the description
        // below already says it, so the accessible name stays "Artista horario".
        <span
          aria-hidden="true"
          data-clash-tag
          className="flex w-full items-center gap-0.5 text-[12px] leading-tight font-bold"
        >
          <TriangleAlert className="size-3 shrink-0" />
          Choque
        </span>
      ) : null}
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
      {playing ? (
        <span id={playingId} hidden>
          Ahora
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
