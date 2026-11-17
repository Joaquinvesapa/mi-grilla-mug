import "server-only";

import { getSessionCookie } from "better-auth/cookies";

/**
 * The single source of the session cookie's name, shared by `auth.ts` (which hands it to Better
 * Auth) and the proxy (which only checks it exists), so the two cannot drift apart (R-15).
 */
const COOKIE_PREFIX = "better-auth";
const SESSION_TOKEN_COOKIE = "session_token";
const SECURE_PREFIX = "__Secure-";

export type SessionCookieOptions = {
  /** Better Auth's `advanced.cookiePrefix`. */
  cookiePrefix: string;
  /** Better Auth's `advanced.useSecureCookies`: `Secure` attribute and `__Secure-` prefix. */
  secure: boolean;
  /** The full name the browser stores. */
  sessionCookieName: string;
};

/** Over `https:` the cookie is `Secure` and carries `__Secure-`; over `http:` (local), neither. */
export function sessionCookieOptions(baseUrl: string): SessionCookieOptions {
  const secure = baseUrl.startsWith("https:");
  const name = `${COOKIE_PREFIX}.${SESSION_TOKEN_COOKIE}`;
  return {
    cookiePrefix: COOKIE_PREFIX,
    secure,
    sessionCookieName: secure ? `${SECURE_PREFIX}${name}` : name,
  };
}

/**
 * Optimistic check: whether the request carries a session cookie at all. It does not verify the
 * signature nor the session; that is `getCurrentUser()`'s job in the page.
 */
export function hasSessionCookie(request: Request | Headers): boolean {
  return (
    getSessionCookie(request, {
      cookiePrefix: COOKIE_PREFIX,
      cookieName: SESSION_TOKEN_COOKIE,
    }) !== null
  );
}
