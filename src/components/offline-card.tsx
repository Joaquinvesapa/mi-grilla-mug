import { WifiOff } from "lucide-react";

import { OfflineRetry } from "@/components/offline-retry";

/**
 * The "Sin conexión" screen: what `/~offline` shows when there is no device copy to build the grid
 * from (AC-21), or when the URL that failed is not `/` (R-08). It reloads by itself when the
 * signal comes back, and on "Reintentar" (OfflineRetry).
 */
export function OfflineCard() {
  return (
    <main className="app-screen mx-auto flex w-full max-w-md flex-col px-5 pt-10 pb-12">
      <p className="text-xl font-semibold tracking-tight">
        Mi <span className="text-primary">Grilla</span>
      </p>

      <section aria-labelledby="offline-title" className="app-card my-auto">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-background/60 text-primary"
        >
          <WifiOff className="size-6" />
        </span>
        <h1 id="offline-title" className="text-3xl font-semibold tracking-tight">
          Sin conexión
        </h1>
        <p className="text-muted-foreground">
          Ahora no llega señal. Apenas vuelva, Mi Grilla se recarga sola; si no, probá de nuevo.
        </p>
        <OfflineRetry />
      </section>
    </main>
  );
}
