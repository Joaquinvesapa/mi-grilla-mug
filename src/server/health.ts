import "server-only";

import { getDb } from "@/server/db";

export type HealthResult = { status: "ok"; database: "up" } | { status: "error"; database: "down" };

export type HealthErrorCode = "DB_UNREACHABLE" | "DB_TIMEOUT";

export type HealthCheckerOptions = {
  /** Resolves when the database answers. Defaults to `SELECT 1` on the shared client. */
  probe?: () => Promise<unknown>;
  timeoutMs?: number;
  cacheMs?: number;
  now?: () => number;
};

export type HealthChecker = { check(): Promise<HealthResult> };

const HEALTH_TIMEOUT_MS = 800;
const HEALTH_CACHE_MS = 2_000;

const UP: HealthResult = { status: "ok", database: "up" };
const DOWN: HealthResult = { status: "error", database: "down" };

function defaultProbe(): Promise<unknown> {
  return getDb().$queryRaw`SELECT 1`;
}

/** Only the generic code and the time: never the error, the URL or the host (R-01, R-07). */
function logFailure(code: HealthErrorCode, now: () => number): void {
  console.error(`[health] ${code} at=${new Date(now()).toISOString()}`);
}

/**
 * Probes the database with a timeout, and memoizes the outcome (up or down) for `cacheMs`, so a
 * burst of checks costs one query (R-02).
 */
export function createHealthChecker({
  probe = defaultProbe,
  timeoutMs = HEALTH_TIMEOUT_MS,
  cacheMs = HEALTH_CACHE_MS,
  now = Date.now,
}: HealthCheckerOptions = {}): HealthChecker {
  let cached: { startedAt: number; result: Promise<HealthResult> } | undefined;

  function runProbe(): Promise<HealthResult> {
    return new Promise<HealthResult>((resolve) => {
      let settled = false;
      const settle = (result: HealthResult, failure?: HealthErrorCode) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (failure) {
          logFailure(failure, now);
        }
        resolve(result);
      };
      const timer = setTimeout(() => settle(DOWN, "DB_TIMEOUT"), timeoutMs);
      // A rejection that arrives after the timeout is the incident already logged as DB_TIMEOUT.
      Promise.resolve()
        .then(probe)
        .then(
          () => settle(UP),
          () => settle(DOWN, "DB_UNREACHABLE"),
        );
    });
  }

  return {
    check() {
      const startedAt = now();
      if (cached && startedAt - cached.startedAt < cacheMs) {
        return cached.result;
      }
      cached = { startedAt, result: runProbe() };
      return cached.result;
    },
  };
}

let sharedChecker: HealthChecker | undefined;

/**
 * The process-wide checker behind `GET /api/health`. Creating it resolves the shared client, so a
 * missing or unsafe `DATABASE_URL` throws here instead of passing for a database outage.
 */
export function getHealthChecker(): HealthChecker {
  if (!sharedChecker) {
    getDb();
    sharedChecker = createHealthChecker();
  }
  return sharedChecker;
}
