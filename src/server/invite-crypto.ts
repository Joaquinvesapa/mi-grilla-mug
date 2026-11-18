import "server-only";

import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

import { readAuthEnv } from "@/server/auth";

/** 256 bits: guessing a live link has no chance (NFR-02, R-02). */
const TOKEN_BYTES = 32;
/** The 96-bit IV GCM is specified for; a fresh one for every seal. */
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const CIPHER = "aes-256-gcm";
// Fixed labels: each key is bound to its one use, so the HMAC key never encrypts and vice versa.
const HKDF_SALT = "mi-grilla/group-invites";
const HMAC_INFO = "invite-token-hmac-sha256";
const AES_INFO = "invite-token-aes-256-gcm";

export type InviteCrypto = {
  /** HMAC-SHA256 of the token, 64 hex characters: what the database looks the token up by. */
  hashToken(token: string): string;
  /** The token encrypted with AES-256-GCM as `iv.tag.data` in base64url, bound to its group. */
  sealToken(token: string, groupId: string): string;
  /** The token back, or `null` if the ciphertext was altered, is of another group or key. */
  openToken(ciphertext: string, groupId: string): string | null;
};

/** A new invite token: 32 bytes of `crypto.randomBytes` in base64url (43 characters). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function deriveKey(secret: string, info: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, info, KEY_BYTES));
}

/** The base64url segment as bytes, or `null` if it is not strictly base64url. */
function decodeSegment(segment: string | undefined): Buffer | null {
  if (segment === undefined || segment === "" || !/^[A-Za-z0-9_-]+$/.test(segment)) {
    return null;
  }
  return Buffer.from(segment, "base64url");
}

/**
 * The invite token's operations over two keys derived with HKDF from `secret` (ADR-006). The token
 * is never stored in clear: the database keeps its HMAC and its ciphertext (R-12).
 */
export function createInviteCrypto(secret: string): InviteCrypto {
  const hmacKey = deriveKey(secret, HMAC_INFO);
  const aesKey = deriveKey(secret, AES_INFO);

  return {
    hashToken(token) {
      return createHmac("sha256", hmacKey).update(token, "utf8").digest("hex");
    },

    sealToken(token, groupId) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(CIPHER, aesKey, iv, { authTagLength: TAG_BYTES });
      // The group id as AAD: a ciphertext copied into another group's row does not open.
      cipher.setAAD(Buffer.from(groupId, "utf8"));
      const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
    },

    openToken(ciphertext, groupId) {
      const parts = ciphertext.split(".");
      if (parts.length !== 3) {
        return null;
      }
      const [iv, tag, data] = parts.map(decodeSegment);
      if (!iv || !tag || !data || iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        return null;
      }
      try {
        const decipher = createDecipheriv(CIPHER, aesKey, iv, { authTagLength: TAG_BYTES });
        decipher.setAAD(Buffer.from(groupId, "utf8"));
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
      } catch {
        // With the IV and tag lengths already validated above, the only thing that lands here is
        // GCM's authentication failure: a rotated BETTER_AUTH_SECRET, or a ciphertext altered or
        // moved to another group (AAD). That is an expected result, answered as "no link", not an
        // error, so it is neither logged nor re-thrown.
        return null;
      }
    },
  };
}

let sharedCrypto: InviteCrypto | undefined;

/**
 * The process-wide keys, derived on first use: importing this module never reads
 * BETTER_AUTH_SECRET, which the CI's `quality` job does not have. Throws `AuthConfigError` (naming
 * the variable, never its value) when it is missing.
 */
function shared(): InviteCrypto {
  sharedCrypto ??= createInviteCrypto(readAuthEnv(process.env).secret);
  return sharedCrypto;
}

export function hashToken(token: string): string {
  return shared().hashToken(token);
}

export function sealToken(token: string, groupId: string): string {
  return shared().sealToken(token, groupId);
}

export function openToken(ciphertext: string, groupId: string): string | null {
  return shared().openToken(ciphertext, groupId);
}
