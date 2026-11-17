import { describe, expect, it } from "vitest";

import { assertSafeDatabaseUrl, UnsafeDatabaseUrlError } from "@/server/database-url";

const SECRET = "s3cr3t-pass";

function rejection(url: string): unknown {
  try {
    assertSafeDatabaseUrl(url);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("assertSafeDatabaseUrl", () => {
  it.each([
    ["localhost", `postgresql://grilla_user:${SECRET}@localhost:5432/mi_grilla`],
    ["127.0.0.1", `postgresql://grilla_user:${SECRET}@127.0.0.1:5432/mi_grilla`],
    ["::1", `postgresql://grilla_user:${SECRET}@[::1]:5432/mi_grilla`],
    [
      "the CI service host `postgres`",
      `postgresql://grilla_user:${SECRET}@postgres:5432/mi_grilla`,
    ],
  ])("accepts %s without TLS", (_host, url) => {
    expect(() => assertSafeDatabaseUrl(url)).not.toThrow();
  });

  it("accepts a remote host with sslmode=require", () => {
    expect(() =>
      assertSafeDatabaseUrl(
        `postgresql://grilla_user:${SECRET}@db.example.com:5432/mi_grilla?sslmode=require`,
      ),
    ).not.toThrow();
  });

  it("rejects a remote host without sslmode", () => {
    const error = rejection(`postgresql://grilla_user:${SECRET}@db.example.com:5432/mi_grilla`);

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    expect((error as UnsafeDatabaseUrlError).code).toBe("TLS_REQUIRED");
  });

  it("rejects a remote host with a weaker sslmode", () => {
    const error = rejection(
      `postgresql://grilla_user:${SECRET}@10.0.0.8:5432/mi_grilla?sslmode=prefer`,
    );

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    expect((error as UnsafeDatabaseUrlError).code).toBe("TLS_REQUIRED");
  });

  it("accepts postgres:// under the same rules: local without TLS", () => {
    expect(() =>
      assertSafeDatabaseUrl(`postgres://grilla_user:${SECRET}@127.0.0.1:5432/mi_grilla`),
    ).not.toThrow();
  });

  it("accepts postgres:// under the same rules: remote with sslmode=require", () => {
    expect(() =>
      assertSafeDatabaseUrl(
        `postgres://grilla_user:${SECRET}@db.example.com:5432/mi_grilla?sslmode=require`,
      ),
    ).not.toThrow();
  });

  it("rejects postgres:// to a remote host without sslmode", () => {
    const error = rejection(`postgres://grilla_user:${SECRET}@db.example.com:5432/mi_grilla`);

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    expect((error as UnsafeDatabaseUrlError).code).toBe("TLS_REQUIRED");
  });

  // pg-connection-string lets `?host=` override the URL's host: a local-looking URL would connect
  // to a remote server without TLS.
  it.each([
    ["host", `postgresql://grilla_user:${SECRET}@localhost:5432/mi_grilla?host=db.example.com`],
    [
      "hostaddr",
      `postgresql://grilla_user:${SECRET}@localhost:5432/mi_grilla?hostaddr=203.0.113.7`,
    ],
    [
      "host on a remote URL with TLS",
      `postgres://grilla_user:${SECRET}@db.example.com/mi_grilla?sslmode=require&host=evil.example.com`,
    ],
  ])("rejects a %s query parameter that overrides the host", (_param, url) => {
    const error = rejection(url);

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    expect((error as UnsafeDatabaseUrlError).code).toBe("INVALID_URL");
  });

  // pg keeps the last value: `require&disable` ends up as `ssl: false`.
  it.each([
    ["require then disable", "sslmode=require&sslmode=disable"],
    ["require twice", "sslmode=require&sslmode=require"],
  ])("rejects a repeated sslmode (%s)", (_case, query) => {
    const error = rejection(
      `postgresql://grilla_user:${SECRET}@db.example.com:5432/mi_grilla?${query}`,
    );

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    expect((error as UnsafeDatabaseUrlError).code).toBe("INVALID_URL");
  });

  it("rejects a URL that is not postgresql:// nor postgres://", () => {
    const error = rejection(`mysql://grilla_user:${SECRET}@localhost:3306/mi_grilla`);

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    expect((error as UnsafeDatabaseUrlError).code).toBe("INVALID_URL");
  });

  it("rejects a string that is not a URL", () => {
    const error = rejection("not a url");

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    expect((error as UnsafeDatabaseUrlError).code).toBe("INVALID_URL");
  });

  it("never puts the URL, the user or the password in the error message", () => {
    const error = rejection(`postgresql://grilla_user:${SECRET}@db.example.com:5432/mi_grilla`);

    expect(error).toBeInstanceOf(UnsafeDatabaseUrlError);
    const message = (error as Error).message;
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain("db.example.com");
    expect(message).not.toContain("grilla_user");
  });
});
