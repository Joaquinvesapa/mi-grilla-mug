import { describe, expect, it } from "vitest";

import {
  GROUP_ID_PATTERN,
  GROUP_NAME_MAX_LENGTH,
  INVITE_TOKEN_PATTERN,
  INVITE_TTL_MS,
  initialsOf,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS_PER_USER,
  normalizeGroupName,
  USER_ID_PATTERN,
} from "@/lib/group-rules";

describe("group limits", () => {
  it("fija 40 puntos de código, 20 integrantes, 10 grupos y 72 h de link", () => {
    expect(GROUP_NAME_MAX_LENGTH).toBe(40);
    expect(MAX_GROUP_MEMBERS).toBe(20);
    expect(MAX_GROUPS_PER_USER).toBe(10);
    expect(INVITE_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });
});

describe("normalizeGroupName", () => {
  it("recorta los espacios y acepta de 1 a 40 puntos de código", () => {
    expect(normalizeGroupName("  Los del Lolla  ")).toBe("Los del Lolla");
    expect(normalizeGroupName("A")).toBe("A");
    expect(normalizeGroupName("a".repeat(40))).toBe("a".repeat(40));
    // 40 emojis are 80 UTF-16 units but 40 code points: what varchar(40) counts.
    expect(normalizeGroupName("🎸".repeat(40))).toBe("🎸".repeat(40));
  });

  it("rechaza vacío, solo espacios, más de 40 puntos de código y lo que no es un string", () => {
    for (const raw of ["", "   ", "\n\t", "a".repeat(41), "🎸".repeat(41), ` ${"b".repeat(41)} `]) {
      expect(normalizeGroupName(raw)).toBeNull();
    }
    for (const raw of [null, undefined, 42, ["Los del Lolla"], { name: "x" }]) {
      expect(normalizeGroupName(raw)).toBeNull();
    }
  });
});

describe("INVITE_TOKEN_PATTERN", () => {
  it("acepta exactamente 43 caracteres base64url", () => {
    expect(INVITE_TOKEN_PATTERN.test("A".repeat(43))).toBe(true);
    expect(INVITE_TOKEN_PATTERN.test("aZ09_-".repeat(7) + "x")).toBe(true);
    for (const token of [
      "A".repeat(42),
      "A".repeat(44),
      `${"A".repeat(42)}=`,
      `${"A".repeat(42)}+`,
      `${"A".repeat(42)}/`,
      ` ${"A".repeat(42)}`,
      "",
    ]) {
      expect(INVITE_TOKEN_PATTERN.test(token)).toBe(false);
    }
  });
});

describe("GROUP_ID_PATTERN", () => {
  it("acepta un UUID de crypto.randomUUID y rechaza otras formas", () => {
    expect(GROUP_ID_PATTERN.test(crypto.randomUUID())).toBe(true);
    expect(GROUP_ID_PATTERN.test("0b6c1f0e-8f5d-4c1a-9b8e-2f3d4c5b6a7e")).toBe(true);
    for (const id of [
      "",
      "1",
      "not-a-uuid",
      "0b6c1f0e8f5d4c1a9b8e2f3d4c5b6a7e",
      "0b6c1f0e-8f5d-4c1a-9b8e-2f3d4c5b6a7",
      "0b6c1f0e-8f5d-4c1a-9b8e-2f3d4c5b6a7e' OR 1=1",
    ]) {
      expect(GROUP_ID_PATTERN.test(id)).toBe(false);
    }
  });
});

describe("USER_ID_PATTERN", () => {
  it("acepta ids de Better Auth y los literales de los tests, y rechaza otras formas", () => {
    // Better Auth: 32 alphanumeric characters.
    expect(USER_ID_PATTERN.test("aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE")).toBe(true);
    for (const id of ["ana", "user-01", "a_b", "x", "a".repeat(64)]) {
      expect(USER_ID_PATTERN.test(id)).toBe(true);
    }
    for (const id of [
      "",
      "a".repeat(65),
      "ana pérez",
      "ana ",
      "ana\n",
      "ana'; DROP TABLE users; --",
      "a/b",
      "a.b",
    ]) {
      expect(USER_ID_PATTERN.test(id)).toBe(false);
    }
  });
});

describe("initialsOf", () => {
  it("group-rules: iniciales de una, dos y más palabras, con tildes y emojis", () => {
    // Two or more words: the first letter of the first and of the last.
    expect(initialsOf("Ana Pérez")).toBe("AP");
    expect(initialsOf("María José López")).toBe("ML");
    expect(initialsOf("  ana   pérez  ")).toBe("AP");
    expect(initialsOf("Úrsula Ñandú")).toBe("ÚÑ");
    // One word: its first two graphemes.
    expect(initialsOf("Bruno")).toBe("BR");
    expect(initialsOf("élodie")).toBe("ÉL");
    expect(initialsOf("X")).toBe("X");
    // Graphemes, not code units: a flag or a family emoji is one initial.
    expect(initialsOf("🇦🇷 Fan")).toBe("🇦🇷F");
    expect(initialsOf("👨‍👩‍👧Familia")).toBe("👨‍👩‍👧F");
    // A decomposed accent stays with its letter.
    expect(initialsOf("émile")).toBe("ÉM");
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});
