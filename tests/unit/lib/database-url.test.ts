import { describe, expect, it } from "vitest";

import * as lib from "@/lib/database-url";
import * as server from "@/server/database-url";

function codeOf(url: string): unknown {
  try {
    lib.assertSafeDatabaseUrl(url);
  } catch (error) {
    return error instanceof lib.UnsafeDatabaseUrlError ? error.code : error;
  }
  return undefined;
}

describe("src/lib/database-url", () => {
  it("test-database-url-lib-invalid: rejects mysql:// and a remote host without TLS, accepts a local one; src/server re-exports the same functions", () => {
    expect(codeOf("mysql://u:p@127.0.0.1:3306/db")).toBe("INVALID_URL");
    expect(codeOf("postgresql://u:p@db.example.com:5432/db")).toBe("TLS_REQUIRED");
    expect(codeOf("postgresql://u:p@127.0.0.1:5432/db")).toBeUndefined();

    // The server module is the same check behind `server-only`, not a copy that could drift.
    expect(server.assertSafeDatabaseUrl).toBe(lib.assertSafeDatabaseUrl);
    expect(server.UnsafeDatabaseUrlError).toBe(lib.UnsafeDatabaseUrlError);
  });

  it("never puts the URL in the error message", () => {
    let message = "";
    try {
      lib.assertSafeDatabaseUrl("postgresql://u:s3cr3t@db.example.com:5432/db");
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }

    expect(message).not.toBe("");
    expect(message).not.toContain("s3cr3t");
    expect(message).not.toContain("db.example.com");
  });
});
