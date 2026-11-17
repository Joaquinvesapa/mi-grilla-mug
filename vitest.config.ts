import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
