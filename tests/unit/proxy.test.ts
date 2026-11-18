// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";

const ORIGIN = "http://localhost:3100";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCdE";
const SESSION_COOKIE = "better-auth.session_token=made-up-value";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, ORIGIN), {
    headers: cookie ? { cookie } : {},
  });
}

/** Where the proxy sends the request, or `null` if it lets it through. */
function destination(path: string, cookie?: string): URL | null {
  const response = proxy(request(path, cookie));
  const location = response.headers.get("location");
  if (location === null) {
    return null;
  }
  expect(response.status).toBe(307);
  return new URL(location);
}

describe("proxy", () => {
  it("cubre /, /grupos y /invitacion", () => {
    expect(config.matcher).toStrictEqual(["/", "/grupos/:path*", "/invitacion/:path*"]);
  });

  it("proxy: sin cookie, /invitacion/<token> va a /login con next y /grupos sin next", () => {
    const invitation = destination(`/invitacion/${TOKEN}`);
    expect(invitation?.origin).toBe(ORIGIN);
    expect(invitation?.pathname).toBe("/login");
    expect(invitation?.searchParams.get("next")).toBe(`/invitacion/${TOKEN}`);

    for (const path of ["/", "/grupos", "/grupos/0b6f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e"]) {
      const target = destination(path);
      expect(target?.pathname, path).toBe("/login");
      expect(target?.search, path).toBe("");
    }
  });

  it("proxy: un token mal formado no se lleva en next (rechazado)", () => {
    for (const path of [
      `/invitacion/${TOKEN.slice(1)}`,
      `/invitacion/${TOKEN}/extra`,
      "/invitacion/",
      `/invitacion/${TOKEN}?next=https://evil.example`,
    ]) {
      const target = destination(path);
      expect(target?.pathname, path).toBe("/login");
      if (path.includes("?")) {
        // The token is fine: only the path travels, never the query the request came with.
        expect(target?.searchParams.getAll("next"), path).toStrictEqual([`/invitacion/${TOKEN}`]);
      } else {
        expect(target?.search, path).toBe("");
      }
    }
  });

  it("con cookie de sesión deja pasar: la página verifica la sesión de verdad", () => {
    expect(destination(`/invitacion/${TOKEN}`, SESSION_COOKIE)).toBeNull();
    expect(destination("/grupos", SESSION_COOKIE)).toBeNull();
    expect(destination("/", SESSION_COOKIE)).toBeNull();
  });
});
