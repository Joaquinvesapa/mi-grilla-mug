import { APIError } from "better-auth/api";
import { afterEach, describe, expect, it, vi } from "vitest";

const sharedApi = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInEmail: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));
const sharedThrottle = vi.hoisted(() => ({
  reserve: vi.fn(),
  recordFailure: vi.fn(),
  clear: vi.fn(),
}));
const getAuth = vi.hoisted(() => vi.fn(() => ({ api: sharedApi })));
const getLoginThrottle = vi.hoisted(() => vi.fn(() => sharedThrottle));
// The real modules would build Better Auth and a Prisma client: the services get fakes instead.
vi.mock("@/server/auth", () => ({ getAuth }));
vi.mock("@/server/login-throttle", () => ({ getLoginThrottle }));

import { AccountsUnavailableError, createAccounts, getAccounts } from "@/server/accounts";

type AccountsDeps = Parameters<typeof createAccounts>[0];

const LOG_LINE =
  /^\[accounts\] SERVICE_UNAVAILABLE at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PASSWORD = "festival2026";
const HEADERS = new Headers({ "user-agent": "vitest" });

function setup() {
  const api = {
    signUpEmail: vi.fn(async (_input: unknown) => ({ token: "t", user: {} })),
    signInEmail: vi.fn(async (_input: unknown) => ({ token: "t", user: {} })),
    signOut: vi.fn(async (_input: unknown) => ({ success: true })),
    getSession: vi.fn(async (_input: unknown): Promise<unknown> => ({
      session: { id: "s1", token: "secret-token" },
      user: { id: "u1", name: "Ana", email: "ana@mail.com", emailVerified: false, image: null },
    })),
  };
  const throttle = {
    reserve: vi.fn(
      async (_email: string): Promise<{ ok: true } | { ok: false; code: "LOGIN_LOCKED" }> => ({
        ok: true,
      }),
    ),
    recordFailure: vi.fn(async (_email: string) => {}),
    clear: vi.fn(async (_email: string) => {}),
  };
  const log = vi.fn((_line: string) => {});
  const accounts = createAccounts({
    auth: { api } as unknown as AccountsDeps["auth"],
    throttle,
    log,
  });
  return { api, throttle, log, accounts };
}

function apiError(code: string): APIError {
  return new APIError("BAD_REQUEST", { code, message: `english message for ${code}` });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registerAccount", () => {
  it("test-register-invalid-rejected: invalid fields are INVALID_INPUT per field and never reach Better Auth", async () => {
    const { api, accounts } = setup();

    const result = await accounts.registerAccount(
      { email: "ana@", password: "abcdefgh", name: "   " },
      HEADERS,
    );

    expect(result).toStrictEqual({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: {
        email: ["INVALID_EMAIL"],
        password: ["PASSWORD_NEEDS_NUMBER"],
        name: ["NAME_EMPTY"],
      },
    });
    expect(api.signUpEmail).not.toHaveBeenCalled();
  });

  it("lists only the fields that fail", async () => {
    const { api, accounts } = setup();

    const result = await accounts.registerAccount(
      { email: "ana@mail.com", password: "abc", name: "x".repeat(41) },
      HEADERS,
    );

    expect(result).toStrictEqual({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: {
        password: ["PASSWORD_TOO_SHORT", "PASSWORD_NEEDS_NUMBER"],
        name: ["NAME_TOO_LONG"],
      },
    });
    expect(api.signUpEmail).not.toHaveBeenCalled();
  });

  it("test-register-extra-fields-ignored: signUpEmail gets only email, password and name, normalized", async () => {
    const { api, accounts } = setup();
    const fields = {
      email: "  Ana@Mail.com ",
      password: PASSWORD,
      name: "  Ana  ",
      image: "https://evil.example/a.png",
      callbackURL: "https://evil.example",
      emailVerified: "true",
    };

    const result = await accounts.registerAccount(fields, HEADERS);

    expect(result).toStrictEqual({ ok: true });
    expect(api.signUpEmail).toHaveBeenCalledTimes(1);
    expect(api.signUpEmail.mock.calls[0]?.[0]).toStrictEqual({
      body: { email: "ana@mail.com", password: PASSWORD, name: "Ana" },
      headers: HEADERS,
    });
  });

  it("maps an existing email to EMAIL_TAKEN", async () => {
    const { api, log, accounts } = setup();
    api.signUpEmail.mockRejectedValueOnce(apiError("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"));

    const result = await accounts.registerAccount(
      { email: "ana@mail.com", password: PASSWORD, name: "Ana" },
      HEADERS,
    );

    expect(result).toStrictEqual({ ok: false, code: "EMAIL_TAKEN" });
    expect(log).not.toHaveBeenCalled();
  });

  it("maps Better Auth's own email rejection to the email field", async () => {
    const { api, accounts } = setup();
    api.signUpEmail.mockRejectedValueOnce(apiError("INVALID_EMAIL"));

    const result = await accounts.registerAccount(
      { email: "ana@mail..com", password: PASSWORD, name: "Ana" },
      HEADERS,
    );

    expect(result).toStrictEqual({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { email: ["INVALID_EMAIL"] },
    });
  });

  it("maps any other Better Auth error to SERVICE_UNAVAILABLE without its message", async () => {
    const { api, log, accounts } = setup();
    api.signUpEmail.mockRejectedValueOnce(apiError("FAILED_TO_CREATE_USER"));

    const result = await accounts.registerAccount(
      { email: "ana@mail.com", password: PASSWORD, name: "Ana" },
      HEADERS,
    );

    expect(result).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(LOG_LINE);
  });
});

