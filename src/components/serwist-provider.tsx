"use client";

import { SerwistProvider as BaseSerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

// Served by src/app/serwist/[path]/route.ts, built from src/app/sw.ts.
export const SW_URL = "/serwist/sw.js";

/**
 * Registers the service worker over the whole app (scope `/`).
 *
 * - Only the production build registers it (ADR-002): in `next dev` a worker would serve stale
 *   assets over hot reload.
 * - `cacheOnNavigation` off: Serwist would otherwise ask the worker to cache every page visited,
 *   and in FEAT-001 the worker caches nothing at runtime (R-06).
 * - `reloadOnOnline` off: reloading every page when the signal comes back would throw away what
 *   lives only in the page (the pending changes of PRD 02). Only the "Sin conexión" screen
 *   reloads itself (src/components/offline-retry.tsx).
 */
export function SerwistProvider({ children }: { children: ReactNode }) {
  return (
    <BaseSerwistProvider
      swUrl={SW_URL}
      options={{ scope: "/" }}
      disable={process.env.NODE_ENV !== "production"}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      {children}
    </BaseSerwistProvider>
  );
}
