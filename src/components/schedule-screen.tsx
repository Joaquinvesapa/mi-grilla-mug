"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { AppBar } from "@/components/app-menu";
import { DayPicker } from "@/components/day-picker";
import { clearPending, readPending, writePending, writeSnapshot } from "@/components/device-store";
import { OfflinePendingNotice } from "@/components/offline-pending-notice";
import { PendingBar } from "@/components/pending-bar";
import { ScheduleGrid } from "@/components/schedule-grid";
import { WallpaperButton } from "@/components/wallpaper-button";
import { findClashes } from "@/lib/clashes";
import type { Schedule } from "@/lib/schedule-types";
import { selectionMessageFor } from "@/lib/selection-messages";

type SaveResult = { ok: true } | { ok: false; code: string };

// Nothing to subscribe to: only "server or hydrating" versus "in the browser" is asked.
function subscribeToNothing(): () => void {
  return () => {};
}

function isBrowser(): boolean {
  return true;
}

function isServer(): boolean {
  return false;
}

/** `saveSelectionAction`'s shape, so tests can pass a fake one (as the account forms do). */
export type SaveSelection = (showIds: string[], expectedUserId: string) => Promise<SaveResult>;

export type ScheduleScreenProps = {
  schedule: Schedule;
  /** What the account has saved, as loaded by the page (or by the device copy, without signal). */
  savedShowIds: readonly string[];
  /** The day to open on, from `festivalDayFor` (FR-08). */
  initialDayId: string;
  userName: string;
  /** The owner of the device copy and of the pending selection this screen reads and writes. */
  userId: string;
  /** `online`: rendered by `/` with a verified session, so it refreshes the device copy. */
  mode: "online" | "offline";
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
 *
 * Without a connection (FEAT-003b, ADR-004): a save that gets no answer is kept on the device as
 * the user's pending selection, under their own key, with a notice (FR-02, FR-04). It is synced on
 * mount and on every `online` event, one sync at a time (R-05), and only the pending selection of
 * `userId` is ever read (AC-27). The device copy only ever holds what the server confirmed.
 */
export function ScheduleScreen({
  schedule,
  savedShowIds,
  initialDayId,
  userName,
  userId,
  mode,
  saveAction,
  logoutAction,
}: ScheduleScreenProps) {
  const [dayId, setDayId] = useState(initialDayId);
  const [saved, setSaved] = useState<ReadonlySet<string>>(() => new Set(savedShowIds));
  const [draft, setDraft] = useState<ReadonlySet<string>>(() => new Set(savedShowIds));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  /** A pending selection is saved only on this device: the notice is on (FR-04). */
  const [onDevice, setOnDevice] = useState(false);
  /** Why a sync put the screen back to what is confirmed; outlives the pending bar. */
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, startSyncing] = useTransition();
  // One call to the action at a time, a save or a sync: in a ref, so two `online` events in a
  // row, or an `online` right after "Guardar", see the call in flight before any re-render. A sync
  // racing a save could send an older pending selection over the newer one (R-05).
  const inFlight = useRef(false);
  // The session turned out to be another account's: nothing is synced from this screen (AC-27).
  const syncBlocked = useRef(false);
  // What the server last confirmed for this user: the only selection the device copy holds.
  const confirmed = useRef<readonly string[]>(savedShowIds);

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

  /** What the server confirmed becomes the device copy's selection. */
  function rememberConfirmed(showIds: readonly string[]) {
    confirmed.current = showIds;
    // A failure is ignored on purpose: the screen with a connection does not depend on the copy,
    // and the next visit to `/` writes it again.
    writeSnapshot({ version: 1, userId, userName, schedule, savedShowIds: [...showIds] });
  }

  /** The action's answer, or `null` when it threw: the server never answered (no signal). */
  async function ask(showIds: string[]): Promise<SaveResult | null> {
    try {
      return await saveAction(showIds, userId);
    } catch {
      // Not swallowed: `null` is "no answer", which keeps the selection on the device.
      return null;
    }
  }

  function backToConfirmed() {
    const ids = new Set(confirmed.current);
    setSaved(ids);
    setDraft(ids);
    setOnDevice(false);
  }

  const sync = useEffectEvent(() => {
    if (inFlight.current || syncBlocked.current || !navigator.onLine) return;
    const stored = readPending(userId);
    if (!stored) return;
    inFlight.current = true;
    startSyncing(async () => {
      const result = await ask(stored.showIds);
      inFlight.current = false;

      if (result === null) {
        // No answer: it stays for the next mount or `online` event (AC-24).
        return;
      }
      if (result.ok) {
        clearPending(userId);
        rememberConfirmed(stored.showIds);
        setSaved(new Set(stored.showIds));
        setOnDevice(false);
        return;
      }
      if (result.code === "INVALID_SELECTION") {
        // It could never be saved: retrying it forever helps nobody (R-07).
        clearPending(userId);
        backToConfirmed();
        setSyncError(selectionMessageFor(result.code));
        return;
      }
      if (result.code === "USER_MISMATCH") {
        // The session is another account's: the pending selection stays for its owner and is not
        // shown as this account's (AC-27).
        syncBlocked.current = true;
        backToConfirmed();
        setSyncError(selectionMessageFor(result.code));
      }
      // Anything else (SERVICE_UNAVAILABLE, UNAUTHENTICATED) keeps it for the next try (AC-24).
    });
  });

  // Once in the browser, this user's pending selection (if any) is where the screen starts: it is
  // their last save (FR-01). Not while rendering on the server nor while hydrating, which have no
  // storage and must match; adjusted while rendering, like `error` above, and only once.
  const inBrowser = useSyncExternalStore(subscribeToNothing, isBrowser, isServer);
  const [adopted, setAdopted] = useState(false);
  if (inBrowser && !adopted) {
    setAdopted(true);
    const stored = readPending(userId);
    if (stored) {
      const ids = new Set(stored.showIds);
      setSaved(ids);
      setDraft(ids);
      setOnDevice(true);
    }
  }

  // On mount: refresh the device copy, only with a verified session behind the page.
  const refreshCopy = useEffectEvent(() => {
    if (mode === "online") {
      rememberConfirmed(savedShowIds);
    }
  });

  // Sync on mount and every time the signal comes back (FR-03).
  useEffect(() => {
    refreshCopy();
    sync();
    const onOnline = () => {
      sync();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

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

  /** Keeps `showIds` on the device as the user's pending selection, or says why it could not. */
  function keepOnDevice(showIds: string[]) {
    const stored = writePending({
      version: 1,
      userId,
      showIds,
      savedAt: new Date().toISOString(),
    });
    if (stored.ok) {
      setSaved(new Set(showIds));
      setOnDevice(true);
    } else {
      // Nothing was kept: the draft stays on screen and the user is told (R-06).
      setError(selectionMessageFor(stored.code));
    }
  }

  function save() {
    // "Guardar" is disabled while a sync runs; the ref also covers a tap before that re-render.
    if (inFlight.current) return;
    // The whole draft, as it is now; ids sorted so the request does not depend on tap order.
    const snapshot = [...draft].sort();
    setError(null);
    setSyncError(null);
    inFlight.current = true;
    startSaving(async () => {
      // Without a connection there is no call to wait for.
      const result = navigator.onLine ? await ask(snapshot) : null;
      inFlight.current = false;
      if (result === null) {
        keepOnDevice(snapshot);
      } else if (result.ok) {
        // An older pending selection must not overwrite this one later (R-05).
        clearPending(userId);
        rememberConfirmed(snapshot);
        setSaved(new Set(snapshot));
        setOnDevice(false);
      } else {
        setError(selectionMessageFor(result.code));
      }
    });
  }

  return (
    <main className="app-fixed-screen mx-auto flex w-full max-w-md flex-col">
      <AppBar userName={userName} logoutAction={logoutAction} pendingCount={pending.size} />
      {syncError ? (
        <p
          role="alert"
          className="shrink-0 border-y border-border bg-card px-4 py-3 text-sm text-destructive"
        >
          {syncError}
        </p>
      ) : null}
      {onDevice ? <OfflinePendingNotice /> : null}
      <DayPicker
        days={schedule.days}
        value={dayId}
        onChange={setDayId}
        action={
          day ? (
            // The draft, as on screen: unsaved marks and a pending selection included (FR-09).
            <WallpaperButton
              day={day}
              stages={schedule.stages}
              shows={dayShows}
              selectedIds={draft}
            />
          ) : undefined
        }
      >
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
          saving={saving || syncing}
          error={error}
          onSave={save}
          onDiscard={discard}
        />
      ) : null}
    </main>
  );
}
