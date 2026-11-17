// Local runs read DATABASE_URL from `.env`; in CI it comes from the job's environment, which dotenv
// never overrides.
import "dotenv/config";

import { afterAll, beforeEach } from "vitest";

import { createDb } from "@/server/db";

import { assertTruncatableDatabaseUrl } from "./database-guard";

// Better Auth needs both variables. These test-only values apply only when neither the environment
// nor `.env` sets them; they sign cookies of a throwaway test database and nothing else.
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = "integration-tests-only-secret-not-for-real-use";
}
if (!process.env.BETTER_AUTH_URL) {
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}

// Its own client, not the shared `getDb()` one: the health suite swaps DATABASE_URL per test and
// expects the shared client to be created from it.
let cleaner: ReturnType<typeof createDb> | undefined;

// Every test starts without accounts nor throttle rows. Only the tables this suite owns: deleting
// `users` cascades to `sessions` and `accounts`.
beforeEach(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // The health suite reports the missing variable itself, with its own message.
    return;
  }
  assertTruncatableDatabaseUrl(url);
  cleaner ??= createDb(url);
  await cleaner.$executeRaw`DELETE FROM users`;
  await cleaner.$executeRaw`DELETE FROM login_throttles`;
});

afterAll(async () => {
  await cleaner?.$disconnect();
  cleaner = undefined;
});
