// The real time, kept fresh while `active`: a timer refreshes it on every exact minute change and
// it is re-read when the page becomes visible again (a suspended tab does not run its timers).
// There is no other source of time on purpose (FR-14): no prop, no URL, no storage. The simulated
// clock of `/demo` lives in `demo-clock.ts` (FEAT-005b): `useAppNow` prefers it inside `/demo` and
// falls back to this hook, which stays untouched. No "use client" of its own: only client
// components import it.
import { useEffect, useMemo, useState } from "react";

const MINUTE_MS = 60_000;

// Fire a little after the minute changes, so a timer that runs 1 ms early still sees the new minute.
const TICK_MARGIN_MS = 50;

function msUntilNextMinute(nowMs: number): number {
  return MINUTE_MS - (nowMs % MINUTE_MS) + TICK_MARGIN_MS;
}

/** The current time. While `active`, it updates on every minute change and when the tab returns. */
export function useNow(active: boolean): Date {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    function refresh() {
      const current = Date.now();
      setNowMs(current);
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilNextMinute(current));
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }

    // The hook can be mounted long before it turns active: read the time again when it does.
    refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active]);

  // The same Date while the time does not change, so memos that depend on it stay valid.
  return useMemo(() => new Date(nowMs), [nowMs]);
}
