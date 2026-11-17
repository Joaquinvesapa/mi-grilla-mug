import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { assertSafeDatabaseUrl } from "@/server/database-url";
import { PrismaClient } from "@/server/generated/prisma/client";

/** Small pool on purpose: a flood on /api/health must not exhaust Postgres (R-02). */
const DB_POOL_MAX = 5;

export class MissingDatabaseUrlError extends Error {
  readonly code = "DATABASE_URL_MISSING";

  constructor() {
    super("DATABASE_URL no está definida.");
    this.name = "MissingDatabaseUrlError";
  }
}

/** Builds a Prisma client over a `pg` pool. Throws `UnsafeDatabaseUrlError` before connecting. */
export function createDb(url: string): PrismaClient {
  assertSafeDatabaseUrl(url);
  const adapter = new PrismaPg(
    { connectionString: url, max: DB_POOL_MAX },
    {
      // An idle pooled connection that drops emits an error; log the generic code only (R-07).
      onPoolError: () => console.error(`[db] DB_POOL_ERROR at=${new Date().toISOString()}`),
    },
  );
  return new PrismaClient({ adapter });
}

// Kept on globalThis so dev hot reloads reuse one client per process instead of opening new pools.
const DB_KEY = Symbol.for("mi-grilla.db");
type DbHolder = { [DB_KEY]?: PrismaClient };
const holder = globalThis as typeof globalThis & DbHolder;

/** The process-wide client, created (and its URL validated) on first use. */
export function getDb(): PrismaClient {
  const existing = holder[DB_KEY];
  if (existing) {
    return existing;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new MissingDatabaseUrlError();
  }
  const db = createDb(url);
  holder[DB_KEY] = db;
  return db;
}

/** Closes the shared client's pool, if any; the next `getDb()` creates a new one. */
export async function disconnectDb(): Promise<void> {
  const db = holder[DB_KEY];
  if (!db) {
    return;
  }
  delete holder[DB_KEY];
  await db.$disconnect();
}
