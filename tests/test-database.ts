/**
 * The database the tests empty and fill (FIX-004): `TEST_DATABASE_URL`, never the development one in
 * `DATABASE_URL`. One function decides whether that URL can be used, and the three paths that touch
 * the test database call it: the integration setup, the Playwright config and
 * `pnpm db:test:prepare`.
 *
 * Runs with plain Node (`node tests/test-database.ts <command> [args…]`, Node 24 type stripping):
 * relative imports carry their `.ts` extension and there are no enums nor parameter properties.
 * In that command mode it resolves the URL from `process.env` and runs `<command>` with
 * `DATABASE_URL` set to the test database. The URL is never printed.
 */
import { spawnSync } from "node:child_process";

import {
  assertTruncatableDatabaseUrl,
  UntruncatableDatabaseError,
} from "./integration/database-guard.ts";

/**
 * Reads only `TEST_DATABASE_URL` and `DATABASE_URL`. An index signature, not two optional keys, so
 * `process.env` is accepted as is (a type with only optional keys rejects it as a weak type).
 */
export type TestDatabaseEnv = Readonly<Record<string, string | undefined>>;

/** Query parameters `pg` reads that override the host, port or database of the URL itself. */
const QUERY_OVERRIDES: readonly string[] = ["host", "hostaddr", "port", "dbname", "database"];
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const DEFAULT_PORT = "5432";

// Every message names the variable to check and never carries a URL nor its credentials.
export class MissingTestDatabaseError extends Error {
  constructor() {
    super(
      "Falta TEST_DATABASE_URL: es la base que vacían los tests, distinta de DATABASE_URL (ver .env.example y pnpm db:test:prepare).",
    );
    this.name = "MissingTestDatabaseError";
  }
}

export class UnsupportedTestDatabaseUrlError extends Error {
  constructor() {
    super(
      "TEST_DATABASE_URL no es una URL que se pueda usar: poné el host, el puerto y la base en la URL misma, sin host, hostaddr, port, dbname ni database en la query.",
    );
    this.name = "UnsupportedTestDatabaseUrlError";
  }
}

export class SameAsDevelopmentDatabaseError extends Error {
  constructor() {
    super(
      "TEST_DATABASE_URL apunta a la misma base que DATABASE_URL: los tests la vaciarían. Usá otra base (por ejemplo mi_grilla_test).",
    );
    this.name = "SameAsDevelopmentDatabaseError";
  }
}

/** What `pg` connects to: normalized host, port and database name. */
type DatabaseTarget = { host: string; port: string; database: string };

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    // Not a URL: each caller refuses it with its own error.
    return undefined;
  }
}

function normalizeHost(host: string): string {
  const lower = host.toLowerCase();
  return LOOPBACK_HOSTS.has(lower) ? "loopback" : lower;
}

function decode(component: string): string | undefined {
  try {
    return decodeURIComponent(component);
  } catch {
    // A malformed escape (`%zz`): the caller treats the URL as unusable, with its own error.
    return undefined;
  }
}

/**
 * The target of `url`, with the query overrides `pg` honors winning over the URL's own parts (an
 * empty override falls back to them), or undefined when a part cannot be decoded.
 */
function targetOf(url: URL): DatabaseTarget | undefined {
  const query = url.searchParams;
  const host = query.get("host") || query.get("hostaddr") || url.hostname;
  const port = query.get("port") || url.port || DEFAULT_PORT;
  const path = decode(url.pathname.replace(/^\//, ""));
  const user = decode(url.username);
  if (path === undefined || user === undefined) {
    return undefined;
  }
  // Without a database name, `pg` connects to the one named after the user.
  const database = query.get("dbname") || query.get("database") || path || user;
  return { host: normalizeHost(host), port, database };
}

function isSameTarget(a: DatabaseTarget, b: DatabaseTarget): boolean {
  return a.host === b.host && a.port === b.port && a.database === b.database;
}

/**
 * Returns `env.TEST_DATABASE_URL` when the tests may use it. Otherwise throws, in this order:
 * `MissingTestDatabaseError` (missing or empty), `UnsupportedTestDatabaseUrlError` (not a URL, or
 * with a query override), `UntruncatableDatabaseError` (not local nor the CI's `postgres`) and
 * `SameAsDevelopmentDatabaseError` (the same database as a non-empty `env.DATABASE_URL`, or that one
 * cannot be parsed, so it cannot be told apart).
 */
export function resolveTestDatabaseUrl(env: TestDatabaseEnv): string {
  const url = env.TEST_DATABASE_URL;
  if (url === undefined || url.trim() === "") {
    throw new MissingTestDatabaseError();
  }
  const parsed = parseUrl(url);
  if (!parsed || QUERY_OVERRIDES.some((name) => parsed.searchParams.has(name))) {
    throw new UnsupportedTestDatabaseUrlError();
  }
  const testTarget = targetOf(parsed);
  if (!testTarget) {
    throw new UnsupportedTestDatabaseUrlError();
  }
  assertTruncatableDatabaseUrl(url);
  const development = env.DATABASE_URL;
  if (development) {
    const developmentUrl = parseUrl(development);
    const developmentTarget = developmentUrl ? targetOf(developmentUrl) : undefined;
    if (!developmentTarget || isSameTarget(testTarget, developmentTarget)) {
      throw new SameAsDevelopmentDatabaseError();
    }
  }
  return url;
}

/** Command mode: runs `args` against the test database; returns the exit code to leave with. */
export function runWithTestDatabase(args: readonly string[], env: NodeJS.ProcessEnv): number {
  const [command, ...rest] = args;
  if (command === undefined) {
    process.stderr.write("Uso: node tests/test-database.ts <comando> [argumentos…]\n");
    return 1;
  }
  let url: string;
  try {
    url = resolveTestDatabaseUrl(env);
  } catch (error) {
    // Only this module's messages, which never carry the URL; anything else is a bug: re-thrown.
    if (isTestDatabaseError(error)) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    throw error;
  }
  const result = spawnSync(command, rest, {
    stdio: "inherit",
    env: { ...env, DATABASE_URL: url },
  });
  if (result.error) {
    // The command could not start (not found, not executable): its name, never the environment.
    process.stderr.write(`No se pudo ejecutar ${command}.\n`);
    return 1;
  }
  // Killed by a signal: no exit code to pass on, so a failure.
  return result.status ?? 1;
}

function isTestDatabaseError(error: unknown): error is Error {
  return (
    error instanceof MissingTestDatabaseError ||
    error instanceof UnsupportedTestDatabaseUrlError ||
    error instanceof UntruncatableDatabaseError ||
    error instanceof SameAsDevelopmentDatabaseError
  );
}

if (import.meta.main) {
  process.exitCode = runWithTestDatabase(process.argv.slice(2), process.env);
}
