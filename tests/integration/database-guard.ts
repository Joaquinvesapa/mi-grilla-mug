/**
 * The integration suite empties tables before every test. This guard keeps it to a database on this
 * machine or the CI job's `postgres` service, so a `.env` pointing elsewhere can never be wiped.
 */
const TRUNCATABLE_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "::1",
  "postgres",
]);

export class UntruncatableDatabaseError extends Error {
  // The message states the rule, never the URL nor its credentials.
  constructor() {
    super(
      "Los tests de integración solo vacían una base local (localhost, 127.0.0.1, ::1) o el servicio `postgres` de la CI: revisá DATABASE_URL.",
    );
    this.name = "UntruncatableDatabaseError";
  }
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    // Not a URL: refused by the caller with the same rule.
    return undefined;
  }
}

/** Throws `UntruncatableDatabaseError` unless the URL's host is local or the CI service. */
export function assertTruncatableDatabaseUrl(url: string): void {
  const host = hostOf(url);
  if (host === undefined || !TRUNCATABLE_HOSTS.has(host)) {
    throw new UntruncatableDatabaseError();
  }
}
