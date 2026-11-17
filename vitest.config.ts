import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Tests run outside the `react-server` condition, where `server-only` throws on import.
      // Resolve it to the package's own no-op entry, the one Next uses on the server.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/unit/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/integration/setup.ts"],
          // Every file shares one database and empties its tables before each test: one file at a
          // time, or one file's cleanup wipes the rows another is asserting on.
          fileParallelism: false,
          server: {
            deps: {
              // Inlined so `vi.mock("next/headers")` reaches the dynamic import inside Better Auth's
              // nextCookies() plugin; externalized, it would load the real module.
              inline: ["better-auth"],
            },
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**", "src/components/**", "src/app/manifest.ts"],
      exclude: [
        "src/server/generated/**",
        "src/server/db.ts",
        "src/components/ui/**",
        "src/app/sw.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
      },
    },
  },
});
