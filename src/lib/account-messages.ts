/**
 * The Spanish texts for the account codes of `src/server/accounts.ts`, and the state the sign-in
 * and sign-up forms render. Pure: no I/O. The server only ever returns codes; the text is chosen
 * here, so no message from Better Auth, Prisma or `pg` can reach the screen (R-08).
 */

import {
  LOGIN_LOCK_MINUTES,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/account-rules";

export type FormField = "email" | "password" | "name";

/** A failed result from the account services, or any failure shaped like one. */
export type FormFailure = {
  ok: false;
  code: string;
  fieldErrors?: Partial<Record<FormField, readonly string[]>>;
};

/** What the forms show: never the password, which is not echoed back (audit finding 4). */
export type AuthFormState = {
  /** The general message (`role="alert"`), or `null` when the errors belong to fields. */
  formError: string | null;
  /** Every message of each failing field, in the order the server listed the codes. */
  fieldErrors: Partial<Record<FormField, string[]>>;
  /** What the person had typed, to fill the fields again. */
  values: { email: string; name: string };
};

export type AuthFormAction = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;

export const INITIAL_FORM_STATE: AuthFormState = {
  formError: null,
  fieldErrors: {},
  values: { email: "", name: "" },
};

/** Every code the account services can return, each with its text in the catalog below. */
export type AccountMessageCode =
  | "INVALID_EMAIL"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_NEEDS_LETTER"
  | "PASSWORD_NEEDS_NUMBER"
  | "NAME_EMPTY"
  | "NAME_TOO_LONG"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "LOGIN_LOCKED"
  | "SERVICE_UNAVAILABLE";

// The numbers come from the rules themselves, so a text cannot drift from what is enforced.
const CATALOG = {
  INVALID_EMAIL: "Ese email no es válido.",
  PASSWORD_TOO_SHORT: `La contraseña tiene que tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  PASSWORD_TOO_LONG: `La contraseña puede tener hasta ${PASSWORD_MAX_LENGTH} caracteres.`,
  PASSWORD_NEEDS_LETTER: "La contraseña tiene que incluir al menos una letra.",
  PASSWORD_NEEDS_NUMBER: "La contraseña tiene que incluir al menos un número.",
  NAME_EMPTY: "Escribí tu nombre.",
  NAME_TOO_LONG: `El nombre puede tener hasta ${NAME_MAX_LENGTH} caracteres.`,
  EMAIL_TAKEN: "Ese email ya está registrado.",
  INVALID_CREDENTIALS: "Email o contraseña incorrectos",
  LOGIN_LOCKED: `Bloqueamos el acceso a este email por ${LOGIN_LOCK_MINUTES} minutos por demasiados intentos. Probá más tarde.`,
  SERVICE_UNAVAILABLE: "No pudimos completar el pedido. Probá de nuevo en un rato.",
} as const satisfies Record<AccountMessageCode, string>;

// A Map, so `toString` or `__proto__` are not catalog entries.
const MESSAGES: ReadonlyMap<string, string> = new Map(Object.entries(CATALOG));

/** The help under the sign-up password field: the same rules `validatePassword` applies. */
export const PASSWORD_HINT = `Al menos ${PASSWORD_MIN_LENGTH} caracteres, con una letra y un número.`;

const FIELDS: readonly FormField[] = ["email", "password", "name"];

/** The catalog text for a code; anything outside the catalog reads as `SERVICE_UNAVAILABLE`. */
export function messageFor(code: string): string {
  return MESSAGES.get(code) ?? CATALOG.SERVICE_UNAVAILABLE;
}

/**
 * The form state for a failed result. `INVALID_INPUT` puts each message under its field; any other
 * code is one general message. Only the email and the name are echoed back, never the password.
 */
export function toFormState(
  result: FormFailure,
  values: Readonly<Partial<Record<string, string>>>,
): AuthFormState {
  const echoed = { email: values.email ?? "", name: values.name ?? "" };
  if (result.code !== "INVALID_INPUT") {
    return { formError: messageFor(result.code), fieldErrors: {}, values: echoed };
  }
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  for (const field of FIELDS) {
    const codes = result.fieldErrors?.[field];
    if (codes && codes.length > 0) {
      fieldErrors[field] = codes.map(messageFor);
    }
  }
  // Never a silent failure: without a single field to point at, it falls back to the generic text.
  const formError = Object.keys(fieldErrors).length > 0 ? null : messageFor(result.code);
  return { formError, fieldErrors, values: echoed };
}
