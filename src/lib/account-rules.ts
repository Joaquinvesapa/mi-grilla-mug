/**
 * Account rules shared by the server (which revalidates everything) and the UI messages. Pure: no
 * I/O. Every function returns codes; the Spanish texts live in the message catalog.
 */

export type EmailErrorCode = "INVALID_EMAIL";

export type PasswordErrorCode =
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_NEEDS_LETTER"
  | "PASSWORD_NEEDS_NUMBER";

export type NameErrorCode = "NAME_EMPTY" | "NAME_TOO_LONG";

export const EMAIL_MAX_LENGTH = 254;
// Counted in UTF-16 code units, as Better Auth counts them (`minPasswordLength`/`maxPasswordLength`).
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 40;
/**
 * How long a locked email stays locked, and the window its attempts are counted in (FR-10): shown
 * in the lock message, and the source of the server's own durations (`login-throttle.ts`).
 */
export const LOGIN_LOCK_MINUTES = 15;

const WHITESPACE = /\s/u;
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;

/** Trims and lowercases, so `" Ana@Mail.com "` and `"ana@mail.com"` are the same account. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * `local@domain.tld` on an already normalized email: up to 254 characters, no whitespace, exactly
 * one `@`, a non-empty local part, and a domain with at least one dot and none at either end.
 */
export function validateEmail(email: string): EmailErrorCode | null {
  if (email.length > EMAIL_MAX_LENGTH || WHITESPACE.test(email)) {
    return "INVALID_EMAIL";
  }
  const parts = email.split("@");
  if (parts.length !== 2) {
    return "INVALID_EMAIL";
  }
  const [local = "", domain = ""] = parts;
  if (local === "" || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "INVALID_EMAIL";
  }
  return null;
}

/** Every rule the password breaks, in a fixed order; an empty list means it is valid. Never trimmed. */
export function validatePassword(password: string): PasswordErrorCode[] {
  const codes: PasswordErrorCode[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    codes.push("PASSWORD_TOO_SHORT");
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    codes.push("PASSWORD_TOO_LONG");
  }
  if (!LETTER.test(password)) {
    codes.push("PASSWORD_NEEDS_LETTER");
  }
  if (!DIGIT.test(password)) {
    codes.push("PASSWORD_NEEDS_NUMBER");
  }
  return codes;
}

/** The trimmed name, or the rule it breaks: 1 to 40 characters after the trim. */
export function validateName(raw: string): { name: string } | NameErrorCode {
  const name = raw.trim();
  if (name === "") {
    return "NAME_EMPTY";
  }
  if (name.length > NAME_MAX_LENGTH) {
    return "NAME_TOO_LONG";
  }
  return { name };
}

/**
 * Reads the given keys as strings. Anything else — a `File`, or a missing key — reads as `""`, so
 * validation rejects it as a missing field instead of crashing on an unexpected type.
 */
export function readFormFields<K extends string>(
  formData: FormData,
  keys: readonly K[],
): Record<K, string> {
  const fields = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    fields[key] = typeof value === "string" ? value : "";
  }
  return fields;
}
