import { randomUUID } from "node:crypto";

import { createSerwistRoute } from "@serwist/turbopack";

// The offline screen's HTML gets a new revision on every build, so a new deploy always replaces
// the copy an old worker precached (R-05).
const OFFLINE_REVISION = randomUUID();

// Serves `sw.js` (and its source map), bundled with esbuild from src/app/sw.ts at build time.
// `createSerwistRoute` answers with `Service-Worker-Allowed: /` and, through `dynamicParams =
// false`, with a 404 for any file it did not generate.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: "/~offline", revision: OFFLINE_REVISION }],
    // Serwist's default patterns, plus the self-hosted font files that `next/font` emits under
    // static/media: without them the offline screen would fall back to a system font.
    globPatterns: [
      ".next/static/**/*.{js,css,html,ico,apng,png,avif,jpg,jpeg,jfif,pjpeg,pjp,gif,svg,webp,json,webmanifest,woff2}",
      "public/**/*",
    ],
  },
);
