import "server-only";

import { getDb } from "@/server/db";
import type { PrismaClient } from "@/server/generated/prisma/client";

/** Attempts per email allowed in one window (FR-10). */
const LOGIN_MAX_ATTEMPTS = 5;
/** The window those attempts are counted in. */
const LOGIN_WINDOW_MS = 15 * 60_000;
/** How long the email stays locked after the 5th failure (AC-13). */
const LOGIN_LOCK_MS = 15 * 60_000;

export type ReserveResult = { ok: true } | { ok: false; code: "LOGIN_LOCKED" };

export type LoginThrottle = {
  /** Takes one attempt of the email's window, or answers that the email is locked. */
  reserve(email: string): Promise<ReserveResult>;
  /** After a failed attempt: locks the email if the window is used up. */
  recordFailure(email: string): Promise<void>;
  /** After a successful sign-in: forgets the email. */
  clear(email: string): Promise<void>;
};

export type LoginThrottleOptions = {
  db: Pick<PrismaClient, "$queryRaw" | "$executeRaw">;
  /** The clock every comparison uses. Postgres' own `now()` is never used. */
  now?: () => Date;
};

const LOCKED: ReserveResult = { ok: false, code: "LOGIN_LOCKED" };
const ACCEPTED: ReserveResult = { ok: true };

/**
 * Lock per normalized email, existing or not (R-09), over `login_throttles`. Every statement is a
 * parameterized tagged template, and the timestamp columns (`TIMESTAMP(3)` without time zone) are
 * only compared against `Date` parameters from the injected clock.
 */
export function createLoginThrottle({
  db,
  now = () => new Date(),
}: LoginThrottleOptions): LoginThrottle {
  return {
    async reserve(email) {
      const at = now();
      const windowStart = new Date(at.getTime() - LOGIN_WINDOW_MS);
      // One atomic statement per row (R-02). The row is reset when its lock has passed, or when its
      // window expired without a lock (AC-13); otherwise one attempt is added only while fewer than
      // 5 were taken. A locked or used-up email matches no row in the WHERE, so nothing is
      // updated and nothing is returned.
      const rows = await db.$queryRaw<{ attempts: number }[]>`
        INSERT INTO login_throttles AS t (email, attempts, window_started_at, locked_until)
        VALUES (${email}, 1, ${at}, NULL)
        ON CONFLICT (email) DO UPDATE SET
          attempts = CASE
            WHEN (t.locked_until IS NOT NULL AND t.locked_until <= ${at})
              OR (t.locked_until IS NULL AND t.window_started_at <= ${windowStart})
            THEN 1 ELSE t.attempts + 1 END,
          window_started_at = CASE
            WHEN (t.locked_until IS NOT NULL AND t.locked_until <= ${at})
              OR (t.locked_until IS NULL AND t.window_started_at <= ${windowStart})
            THEN ${at} ELSE t.window_started_at END,
          locked_until = NULL
        WHERE (t.locked_until IS NOT NULL AND t.locked_until <= ${at})
          OR (t.locked_until IS NULL AND t.window_started_at <= ${windowStart})
          OR (t.locked_until IS NULL AND t.attempts < ${LOGIN_MAX_ATTEMPTS})
        RETURNING t.attempts`;
      return rows.length > 0 ? ACCEPTED : LOCKED;
    },

    async recordFailure(email) {
      const at = now();
      const windowStart = new Date(at.getTime() - LOGIN_WINDOW_MS);
      // Purge first, so the table does not grow without bound with random emails (R-12).
      await db.$executeRaw`
        DELETE FROM login_throttles
        WHERE window_started_at <= ${windowStart}
          AND (locked_until IS NULL OR locked_until <= ${at})`;
      // A lock already in force is not extended: it lasts 15 minutes from the 5th failure.
      const lockedUntil = new Date(at.getTime() + LOGIN_LOCK_MS);
      await db.$executeRaw`
        UPDATE login_throttles SET locked_until = ${lockedUntil}
        WHERE email = ${email}
          AND attempts >= ${LOGIN_MAX_ATTEMPTS}
          AND locked_until IS NULL`;
    },

    async clear(email) {
      await db.$executeRaw`DELETE FROM login_throttles WHERE email = ${email}`;
    },
  };
}

let sharedThrottle: LoginThrottle | undefined;

/** The process-wide throttle, over the shared client. */
export function getLoginThrottle(): LoginThrottle {
  sharedThrottle ??= createLoginThrottle({ db: getDb() });
  return sharedThrottle;
}
