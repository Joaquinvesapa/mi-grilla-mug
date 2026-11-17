/// <reference lib="webworker" />
// The service worker (ADR-002). Bundled by esbuild in src/app/serwist/[path]/route.ts and served
// as /serwist/sw.js with scope `/`; it only runs in the production build.
import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type RouteMatchCallback,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time: the build's static assets (JS, CSS, the self-hosted font) and
    // /~offline, each with its revision.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = "/~offline";

/**
 * Page navigations within the app. Nothing else gets a route: requests to /api/ and to other
 * origins are never answered by the worker, so the browser sends them as if it did not exist
 * (R-06).
 */
const isAppNavigation: RouteMatchCallback = ({ request, sameOrigin, url }) =>
  sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new build takes over at once and its precache replaces the previous one (R-05).
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Nothing is cached at runtime (no `defaultCache`). The one route is network-only: it stores
  // nothing, and exists so that a navigation that fails for lack of network has somewhere to
  // fall back to. `fallbacks` only attaches to `runtimeCaching` strategies, so with an empty list
  // the offline screen would never be served.
  runtimeCaching: [{ matcher: isAppNavigation, handler: new NetworkOnly() }],
  fallbacks: {
    entries: [
      {
        url: OFFLINE_URL,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
