import { getCookies } from "better-auth/cookies";
import { describe, expect, it } from "vitest";

import { hasSessionCookie, sessionCookieOptions } from "@/server/session-cookie";

const TOKEN = "abc123.signature";

function requestWithCookie(cookie?: string): Request {
  const headers = new Headers();
  if (cookie !== undefined) {
    headers.set("cookie", cookie);
  }
  return new Request("http://localhost:3000/", { headers });
}

describe("sessionCookieOptions", () => {
  it("test-session-cookie-name: over https the name carries __Secure- and the cookie is secure", () => {
    const options = sessionCookieOptions("https://mi-grilla.example.com");

    expect(options.secure).toBe(true);
    expect(options.sessionCookieName).toBe("__Secure-better-auth.session_token");
  });

  it("test-session-cookie-name: over http neither the prefix nor secure", () => {
    const options = sessionCookieOptions("http://localhost:3000");

    expect(options.secure).toBe(false);
    expect(options.sessionCookieName).toBe("better-auth.session_token");
  });

  it.each(["https://mi-grilla.example.com", "http://localhost:3000"])(
    "test-session-cookie-name: matches the name Better Auth itself computes for %s (R-15)",
    (baseUrl) => {
      const options = sessionCookieOptions(baseUrl);
      const betterAuthCookies = getCookies({
        baseURL: baseUrl,
        advanced: { cookiePrefix: options.cookiePrefix, useSecureCookies: options.secure },
      });

      expect(betterAuthCookies.sessionToken.name).toBe(options.sessionCookieName);
      expect(betterAuthCookies.sessionToken.attributes.secure).toBe(options.secure);
    },
  );
});

describe("hasSessionCookie", () => {
  it.each([
    ["http", "http://localhost:3000"],
    ["https", "https://mi-grilla.example.com"],
  ])("test-session-cookie-name: finds the %s session cookie by its name", (_scheme, baseUrl) => {
    const { sessionCookieName } = sessionCookieOptions(baseUrl);

    expect(hasSessionCookie(requestWithCookie(`theme=dark; ${sessionCookieName}=${TOKEN}`))).toBe(
      true,
    );
  });

  it("test-session-cookie-name: also reads it from bare headers", () => {
    const headers = new Headers({ cookie: `better-auth.session_token=${TOKEN}` });

    expect(hasSessionCookie(headers)).toBe(true);
  });

  it("test-session-cookie-name: returns false without a cookie header", () => {
    expect(hasSessionCookie(requestWithCookie())).toBe(false);
  });

  it("test-session-cookie-name: returns false when only other cookies are present", () => {
    expect(
      hasSessionCookie(requestWithCookie(`theme=dark; other-app.session_token=${TOKEN}`)),
    ).toBe(false);
  });
});
