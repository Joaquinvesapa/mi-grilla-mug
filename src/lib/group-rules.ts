/**
 * Group rules shared by the server (which validates everything) and the screens. Pure: no I/O.
 */

/** In code points, the unit `varchar(40)` counts in PostgreSQL (not UTF-16 units). */
export const GROUP_NAME_MAX_LENGTH = 40;
/** FR-02 (decisión del usuario, 2026-11-16). */
export const MAX_GROUP_MEMBERS = 20;
export const MAX_GROUPS_PER_USER = 10;
/** A link works while `now < created_at + 72 h` (FR-03, NFR-01). */
export const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
/** 32 random bytes in base64url without padding: exactly 43 characters (ADR-006). */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** A group id as `crypto.randomUUID` writes it: lowercase hex, version 4. */
export const GROUP_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/**
 * A user id, as a group's screen sends it to remove a member: Better Auth writes 32 alphanumeric
 * characters, and the integration tests use short literal ids.
 */
export const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const LOCALE = "es-AR";
const WORD_SEPARATOR = /\s+/u;
const GRAPHEMES = new Intl.Segmenter(LOCALE, { granularity: "grapheme" });

/** The trimmed name if it has 1 to 40 code points, or `null` (anything but a string included). */
export function normalizeGroupName(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const name = raw.trim();
  const length = Array.from(name).length;
  return length >= 1 && length <= GROUP_NAME_MAX_LENGTH ? name : null;
}

function graphemes(word: string): string[] {
  return Array.from(GRAPHEMES.segment(word), (part) => part.segment);
}

/**
 * Two initials for a visible name: the first letter of the first and of the last word, or the first
 * two graphemes of a single word, in uppercase. "Ana Pérez" → "AP", "Bruno" → "BR".
 */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(WORD_SEPARATOR)
    .filter((word) => word !== "");
  const first = words[0];
  if (first === undefined) {
    return "";
  }
  const last = words.at(-1) ?? first;
  const letters =
    words.length >= 2
      ? [graphemes(first)[0] ?? "", graphemes(last)[0] ?? ""]
      : graphemes(first).slice(0, 2);
  return letters.join("").toLocaleUpperCase(LOCALE);
}
