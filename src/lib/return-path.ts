/**
 * The only destination `/login` and `/register` go back to after signing in (FR-07, ADR-006):
 * an invitation. Pure: no I/O. Shared by the proxy, both pages and the account actions, so the
 * allow-list is one and the same everywhere (R-10).
 */
import { INVITE_TOKEN_PATTERN } from "@/lib/group-rules";

const INVITATION_PREFIX = "/invitacion/";

/**
 * `value` itself only when it is a string that is exactly `/invitacion/<43 base64url chars>`;
 * anything else — another route, an external or protocol-relative URL, a backslash, spaces, an
 * encoded path, an array from a repeated query key — is `null`. No decoding and no normalizing: a
 * value is accepted as it came or not at all.
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(INVITATION_PREFIX)) {
    return null;
  }
  return INVITE_TOKEN_PATTERN.test(value.slice(INVITATION_PREFIX.length)) ? value : null;
}

/**
 * `/login` or `/register` carrying an already validated destination in `next`, encoded by
 * `URLSearchParams`; without one, the bare path.
 */
export function withReturnPath(path: "/login" | "/register", next: string | null): string {
  return next === null ? path : `${path}?${new URLSearchParams({ next })}`;
}
