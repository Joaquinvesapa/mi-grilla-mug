// Whether the browser says it has a connection, kept up to date by its `online` and `offline`
// events. No "use client" of its own: only client components import it. `navigator.onLine` only
// knows there is no network at all; a signal that drops requests is caught by the save itself.
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function isOnline(): boolean {
  return navigator.onLine;
}

// The server renders as online, so the first client render matches it and then corrects itself.
function isOnlineOnServer(): boolean {
  return true;
}

/** `false` while the browser has no connection; `true` on the server. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline, isOnlineOnServer);
}
