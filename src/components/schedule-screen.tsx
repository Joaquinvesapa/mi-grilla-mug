"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { AppBar } from "@/components/app-menu";
import { DayPicker } from "@/components/day-picker";
import { PendingBar } from "@/components/pending-bar";
import { ScheduleGrid } from "@/components/schedule-grid";
import { findClashes } from "@/lib/clashes";
import type { Schedule } from "@/lib/schedule-types";
import { selectionMessageFor } from "@/lib/selection-messages";

/** `saveSelectionAction`'s shape, so tests can pass a fake one (as the account forms do). */
export type SaveSelection = (
  showIds: string[],
) => Promise<{ ok: true } | { ok: false; code: string }>;

export type ScheduleScreenProps = {
  schedule: Schedule;
  /** What the account has saved, as loaded by the page. */
  savedShowIds: readonly string[];
  /** The day to open on, from `festivalDayFor` (FR-08). */
  initialDayId: string;
  userName: string;
  saveAction: SaveSelection;
  logoutAction: () => void | Promise<void>;
};

/** The ids in exactly one of the two sets: what is chosen and unsaved, or unchosen and saved. */
function difference(a: ReadonlySet<string>, b: ReadonlySet<string>): Set<string> {
  const result = new Set<string>();
  for (const id of a) {
    if (!b.has(id)) result.add(id);
  }
  for (const id of b) {
    if (!a.has(id)) result.add(id);
  }
  return result;
}

/**
 * The grid screen: exactly the visible height, with the bar and the days on top, the grid filling
 * the rest and scrolling on its own, and the pending notice at the bottom (mobile-native, fix 3).
 *
 * The draft is one set of ids above the day, so switching days keeps it (AC-13). "Pending" is its
 * difference from the saved set: while there is any, there is a notice (FR-11), a confirmation
 * before signing out and a `beforeunload` warning (FR-12).
 */
export function ScheduleScreen({
  schedule,
  savedShowIds,
  initialDayId,
  userName,
  saveAction,
  logoutAction,
}: ScheduleScreenProps) {
  const [dayId, setDayId] = useState(initialDayId);
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set(savedShowIds));
  const [draft, setDraft] = useState<ReadonlySet<string>>(() => new Set(savedShowIds));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const pending = useMemo(() => difference(draft, saved), [draft, saved]);
  const clashes = useMemo(() => findClashes(schedule.shows, draft), [schedule.shows, draft]);
  const day = schedule.days.find((item) => item.id === dayId) ?? schedule.days[0];
  const dayShows = useMemo(
    () => schedule.shows.filter((show) => show.dayId === dayId),
    [schedule.shows, dayId],
  );
  const hasPending = pending.size > 0;

  // Reloading, closing the tab or going back with unsaved changes asks the browser to confirm.
  // An extra: iOS Safari and the installed app do not always honour it; "Cerrar sesión" is the
  // exit that always asks (FR-12).
  useEffect(() => {
    if (!hasPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPending]);

  // Back to exactly what is saved: the last failure no longer applies to anything, so it must not
  // come back with the next change. Adjusted while rendering (React's pattern for state derived
  // from other state), so the toggle itself can stay a functional update.
  if (error !== null && pending.size === 0) {
    setError(null);
  }

  function toggle(showId: string) {
    // A functional update: two taps handled before a re-render both count.
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(showId)) {
        next.delete(showId);
      } else {
        next.add(showId);
      }
      return next;
    });
  }

  function discard() {
    setDraft(saved);
    setError(null);
  }

  function save() {
    // The whole draft, as it is now; ids sorted so the request does not depend on tap order.
    const snapshot = [...draft].sort();
    setError(null);
    startSaving(async () => {
      let result: Awaited<ReturnType<SaveSelection>>;
      try {
        result = await saveAction(snapshot);
      } catch {
        // The call never got an answer (no signal, network down): the draft stays as it is.
        setError(selectionMessageFor("NETWORK_ERROR"));
        return;
      }
      if (result.ok) {
        setSaved(new Set(snapshot));
      } else {
        setError(selectionMessageFor(result.code));
      }
    });
  }

  return (
    <main className="app-fixed-screen mx-auto flex w-full max-w-md flex-col">
      <AppBar userName={userName} logoutAction={logoutAction} pendingCount={pending.size} />
      <DayPicker days={schedule.days} value={dayId} onChange={setDayId}>
        {day ? (
          <ScheduleGrid
            day={day}
            stages={schedule.stages}
            shows={dayShows}
            selectedIds={draft}
            pendingIds={pending}
            clashIds={clashes}
            onToggle={toggle}
          />
        ) : null}
      </DayPicker>
      {hasPending ? (
        <PendingBar
          count={pending.size}
          saving={saving}
          error={error}
          onSave={save}
          onDiscard={discard}
        />
      ) : null}
    </main>
  );
}
