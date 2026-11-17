import { afterEach, describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => ({ marker: "fake-prisma-client" }));
const getDb = vi.hoisted(() => vi.fn(() => fakeDb));
const betterAuth = vi.hoisted(() => vi.fn((options: unknown) => ({ options, api: {} })));
// Still returns a function, like the real adapter factory, so the options keep their shape.
const prismaAdapter = vi.hoisted(() => vi.fn((_db: unknown, _config: unknown) => () => ({})));

vi.mock("@/server/db", () => ({ getDb }));
// getAuth() must never run Better Auth's async init against a fake client in a unit test.
vi.mock("better-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth")>()),
  betterAuth,
}));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter }));
// Sentinel lengths: if auth.ts kept its own literals (8/128) instead of importing the rules'
// constants, the options would not follow them (single source).
vi.mock("@/lib/account-rules", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/account-rules")>()),
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_MAX_LENGTH: 64,
}));

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/account-rules";
import { AuthConfigError, createAuthOptions, getAuth, readAuthEnv } from "@/server/auth";

// Tests may not import the generated client (no-restricted-imports): take its type from the signature.
type PrismaClient = Parameters<typeof createAuthOptions>[0]["db"];

const SECRET = "x".repeat(32);
const BASE_URL = "http://localhost:3000";
const ISO_INSTANT = /^\[auth\] AUTH_INTERNAL_ERROR at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function options(overrides: { baseUrl?: string; log?: (line: string) => void } = {}) {
  return createAuthOptions({
    db: fakeDb as unknown as PrismaClient,
    secret: SECRET,
    baseUrl: overrides.baseUrl ?? BASE_URL,
    log: overrides.log ?? (() => {}),
  });
}

function rejection(env: Record<string, string | undefined>): unknown {
  try {
    readAuthEnv(env);
  } catch (error) {
    return error;
  }
  return undefined;
}

// getAuth() keeps its instance on globalThis under this key, like getDb().
const AUTH_KEY = Symbol.for("mi-grilla.auth");

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[AUTH_KEY];
  vi.unstubAllEnvs();
  getDb.mockClear();
  betterAuth.mockClear();
  prismaAdapter.mockClear();
});

describe("createAuthOptions", () => {
  it("test-auth-options-session: fixed 30-day session, no refresh, no cookie cache, no telemetry", () => {
    const authOptions = options();

    expect(authOptions.session.expiresIn).toBe(2_592_000);
    expect(authOptions.session.disableSessionRefresh).toBe(true);
    expect(authOptions.session.cookieCache.enabled).toBe(false);
    expect(authOptions.telemetry.enabled).toBe(false);
  });

  it("test-auth-options-session: email and password with auto sign-in and the rules' length limits", () => {
    expect(options().emailAndPassword).toEqual({
      enabled: true,
      autoSignIn: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    });
  });

  it("test-auth-options-session: nextCookies is the last plugin", () => {
    const { plugins } = options();

    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins.at(-1)?.id).toBe("next-cookies");
  });

  it("test-auth-options-session: passes the secret, the base URL and a Prisma adapter", () => {
    const authOptions = options();

    expect(authOptions.secret).toBe(SECRET);
    expect(authOptions.baseURL).toBe(BASE_URL);
    expect(typeof authOptions.database).toBe("function");
    expect(prismaAdapter).toHaveBeenCalledTimes(1);
    expect(prismaAdapter).toHaveBeenCalledWith(fakeDb, {
      provider: "postgresql",
      transaction: true,
    });
  });

  it("test-auth-options-session: secure cookies only over https", () => {
    expect(options({ baseUrl: "https://mi-grilla.example.com" }).advanced.useSecureCookies).toBe(
      true,
    );
    expect(options({ baseUrl: BASE_URL }).advanced.useSecureCookies).toBe(false);
  });
});

describe("the Better Auth logger", () => {
  it("test-auth-logger-no-message: emits only the code and the time, never the message", () => {
    const log = vi.fn<(line: string) => void>();
    const { logger } = options({ log });
    const message =
      "Failed to create user: connect to postgresql://grilla_user:s3cr3t-pass@db.example.com:5432/mi_grilla";
    const password = "festival2026";

    expect(logger.disabled).toBe(false);
    expect(logger.level).toBe("error");
    logger.log("error", message, { password });

    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0]?.[0] ?? "";
    expect(line).toMatch(ISO_INSTANT);
    expect(line).not.toContain("postgresql://");
    expect(line).not.toContain("s3cr3t-pass");
    expect(line).not.toContain(password);
  });

  it("test-auth-logger-no-message: writes to console.error by default", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { logger } = createAuthOptions({
      db: fakeDb as unknown as PrismaClient,
      secret: SECRET,
      baseUrl: BASE_URL,
    });

    logger.log("error", "boom with a password=festival2026");

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0]?.[0])).toMatch(ISO_INSTANT);
    expect(errorLog.mock.calls[0]).toHaveLength(1);
    errorLog.mockRestore();
  });
});

describe("readAuthEnv", () => {
  it("returns the secret and the base URL when both are valid", () => {
    expect(readAuthEnv({ BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: BASE_URL })).toEqual({
      secret: SECRET,
      baseUrl: BASE_URL,
    });
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["31 characters", "s".repeat(31)],
  ])(
    "test-auth-secret-invalid: rejects a %s secret with AUTH_CONFIG_INVALID, without the value",
    (_case, secret) => {
      const error = rejection({ BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: BASE_URL });

      expect(error).toBeInstanceOf(AuthConfigError);
      expect((error as AuthConfigError).code).toBe("AUTH_CONFIG_INVALID");
      if (secret) {
        expect((error as AuthConfigError).message).not.toContain(secret);
      }
    },
  );

  it.each([
    ["missing", undefined],
    ["ftp:", "ftp://localhost:3000"],
    ["not a URL", "localhost:3000"],
  ])("test-auth-url-invalid: rejects a %s URL with AUTH_CONFIG_INVALID", (_case, url) => {
    const error = rejection({ BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: url });

    expect(error).toBeInstanceOf(AuthConfigError);
    expect((error as AuthConfigError).code).toBe("AUTH_CONFIG_INVALID");
    expect((error as AuthConfigError).message).not.toContain(SECRET);
    if (url) {
      expect((error as AuthConfigError).message).not.toContain(url);
    }
  });

  it("test-auth-url-invalid: accepts an https URL", () => {
    expect(
      readAuthEnv({ BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: "https://mi-grilla.example.com" })
        .baseUrl,
    ).toBe("https://mi-grilla.example.com");
  });
});

describe("getAuth", () => {
  it("creates the instance on first use, over the shared client, and reuses it", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    vi.stubEnv("BETTER_AUTH_URL", BASE_URL);

    const first = getAuth();
    const second = getAuth();

    expect(second).toBe(first);
    expect(betterAuth).toHaveBeenCalledTimes(1);
    expect(getDb).toHaveBeenCalledTimes(1);
    expect(betterAuth.mock.calls[0]?.[0]).toMatchObject({ secret: SECRET, baseURL: BASE_URL });
  });

  it("throws AUTH_CONFIG_INVALID before touching the database when the env is invalid", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "short");
    vi.stubEnv("BETTER_AUTH_URL", BASE_URL);

    expect(() => getAuth()).toThrow(AuthConfigError);
    expect(getDb).not.toHaveBeenCalled();
    expect(betterAuth).not.toHaveBeenCalled();
  });
});
