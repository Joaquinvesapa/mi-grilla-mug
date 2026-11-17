import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

import { OfflineRetry } from "@/components/offline-retry";

export const metadata: Metadata = {
  title: "Sin conexión · Mi Grilla",
};

// The screen the service worker answers with when a navigation fails for lack of network
// (src/app/sw.ts), in place of the URL that failed. It is precached together with its CSS, JS and
// font, so it keeps the app's look with no signal at all. A server component: the only client
// code is the retry (OfflineRetry).
export default function OfflinePage() {
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
