import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/account-rules";
import { getDb } from "@/server/db";
import type { PrismaClient } from "@/server/generated/prisma/client";
import { sessionCookieOptions } from "@/server/session-cookie";

/** 30 days in seconds: fixed, never extended by use (FR-07, R-14). */
const SESSION_EXPIRES_IN_S = 2_592_000;
const SECRET_MIN_LENGTH = 32;
const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

export class AuthConfigError extends Error {
  readonly code = "AUTH_CONFIG_INVALID";

  // The message names the variables, never their values (R-13).
  constructor() {
    super(
      "BETTER_AUTH_SECRET (32 caracteres o más) o BETTER_AUTH_URL (http: o https:) falta o no es válida.",
    );
    this.name = "AuthConfigError";
  }
}

export type AuthEnv = { secret: string; baseUrl: string };

/** Validates the two Better Auth variables, or throws `AuthConfigError` without echoing them. */
export function readAuthEnv(env: Record<string, string | undefined>): AuthEnv {
  const secret = env.BETTER_AUTH_SECRET ?? "";
  const baseUrl = env.BETTER_AUTH_URL ?? "";
  if (secret.length < SECRET_MIN_LENGTH || !isHttpUrl(baseUrl)) {
    throw new AuthConfigError();
  }
  return { secret, baseUrl };
}

function isHttpUrl(value: string): boolean {
  try {
    return HTTP_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    // Not a URL at all: the same configuration error, reported by the caller.
    return false;
  }
}

/** Only the generic code and the time: Better Auth's message may carry emails or URLs (R-08). */
function defaultLog(line: string): void {
  console.error(line);
}

export type AuthOptionsInput = {
  db: PrismaClient;
  secret: string;
  baseUrl: string;
  /** Receives a single line, `[auth] AUTH_INTERNAL_ERROR at=…`. Defaults to `console.error`. */
  log?: (line: string) => void;
};

/** Better Auth's configuration, pure over its inputs: the database is injected. */
export function createAuthOptions({ db, secret, baseUrl, log = defaultLog }: AuthOptionsInput) {
  const cookie = sessionCookieOptions(baseUrl);
  return {
    secret,
    baseURL: baseUrl,
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      // The same limits the account rules apply, from the same constants.
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_S,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    telemetry: { enabled: false },
    logger: {
      disabled: false,
      level: "error",
      // The message and its arguments are dropped on purpose (R-08).
      log: (_level: string, _message: string, ..._args: unknown[]) => {
        log(`[auth] AUTH_INTERNAL_ERROR at=${new Date().toISOString()}`);
      },
    },
    advanced: {
      cookiePrefix: cookie.cookiePrefix,
      useSecureCookies: cookie.secure,
    },
    // nextCookies() has to be the last plugin: it writes the Set-Cookie of every other one.
    plugins: [nextCookies()],
  } satisfies BetterAuthOptions;
}

function createAuth() {
  const { secret, baseUrl } = readAuthEnv(process.env);
  return betterAuth(createAuthOptions({ db: getDb(), secret, baseUrl }));
}

export type Auth = ReturnType<typeof createAuth>;

// Kept on globalThis, like getDb(), so dev hot reloads reuse one instance per process.
const AUTH_KEY = Symbol.for("mi-grilla.auth");
type AuthHolder = { [AUTH_KEY]?: Auth };
const holder = globalThis as typeof globalThis & AuthHolder;

/**
 * The process-wide Better Auth instance, created on first use — when a page renders or a Server
 * Action runs, never while `next build` collects pages — after validating its variables.
 */
export function getAuth(): Auth {
  const existing = holder[AUTH_KEY];
  if (existing) {
    return existing;
  }
  const auth = createAuth();
  holder[AUTH_KEY] = auth;
  return auth;
}
