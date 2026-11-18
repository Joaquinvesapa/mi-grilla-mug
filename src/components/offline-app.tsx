"use client";

import { useState, useSyncExternalStore } from "react";

import { readSnapshot } from "@/components/device-store";
import { OfflineCard } from "@/components/offline-card";
import { type SaveSelection, ScheduleScreen } from "@/components/schedule-screen";
import { festivalDayFor } from "@/lib/festival-time";
import type { DeviceSnapshot } from "@/lib/offline-selection";

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

/** The only URL whose offline answer may show the grid (R-08): `/login` and `/register` never. */
const GRID_PATHNAME = "/";

type View = { kind: "card" } | { kind: "grid"; snapshot: DeviceSnapshot; initialDayId: string };

/** What the offline screen shows for this URL and this device. */
function decideView(): View {
  if (window.location.pathname !== GRID_PATHNAME) {
    return { kind: "card" };
  }
  // Only through `readSnapshot()`: nothing unvalidated reaches the screen (R-02).
  const snapshot = readSnapshot();
  if (!snapshot) {
    return { kind: "card" };
  }
  // The real clock: the simulated one only exists in `/demo`.
  return {
    kind: "grid",
    snapshot,
    initialDayId: festivalDayFor(new Date(), snapshot.schedule.days),
  };
}

export type OfflineAppProps = {
  saveAction: SaveSelection;
  logoutAction: () => void | Promise<void>;
};

/**
 * What `/~offline` shows (ADR-004). The service worker answers any failed navigation with that
 * precached page, so the URL in the address bar is the one that failed: for `/`, with a device
 * copy, it is the grid built from the copy (FR-01, AC-20); otherwise, the "Sin conexión" card
 * (AC-21).
 *
 * The page is prerendered, with no storage and no URL to look at: the server render and the first
 * client render (hydration) are an empty, busy screen, and the choice is made once in the browser,
 * so there is neither a hydration mismatch nor a flash of the card before the grid.
 *
 * The grid starts on the selection the server confirmed (`savedShowIds`): `ScheduleScreen` adopts
 * the user's pending selection by itself, and syncs it on `online` without reloading (FR-03),
 * which would lose the draft. The card does reload.
 */
export function OfflineApp({ saveAction, logoutAction }: OfflineAppProps) {
  const inBrowser = useSyncExternalStore(subscribeToNothing, isBrowser, isServer);
  const [view, setView] = useState<View | null>(null);
  // Adjusted while rendering, once (React's pattern for state derived from other state).
  if (inBrowser && view === null) {
    setView(decideView());
  }

  if (view === null) {
    return (
      <main aria-busy="true" className="app-fixed-screen mx-auto flex w-full max-w-md flex-col" />
    );
  }
  if (view.kind === "card") {
    return <OfflineCard />;
  }
  const { snapshot, initialDayId } = view;
  return (
    <ScheduleScreen
      schedule={snapshot.schedule}
      savedShowIds={snapshot.savedShowIds}
      initialDayId={initialDayId}
      userName={snapshot.userName}
      userId={snapshot.userId}
      mode="offline"
      // The groups the copy carries: the picker and the initials work without signal (FR-06).
      groups={snapshot.groups}
      saveAction={saveAction}
      logoutAction={logoutAction}
    />
  );
}
