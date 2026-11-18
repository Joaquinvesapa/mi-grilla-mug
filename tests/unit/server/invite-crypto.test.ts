import { afterEach, describe, expect, it, vi } from "vitest";

// The default generator is checked against the real `randomBytes`, wrapped in a spy.
const randomBytesSpy = vi.hoisted(() => ({
  fn: undefined as undefined | ReturnType<typeof vi.fn>,
}));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const spy = vi.fn((size: number) => actual.randomBytes(size));
  randomBytesSpy.fn = spy;
  return { ...actual, default: { ...actual, randomBytes: spy }, randomBytes: spy };
});

import {
  createInviteCrypto,
  generateToken,
  hashToken,
  openToken,
  sealToken,
} from "@/server/invite-crypto";

const SECRET = "unit-tests-secret-with-at-least-32-characters";
const OTHER_SECRET = "another-unit-tests-secret-with-32-characters";
const GROUP_ID = "0b6c1f0e-8f5d-4c1a-9b8e-2f3d4c5b6a7e";
const OTHER_GROUP_ID = "1c7d2a1f-9a6e-4d2b-8c9f-3a4e5d6c7b8f";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Flips one bit of one base64url segment of `iv.tag.data`. */
function tamper(ciphertext: string, segment: 0 | 1 | 2): string {
  const parts = ciphertext.split(".");
  const bytes = Buffer.from(parts[segment] ?? "", "base64url");
  bytes[0] = (bytes[0] ?? 0) ^ 0x01;
  parts[segment] = bytes.toString("base64url");
  return parts.join(".");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateToken", () => {
  it("invite-crypto: el generador por defecto usa 32 bytes de randomBytes y 1000 tokens no se repiten", () => {
    const spy = randomBytesSpy.fn;
    expect(spy).toBeDefined();
    spy?.mockClear();

    const token = generateToken();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(32);
    const drawn = spy?.mock.results[0]?.value as Buffer;
    // The token is exactly those 32 bytes in base64url: 256 bits, nothing derived or truncated.
    expect(Buffer.from(token, "base64url").equals(drawn)).toBe(true);
    expect(token).toBe(drawn.toString("base64url"));

    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const next = generateToken();
      expect(next).toMatch(TOKEN_PATTERN);
      expect(Buffer.from(next, "base64url")).toHaveLength(32);
      tokens.add(next);
    }
    expect(tokens.size).toBe(1000);
  });
});

describe("createInviteCrypto", () => {
  it("sealToken y openToken van y vuelven con el mismo grupo", () => {
    const crypto = createInviteCrypto(SECRET);
    const token = generateToken();
    const sealed = crypto.sealToken(token, GROUP_ID);

    expect(sealed).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(sealed).not.toContain(token);
    expect(crypto.openToken(sealed, GROUP_ID)).toBe(token);
    // Another instance over the same secret opens it too: the keys come only from the secret.
    expect(createInviteCrypto(SECRET).openToken(sealed, GROUP_ID)).toBe(token);
  });

  it("cada sellado usa un IV de 12 bytes distinto, y el tag de GCM es de 16", () => {
    const crypto = createInviteCrypto(SECRET);
    const token = generateToken();
    const ivs = new Set<string>();
    const sealedValues = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const sealed = crypto.sealToken(token, GROUP_ID);
      const [iv = "", tag = "", data = ""] = sealed.split(".");
      expect(Buffer.from(iv, "base64url")).toHaveLength(12);
      expect(Buffer.from(tag, "base64url")).toHaveLength(16);
      expect(Buffer.from(data, "base64url")).toHaveLength(43);
      ivs.add(iv);
      sealedValues.add(sealed);
    }
    expect(ivs.size).toBe(50);
    expect(sealedValues.size).toBe(50);
  });

  it("un ciphertext adulterado, sellado con otro secreto, de otro grupo o mal formado no abre", () => {
    const crypto = createInviteCrypto(SECRET);
    const token = generateToken();
    const sealed = crypto.sealToken(token, GROUP_ID);

    expect(crypto.openToken(tamper(sealed, 0), GROUP_ID)).toBeNull();
    expect(crypto.openToken(tamper(sealed, 1), GROUP_ID)).toBeNull();
    expect(crypto.openToken(tamper(sealed, 2), GROUP_ID)).toBeNull();
    // Another secret derives other keys.
    expect(createInviteCrypto(OTHER_SECRET).openToken(sealed, GROUP_ID)).toBeNull();
    // The group id is the AAD: the ciphertext cannot be moved to another row.
    expect(crypto.openToken(sealed, OTHER_GROUP_ID)).toBeNull();
    for (const malformed of [
      "",
      "a.b",
      "a.b.c.d",
      "...",
      sealed.replace(/\./g, ""),
      "%%%.%%%.%%%",
    ]) {
      expect(crypto.openToken(malformed, GROUP_ID)).toBeNull();
    }
  });

  it("hashToken es un HMAC-SHA256 determinista de 64 hex que depende del secreto", () => {
    const crypto = createInviteCrypto(SECRET);
    const token = generateToken();
    const hash = crypto.hashToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(crypto.hashToken(token)).toBe(hash);
    expect(createInviteCrypto(SECRET).hashToken(token)).toBe(hash);
    expect(createInviteCrypto(OTHER_SECRET).hashToken(token)).not.toBe(hash);
    expect(crypto.hashToken(generateToken())).not.toBe(hash);
    expect(hash).not.toContain(token);
  });
});

describe("shared functions", () => {
  it("leen BETTER_AUTH_SECRET recién al usarse, no al importarse", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.resetModules();
    // Importing with no secret does not throw: the CI quality job has none.
    const fresh = await import("@/server/invite-crypto");
    expect(() => fresh.hashToken("A".repeat(43))).toThrow(/BETTER_AUTH_SECRET/);

    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    const token = generateToken();
    const sealed = fresh.sealToken(token, GROUP_ID);
    expect(fresh.openToken(sealed, GROUP_ID)).toBe(token);
    expect(fresh.hashToken(token)).toBe(createInviteCrypto(SECRET).hashToken(token));
  });

  it("los exports del módulo usan el secreto del entorno", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", OTHER_SECRET);
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    const token = generateToken();
    // The keys are derived once per process; this module instance had none yet.
    const sealed = sealToken(token, GROUP_ID);
    expect(openToken(sealed, GROUP_ID)).toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
