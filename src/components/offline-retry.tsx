"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

function reloadPage() {
  window.location.reload();
}

/**
 * The way out of the "Sin conexión" screen. The screen is served in place of the URL whose
 * navigation failed, so reloading retries exactly that URL, and the service worker answers it:
 * with the app when the network is back, with this screen again when it is not.
 *
 * It reloads by itself on `online`, and on a tap of "Reintentar" for when that event does not come.
 * Once mounted (hydrated, with the `online` listener attached) the button carries
 * `data-ready="true"`, which the E2E waits on before tapping. `onReload` exists for the tests.
 */
export function OfflineRetry({ onReload = reloadPage }: { onReload?: () => void }) {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.addEventListener("online", onReload);
    // Set on the DOM, after the listener, so the mark never precedes what it promises.
    button.current?.setAttribute("data-ready", "true");
    return () => window.removeEventListener("online", onReload);
  }, [onReload]);

  return (
    <Button ref={button} type="button" size="lg" className="w-full" onClick={() => onReload()}>
      Reintentar
    </Button>
  );
}
