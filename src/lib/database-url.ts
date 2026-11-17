// Pure check, no I/O and no `server-only`: the seed (`prisma/seed.ts`, run by plain Node) uses it
// too. Server code imports it through `src/server/database-url.ts`.

const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set(["postgresql:", "postgres:"]);

/**
 * Hosts reachable without leaving the machine, plus the CI's Postgres service container. Written as
 * `URL.hostname` returns them (IPv6 keeps its brackets).
 */
const TRUSTED_PLAINTEXT_HOSTS: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "postgres",
]);

/** `sslmode` values that refuse to fall back to plaintext. */
const TLS_SSL_MODES: ReadonlySet<string> = new Set(["require", "verify-ca", "verify-full"]);

/**
 * Query parameters that `pg` reads as the server address instead of the URL's host: allowing them
 * would validate one host and connect to another.
 */
const HOST_OVERRIDE_PARAMS: readonly string[] = ["host", "hostaddr"];

export type UnsafeDatabaseUrlCode = "INVALID_URL" | "TLS_REQUIRED";

// Messages never carry the URL: it holds the database user and password (R-07).
const MESSAGES: Readonly<Record<UnsafeDatabaseUrlCode, string>> = {
  INVALID_URL:
    "DATABASE_URL no es una URL postgresql:// válida, o es ambigua (host en la query o sslmode repetido).",
  TLS_REQUIRED: "DATABASE_URL apunta a un host remoto sin sslmode=require.",
};

export class UnsafeDatabaseUrlError extends Error {
  readonly code: UnsafeDatabaseUrlCode;

  constructor(code: UnsafeDatabaseUrlCode) {
    super(MESSAGES[code]);
    this.name = "UnsafeDatabaseUrlError";
    this.code = code;
  }
}

/**
 * Throws `UnsafeDatabaseUrlError` unless `url` is a `postgresql://` (or `postgres://`) URL that is
 * either local or requires TLS (R-04).
 *
 * Ambiguous URLs are `INVALID_URL`, whatever the host: a `host`/`hostaddr` query parameter (pg
 * connects there, not to the host checked here) or a repeated `sslmode` (pg keeps the last one).
 */
export function assertSafeDatabaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // The parser's message would echo the URL back; the code is all the caller needs.
    throw new UnsafeDatabaseUrlError("INVALID_URL");
  }

  const { searchParams } = parsed;
  if (
    !POSTGRES_PROTOCOLS.has(parsed.protocol) ||
    parsed.hostname === "" ||
    HOST_OVERRIDE_PARAMS.some((param) => searchParams.has(param)) ||
    searchParams.getAll("sslmode").length > 1
  ) {
    throw new UnsafeDatabaseUrlError("INVALID_URL");
  }

  const isTrustedHost = TRUSTED_PLAINTEXT_HOSTS.has(parsed.hostname.toLowerCase());
  const sslMode = searchParams.get("sslmode");
  if (!isTrustedHost && (sslMode === null || !TLS_SSL_MODES.has(sslMode))) {
    throw new UnsafeDatabaseUrlError("TLS_REQUIRED");
  }
}
