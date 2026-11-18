import { type NextRequest, NextResponse } from "next/server";

import { safeReturnPath, withReturnPath } from "@/lib/return-path";
import { hasSessionCookie } from "@/server/session-cookie";

/**
 * Optimistic gate for `/`, `/grupos` and `/invitacion` (FR-09 of FEAT-002, FR-07 of FEAT-006a):
 * without a session cookie the request is sent to /login (307) before anything renders. It only
 * reads the `cookie` header — no database, no signature check. A made-up, expired or closed-session
 * cookie gets through here and is turned away by the page, which verifies the session for real
 * (R-15). The only return destination is an invitation, `/login?next=/invitacion/<token>`, and only
 * when the path passes `safeReturnPath`; the request's own query never travels, and everything else
 * goes to a bare /login. This narrows R-16 of FEAT-002 ("no return parameter") to that single
 * allow-listed destination instead of reopening it (R-10 of FEAT-006a, ADR-006).
 */
export function proxy(request: NextRequest): NextResponse {
  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }
  const next = safeReturnPath(request.nextUrl.pathname);
  return NextResponse.redirect(new URL(withReturnPath("/login", next), request.url));
}

// `/`, `/grupos/*` and `/invitacion/*`: /api/health, /serwist/*, /~offline, /demo, /login,
// /register and the static files never go through the proxy.
export const config = {
  matcher: ["/", "/grupos/:path*", "/invitacion/:path*"],
};