describe("signIn", () => {
  it("normalizes the email, reserves an attempt, signs in for good and clears the throttle", async () => {
    const { api, throttle, accounts } = setup();

    const result = await accounts.signIn({ email: " Ana@Mail.COM ", password: PASSWORD }, HEADERS);

    expect(result).toStrictEqual({ ok: true });
    expect(throttle.reserve).toHaveBeenCalledWith("ana@mail.com");
    expect(api.signInEmail.mock.calls[0]?.[0]).toStrictEqual({
      body: { email: "ana@mail.com", password: PASSWORD, rememberMe: true },
      headers: HEADERS,
    });
    expect(throttle.clear).toHaveBeenCalledWith("ana@mail.com");
    expect(throttle.recordFailure).not.toHaveBeenCalled();
  });

  it("records a wrong password as a failure and answers INVALID_CREDENTIALS", async () => {
    const { api, throttle, log, accounts } = setup();
    api.signInEmail.mockRejectedValueOnce(apiError("INVALID_EMAIL_OR_PASSWORD"));

    const result = await accounts.signIn({ email: "ana@mail.com", password: "mala2026" }, HEADERS);

    expect(result).toStrictEqual({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(throttle.recordFailure).toHaveBeenCalledWith("ana@mail.com");
    expect(throttle.clear).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("answers an email Better Auth rejects as INVALID_CREDENTIALS, like a wrong password", async () => {
    const { api, throttle, accounts } = setup();
    api.signInEmail.mockRejectedValueOnce(apiError("INVALID_EMAIL"));

    const result = await accounts.signIn({ email: "ana@mail..com", password: PASSWORD }, HEADERS);

    expect(result).toStrictEqual({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(throttle.recordFailure).toHaveBeenCalledWith("ana@mail..com");
  });

  it.each([
    ["an invalid email", "ana@", PASSWORD],
    ["an empty password", "ana@mail.com", ""],
    ["a password over 128 characters", "ana@mail.com", `a1${"x".repeat(127)}`],
  ])(
    "rejects %s as INVALID_CREDENTIALS without reserving nor hashing",
    async (_, email, password) => {
      const { api, throttle, accounts } = setup();

      const result = await accounts.signIn({ email, password }, HEADERS);

      expect(result).toStrictEqual({ ok: false, code: "INVALID_CREDENTIALS" });
      expect(throttle.reserve).not.toHaveBeenCalled();
      expect(api.signInEmail).not.toHaveBeenCalled();
    },
  );

  it("answers LOGIN_LOCKED without checking the password", async () => {
    const { api, throttle, accounts } = setup();
    throttle.reserve.mockResolvedValueOnce({ ok: false, code: "LOGIN_LOCKED" });

    const result = await accounts.signIn({ email: "ana@mail.com", password: PASSWORD }, HEADERS);

    expect(result).toStrictEqual({ ok: false, code: "LOGIN_LOCKED" });
    expect(api.signInEmail).not.toHaveBeenCalled();
  });

  it("still signs in when clearing the throttle fails, and logs only the code", async () => {
    const { throttle, log, accounts } = setup();
    throttle.clear.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5432"));

    const result = await accounts.signIn({ email: "ana@mail.com", password: PASSWORD }, HEADERS);

    expect(result).toStrictEqual({ ok: true });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(LOG_LINE);
  });
});

describe("signOut and getCurrentUser", () => {
  it("signs out with the request headers", async () => {
    const { api, accounts } = setup();

    expect(await accounts.signOut(HEADERS)).toStrictEqual({ ok: true });
    expect(api.signOut).toHaveBeenCalledWith({ headers: HEADERS });
  });

  it("returns only id, name and email of the session's user", async () => {
    const { api, accounts } = setup();

    expect(await accounts.getCurrentUser(HEADERS)).toStrictEqual({
      id: "u1",
      name: "Ana",
      email: "ana@mail.com",
    });
    expect(api.getSession).toHaveBeenCalledWith({ headers: HEADERS });
  });

  it("returns null without a session", async () => {
    const { api, accounts } = setup();
    api.getSession.mockResolvedValueOnce(null);

    expect(await accounts.getCurrentUser(HEADERS)).toBeNull();
  });
});

describe("infrastructure errors", () => {
  it("test-accounts-db-down-error: a connection error is SERVICE_UNAVAILABLE, logged without its message", async () => {
    const { api, throttle, log, accounts } = setup();
    const down = () => new Error("connect ECONNREFUSED 127.0.0.1:5432 user=mi_grilla");
    api.signUpEmail.mockRejectedValue(down());
    api.signInEmail.mockRejectedValue(down());
    api.signOut.mockRejectedValue(down());
    api.getSession.mockRejectedValue(down());

    const results = [
      await accounts.registerAccount(
        { email: "ana@mail.com", password: PASSWORD, name: "Ana" },
        HEADERS,
      ),
      await accounts.signIn({ email: "ana@mail.com", password: PASSWORD }, HEADERS),
      await accounts.signOut(HEADERS),
    ];
    throttle.reserve.mockRejectedValueOnce(down());
    results.push(await accounts.signIn({ email: "ana@mail.com", password: PASSWORD }, HEADERS));

    for (const result of results) {
      expect(result).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    }
    const lines = log.mock.calls.map((call) => call[0]);
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(line).toMatch(LOG_LINE);
    }

    const thrown = await accounts.getCurrentUser(HEADERS).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(thrown).toBeInstanceOf(AccountsUnavailableError);
    expect(thrown).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect((thrown as Error).message).not.toMatch(/ECONNREFUSED|5432|mi_grilla/);
    expect((thrown as Error).cause).toBeUndefined();
    expect(log).toHaveBeenCalledTimes(5);
  });

  it("logs to console.error by default", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { api, throttle } = setup();
    api.signOut.mockRejectedValueOnce(new Error("boom"));
    const accounts = createAccounts({
      auth: { api } as unknown as AccountsDeps["auth"],
      throttle,
    });

    expect(await accounts.signOut(HEADERS)).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0]?.[0])).toMatch(LOG_LINE);
  });
});

describe("getAccounts", () => {
  it("is one service over the shared Better Auth instance and throttle", async () => {
    sharedApi.signInEmail.mockResolvedValue({});
    sharedThrottle.reserve.mockResolvedValue({ ok: true });
    sharedThrottle.clear.mockResolvedValue(undefined);

    const first = getAccounts();

    expect(getAccounts()).toBe(first);
    expect(
      await first.signIn({ email: "ana@mail.com", password: PASSWORD }, HEADERS),
    ).toStrictEqual({ ok: true });
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(getLoginThrottle).toHaveBeenCalledTimes(1);
  });
});
