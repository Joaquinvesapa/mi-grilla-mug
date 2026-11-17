import "server-only";

import { isAPIError } from "better-auth/api";

import {
  type EmailErrorCode,
  type NameErrorCode,
  normalizeEmail,
  PASSWORD_MAX_LENGTH,
  type PasswordErrorCode,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/account-rules";
import { getAuth } from "@/server/auth";
import { getLoginThrottle, type LoginThrottle } from "@/server/login-throttle";

export type CurrentUser = { id: string; name: string; email: string };

export type RegisterFields = { email: string; password: string; name: string };
export type SignInFields = { email: string; password: string };

export type FieldErrors = {
  email?: EmailErrorCode[];
  password?: PasswordErrorCode[];
  name?: NameErrorCode[];
};

export type ServiceUnavailable = { ok: false; code: "SERVICE_UNAVAILABLE" };

export type RegisterResult =
  | { ok: true }
  | { ok: false; code: "INVALID_INPUT"; fieldErrors: FieldErrors }
  | { ok: false; code: "EMAIL_TAKEN" }
  | ServiceUnavailable;

export type SignInResult =
  | { ok: true }
  | { ok: false; code: "INVALID_CREDENTIALS" | "LOGIN_LOCKED" }
  | ServiceUnavailable;

export type SignOutResult = { ok: true } | ServiceUnavailable;

/** The slice of Better Auth's server API these services use. */
export type AccountsAuth = {
  api: {
    signUpEmail(input: {
      body: { email: string; password: string; name: string };
      headers: Headers;
    }): Promise<unknown>;
    signInEmail(input: {
      body: { email: string; password: string; rememberMe: boolean };
      headers: Headers;
    }): Promise<unknown>;
    signOut(input: { headers: Headers }): Promise<unknown>;
    getSession(input: { headers: Headers }): Promise<{ user: CurrentUser } | null>;
  };
};

export type AccountsOptions = {
  auth: AccountsAuth;
  throttle: LoginThrottle;
  /** Receives a single line, `[accounts] SERVICE_UNAVAILABLE at=…`. Defaults to `console.error`. */
  log?: (line: string) => void;
};

export type Accounts = {
  registerAccount(fields: RegisterFields, headers: Headers): Promise<RegisterResult>;
  signIn(fields: SignInFields, headers: Headers): Promise<SignInResult>;
  signOut(headers: Headers): Promise<SignOutResult>;
  /** The signed-in user, or `null`. Throws `AccountsUnavailableError` if it cannot tell. */
  getCurrentUser(headers: Headers): Promise<CurrentUser | null>;
};

/** Thrown by `getCurrentUser` when the session cannot be checked. Carries no cause (R-08). */
export class AccountsUnavailableError extends Error {
  readonly code = "SERVICE_UNAVAILABLE";

  constructor() {
    super("No se pudo verificar la sesión.");
    this.name = "AccountsUnavailableError";
  }
}

const UNAVAILABLE: ServiceUnavailable = { ok: false, code: "SERVICE_UNAVAILABLE" };
const INVALID_CREDENTIALS: SignInResult = { ok: false, code: "INVALID_CREDENTIALS" };

/** Only the generic code and the time: never the error, the email or the password (R-08). */
function defaultLog(line: string): void {
  console.error(line);
}

/** The Better Auth error code, if the error is one of its `APIError`s. */
function apiErrorCode(error: unknown): string | undefined {
  return isAPIError(error) ? error.body?.code : undefined;
}

/** The trimmed name when every field is valid, or each field's codes. */
function validateRegistration(
  email: string,
  password: string,
  rawName: string,
): { name: string } | { fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const emailError = validateEmail(email);
  if (emailError) {
    fieldErrors.email = [emailError];
  }
  const passwordErrors = validatePassword(password);
  if (passwordErrors.length > 0) {
    fieldErrors.password = passwordErrors;
  }
  const name = validateName(rawName);
  if (typeof name === "string") {
    fieldErrors.name = [name];
  }
  if (typeof name === "string" || Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }
  return name;
}

/**
 * Accounts over Better Auth's server API, with the project's own rules and per-email lock. Every
 * expected failure is a typed code; anything else is `SERVICE_UNAVAILABLE`, logged without detail.
 */
export function createAccounts({ auth, throttle, log = defaultLog }: AccountsOptions): Accounts {
  function unavailable(): ServiceUnavailable {
    log(`[accounts] SERVICE_UNAVAILABLE at=${new Date().toISOString()}`);
    return UNAVAILABLE;
  }

  return {
    async registerAccount(fields, headers) {
      // Revalidated here whatever the form did (R-07); only these three fields go on.
      const email = normalizeEmail(fields.email);
      const { password } = fields;
      const valid = validateRegistration(email, password, fields.name);
      if ("fieldErrors" in valid) {
        return { ok: false, code: "INVALID_INPUT", fieldErrors: valid.fieldErrors };
      }
      try {
        await auth.api.signUpEmail({ body: { email, password, name: valid.name }, headers });
        return { ok: true };
      } catch (error) {
        const code = apiErrorCode(error);
        if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          return { ok: false, code: "EMAIL_TAKEN" };
        }
        if (code === "INVALID_EMAIL") {
          // Better Auth's own email check is stricter in corner cases (`ana@mail..com`).
          return { ok: false, code: "INVALID_INPUT", fieldErrors: { email: ["INVALID_EMAIL"] } };
        }
        return unavailable();
      }
    },

    async signIn(fields, headers) {
      const email = normalizeEmail(fields.email);
      const { password } = fields;
      // Malformed input gets the same answer as a wrong password, without reserving nor hashing.
      // The 254-character limit is part of validateEmail.
      if (
        validateEmail(email) !== null ||
        password.length === 0 ||
        password.length > PASSWORD_MAX_LENGTH
      ) {
        return INVALID_CREDENTIALS;
      }
      try {
        // Checked before the password: a locked email never reaches the hash (R-01).
        const reserved = await throttle.reserve(email);
        if (!reserved.ok) {
          return reserved;
        }
        try {
          await auth.api.signInEmail({ body: { email, password, rememberMe: true }, headers });
        } catch (error) {
          const code = apiErrorCode(error);
          if (code !== "INVALID_EMAIL_OR_PASSWORD" && code !== "INVALID_EMAIL") {
            return unavailable();
          }
          // Unknown emails count too, and get the very same answer (R-09, NFR-04).
          await throttle.recordFailure(email);
          return INVALID_CREDENTIALS;
        }
      } catch {
        // The throttle's database failed: nothing was verified.
        return unavailable();
      }
      try {
        await throttle.clear(email);
      } catch {
        // The session is already created; the leftover row only expires with its window.
        unavailable();
      }
      return { ok: true };
    },

    async signOut(headers) {
      try {
        // Deletes the session row and expires the cookie (through nextCookies()).
        await auth.api.signOut({ headers });
        return { ok: true };
      } catch {
        return unavailable();
      }
    },

    async getCurrentUser(headers) {
      let session: { user: CurrentUser } | null;
      try {
        // Null without a cookie, with a bad signature, or for an expired session (deleted here).
        session = await auth.api.getSession({ headers });
      } catch {
        unavailable();
        throw new AccountsUnavailableError();
      }
      if (!session) {
        return null;
      }
      const { id, name, email } = session.user;
      return { id, name, email };
    },
  };
}

let sharedAccounts: Accounts | undefined;

/** The process-wide services, over the shared Better Auth instance and login throttle. */
export function getAccounts(): Accounts {
  sharedAccounts ??= createAccounts({ auth: getAuth(), throttle: getLoginThrottle() });
  return sharedAccounts;
}
