// The channel that carries the simulated clock of `/demo` to the app inside its iPhone (FEAT-005b,
// ADR-007). The app is an iframe of the same origin: it greets its parent once and then takes the
// time `/demo` sends, but only when that parent really is `/demo` (R-01) and only messages with the
// right shape (R-02). Outside `/demo` nothing listens and the app keeps the real time of `useNow`
// (FR-14 of FEAT-005a). No "use client" of its own: only client components import it.
import { useCallback, useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

import { useNow } from "@/components/use-now";
import {
  DEMO_CLOCK_HELLO,
  DEMO_CLOCK_MESSAGE,
  isDemoClockHello,
  parseDemoClockMessage,
  type DemoClockHello,
  type DemoClockMessage,
} from "@/lib/demo-clock";

/** Whether this window is the app framed by `/demo` of its own origin. */
export function isInsideDemo(): boolean {
  try {
    return window.parent !== window && window.parent.location.pathname === "/demo";
  } catch {
    // A parent of another origin throws a SecurityError when its `location` is read: whatever
    // framed the app, it is not our `/demo`, so the channel stays closed (R-01).
    return false;
  }
}

// Module store: one `message` listener for every subscriber. The last time is kept after the last
// subscriber leaves, so the next screen of the iPhone starts with it.
let demoNow: Date | null = null;
const subscribers = new Set<() => void>();
let listening = false;

function onMessage(event: MessageEvent<unknown>) {
  if (event.source !== window.parent || event.origin !== window.location.origin) return;
  const at = parseDemoClockMessage(event.data);
  if (at === null) return;
  demoNow = at;
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  if (subscribers.size === 1 && isInsideDemo()) {
    window.addEventListener("message", onMessage);
    listening = true;
    const hello: DemoClockHello = { type: DEMO_CLOCK_HELLO };
    window.parent.postMessage(hello, window.location.origin);
  }
  return () => {
    subscribers.delete(notify);
    if (subscribers.size === 0 && listening) {
      window.removeEventListener("message", onMessage);
      listening = false;
    }
  };
}

function getSnapshot(): Date | null {
  return demoNow;
}

// The server and the hydration of the normal app never see a simulated time.
function getServerSnapshot(): null {
  return null;
}

/** Only for tests: forgets the last time `/demo` sent. */
export function resetDemoClockForTests(): void {
  demoNow = null;
}

/** The time of the `/demo` clock, or `null` outside `/demo` or before `/demo` answers. */
export function useDemoNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The `/demo` clock when the app runs inside it; otherwise the real time of `useNow(active)`. */
export function useAppNow(active: boolean): Date {
  // Both hooks always run, in the same order: only the value returned changes.
  const demo = useDemoNow();
  const real = useNow(active);
  return demo ?? real;
}

/**
 * `/demo` side: sends `instant` to the iframe on every change and when the iframe greets, only to
 * its own `contentWindow` and with its own origin as `targetOrigin` (R-03). Returns the iframe's
 * `onLoad` handler, which sends it again in case the greeting arrived before this listener.
 */
export function useDemoClockBroadcast(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  instant: Date,
): () => void {
  const at = instant.getTime();
  const atRef = useRef(at);

  const sendNow = useCallback(() => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const message: DemoClockMessage = { type: DEMO_CLOCK_MESSAGE, at: atRef.current };
    target.postMessage(message, window.location.origin);
  }, [iframeRef]);

  useEffect(() => {
    atRef.current = at;
    sendNow();
  }, [at, sendNow]);

  useEffect(() => {
    function onHello(event: MessageEvent<unknown>) {
      const target = iframeRef.current?.contentWindow;
      if (!target || event.source !== target || event.origin !== window.location.origin) return;
      if (isDemoClockHello(event.data)) sendNow();
    }
    window.addEventListener("message", onHello);
    return () => window.removeEventListener("message", onHello);
  }, [iframeRef, sendNow]);

  return sendNow;
}
