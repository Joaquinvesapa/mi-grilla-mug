// Local runs read TEST_DATABASE_URL (and DATABASE_URL, the development database) from `.env`; in CI
// they come from the job's environment, which dotenv never overrides.
import "dotenv/config";

import { afterAll, beforeEach } from "vitest";

import { createDb } from "@/server/db";

import { resolveTestDatabaseUrl } from "../test-database.ts";
import { assertTruncatableDatabaseUrl } from "./database-guard";

// FIX-004: the suite runs on TEST_DATABASE_URL, never on the development database. The DATABASE_URL
// that came from `.env` or the environment is kept the first time this runs in the process, so the
// check never compares against the value written below (empty when there was none, as in the CI).
process.env.MI_GRILLA_DEVELOPMENT_DATABASE_URL ??= process.env.DATABASE_URL ?? "";
// Throws before any client exists, so a missing, remote or development database stops the suite
// before a single DELETE. Every test keeps reading DATABASE_URL and gets the test database.
process.env.DATABASE_URL = resolveTestDatabaseUrl({
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  DATABASE_URL: process.env.MI_GRILLA_DEVELOPMENT_DATABASE_URL,
});

// Better Auth needs both variables. These test-only values apply only when neither the environment
// nor `.env` sets them; they sign cookies of a throwaway test database and nothing else.
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = "integration-tests-only-secret-not-for-real-use";
}
if (!process.env.BETTER_AUTH_URL) {
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
}

// Its own client, not the shared `getDb()` one: the health suite swaps DATABASE_URL per test and
// expects the shared client to be created from it. That swap is why every test re-checks the URL.
let cleaner: ReturnType<typeof createDb> | undefined;

// Every test starts without accounts, groups nor throttle rows. Only the tables this suite owns:
// deleting `groups` cascades to `group_members` and `group_invites`, and deleting `users` to
// `sessions`, `accounts` and `selected_shows`. Groups go first: a group outlives its members.
beforeEach(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // The health suite reports the missing variable itself, with its own message.
    return;
  }
  assertTruncatableDatabaseUrl(url);
  cleaner ??= createDb(url);
  await cleaner.$executeRaw`DELETE FROM groups`;
  await cleaner.$executeRaw`DELETE FROM users`;
  await cleaner.$executeRaw`DELETE FROM login_throttles`;
});

afterAll(async () => {
  await cleaner?.$disconnect();
  cleaner = undefined;
});
