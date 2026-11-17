import "dotenv/config";

import { defineConfig } from "prisma/config";

// DATABASE_URL is optional on purpose: `pnpm install` runs `prisma generate` (postinstall), which
// does not connect, and has to work in a clone without `.env`. Commands that do connect (migrate)
// fail with Prisma's own error when it is missing.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // The grid (data/schedule.json). Plain Node, no transpiler: see prisma/seed.ts.
    seed: "node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
