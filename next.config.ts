import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
