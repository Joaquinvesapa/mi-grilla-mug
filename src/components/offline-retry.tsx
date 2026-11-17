"use client";

import { useEffect } from "react";

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
 * `onReload` exists for the tests.
 */
export function OfflineRetry({ onReload = reloadPage }: { onReload?: () => void }) {
  useEffect(() => {
    window.addEventListener("online", onReload);
    return () => window.removeEventListener("online", onReload);
  }, [onReload]);

  return (
    <Button type="button" size="lg" className="w-full" onClick={() => onReload()}>
      Reintentar
    </Button>
  );
}
