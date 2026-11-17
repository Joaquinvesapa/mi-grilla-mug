import type { NextConfig } from "next";

// R-08 (clickjacking): only the app's own pages may show it in a frame — /demo, and nobody else.
// Both headers: frame-ancestors for current browsers, X-Frame-Options for the ones without CSP 2.
const FRAME_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: FRAME_HEADERS }];
  },
  typescript: {
    // ADR-001: TypeScript 7 does not expose the JS API that `next build` uses to type-check.
    // Types are checked in a separate step: `pnpm typecheck` (`tsc --noEmit`).
    ignoreBuildErrors: true,
  },
  // `next dev` would otherwise append a managed block to AGENTS.md on every run; that file is the
  // project's curated context and is edited by hand only.
  agentRules: false,
};

export default nextConfig;
