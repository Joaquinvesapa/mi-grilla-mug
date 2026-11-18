// Local runs read TEST_DATABASE_URL (and DATABASE_URL, the development database) from `.env`; in CI
// (and in `pnpm test:e2e:docker`) they come from the environment, which dotenv never overrides.
// FIX-004: the app under test runs on TEST_DATABASE_URL (playwright.config.ts), so these rows go
// there too, never to the development database.
import "dotenv/config";

import { randomUUID } from "node:crypto";

import pg from "pg";

import { resolveTestDatabaseUrl } from "../test-database";

// The rows FEAT-006c's E2E needs that the UI cannot make fast enough: groups of up to 20 members
// with their saved selections (AC-21, AC-22, AC-25, AC-30). Written straight into the tables of
// prisma/schema.prisma with parameterized queries. Every id is a fresh UUID and every friend's email
// `e2e-picks-<uuid>@example.com`, so tests running in parallel never touch each other's rows. There
// is no cleanup: the rows pile up like the accounts the sign-ups leave. The friends inserted here
// have no Better Auth account, so nobody can sign in as them.

let pool: pg.Pool | undefined;

/**
 * The pool, opened only after the guard: a TEST_DATABASE_URL that is missing, not this machine's or
 * the CI service's, or the development database is refused before any connection (R-07).
 */
function database(): pg.Pool {
  const url = resolveTestDatabaseUrl(process.env);
  // Idle connections close on their own, so a worker that is done never waits on the pool.
  pool ??= new pg.Pool({ connectionString: url, max: 2, allowExitOnIdle: true });
  return pool;
}

/** Runs `work` in one transaction: a helper writes all its rows or none. */
async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type InsertGroupOptions = {
  name: string;
  /** User ids of accounts that already exist; the first one is the group's admin. */
  members: readonly string[];
  /** When every one of `members` joined. */
  joinedAt: Date;
  /** When the group was created; `joinedAt` by default. */
  createdAt?: Date;
};

/** Creates a group with `members` in it, all joined at `joinedAt`. Returns the group's id. */
export async function insertGroup({
  name,
  members,
  joinedAt,
  createdAt = joinedAt,
}: InsertGroupOptions): Promise<string> {
  const groupId = randomUUID();
  await transaction(async (client) => {
    await client.query("INSERT INTO groups (id, name, created_at) VALUES ($1, $2, $3)", [
      groupId,
      name,
      createdAt,
    ]);
    for (const [index, userId] of members.entries()) {
      await client.query(
        "INSERT INTO group_members (group_id, user_id, is_admin, joined_at) VALUES ($1, $2, $3, $4)",
        [groupId, userId, index === 0, joinedAt],
      );
    }
  });
  return groupId;
}

export type Friend = { name: string; showIds: readonly string[] };

/**
 * Creates one user per friend, each with their saved selection, and adds them to `groupId` in the
 * order given: one millisecond apart, after now, so the first friend is the one who joined first.
 * Returns their user ids. The `showIds` have to exist in the seeded grid (`data/schedule.json`).
 */
export async function insertFriends(
  groupId: string,
  friends: readonly Friend[],
): Promise<string[]> {
  const base = Date.now();
  return transaction(async (client) => {
    const ids: string[] = [];
    for (const [index, friend] of friends.entries()) {
      const userId = randomUUID();
      const now = new Date(base + index);
      await client.query(
        `INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, false, $4, $4)`,
        [userId, friend.name, `e2e-picks-${randomUUID()}@example.com`, now],
      );
      await client.query(
        "INSERT INTO group_members (group_id, user_id, is_admin, joined_at) VALUES ($1, $2, false, $3)",
        [groupId, userId, now],
      );
      await client.query(
        "INSERT INTO selected_shows (user_id, show_id) SELECT $1, unnest($2::text[])",
        [userId, [...friend.showIds]],
      );
      ids.push(userId);
    }
    return ids;
  });
}

/** Saves `showIds` as the selection of an existing user (the viewer of AC-30). */
export async function insertSelection(userId: string, showIds: readonly string[]): Promise<void> {
  await database().query(
    `INSERT INTO selected_shows (user_id, show_id) SELECT $1, unnest($2::text[])
     ON CONFLICT DO NOTHING`,
    [userId, [...showIds]],
  );
}

/** The user id of the account signed up with `email` (emails are stored lowercase). */
export async function userIdByEmail(email: string): Promise<string> {
  const { rows } = await database().query<{ id: string }>("SELECT id FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  const row = rows[0];
  if (!row) throw new Error(`No hay una cuenta con el email ${email}`);
  return row.id;
}
