import { type NextRequest, NextResponse } from "next/server";

import { hasSessionCookie } from "@/server/session-cookie";

/**
 * Optimistic gate for `/` (FR-09): without a session cookie the request is sent to /login (307)
 * before anything renders. It only reads the `cookie` header — no database, no signature check. A
 * made-up, expired or closed-session cookie gets through here and is turned away by the page,
 * which verifies the session for real (R-15). The destination is always /login, with no return
 * parameter (R-16).
 */
export function proxy(request: NextRequest): NextResponse {
  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

// Only `/`: /api/health, /serwist/*, /~offline, /demo, /login, /register and the static files never
// go through the proxy.
export const config = {
  matcher: ["/"],
};
