// Shared checks for values read back from the device's `localStorage`, which is untrusted (R-02,
// R-04). Pure. Both `offline-selection.ts` and `group-picks.ts` use them; living here, neither has
// to import the other's values (`offline-selection.ts` imports `group-picks.ts`, never the reverse).

/** A future format bumps this, and every stored value of another version is ignored. */
export const FORMAT_VERSION = 1;

/** The longest user id accepted, here and by `saveSelectionAction` as `expectedUserId`. */
export const USER_ID_MAX_LENGTH = 64;
/** A visible name, the user's or a friend's, in UTF-16 units. */
export const USER_NAME_MAX_LENGTH = 100;

type Fields = Record<string, unknown>;

export function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The parsed JSON, or `null` when there is nothing stored or it is malformed. */
export function parseJson(raw: string | null): unknown {
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Malformed JSON is the same as nothing stored: the caller only needs the `null`.
    return null;
  }
}

export function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}
