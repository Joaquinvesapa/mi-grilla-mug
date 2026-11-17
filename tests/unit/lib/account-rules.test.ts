import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  readFormFields,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/account-rules";

describe("normalizeEmail", () => {
  it("test-email-normalized: trims and lowercases the email", () => {
    expect(normalizeEmail("  Ana@Mail.com ")).toBe("ana@mail.com");
  });
});

describe("validateEmail", () => {
  // 246 + "@mail.com" (9) = 255 characters, one over the limit.
  const TOO_LONG = `${"a".repeat(246)}@mail.com`;

  it.each([
    ["ana@", "ana@"],
    ["no @", "ana.mail.com"],
    ["a space", "a b@c.com"],
    ["a trailing dot in the domain", "ana@mail."],
    ["empty", ""],
    ["255 characters", TOO_LONG],
  ])("test-email-invalid: rejects %s with INVALID_EMAIL", (_case, email) => {
    expect(validateEmail(email)).toBe("INVALID_EMAIL");
  });

  it.each([
    ["two @", "ana@x@mail.com"],
    ["a domain without a dot", "ana@mail"],
    ["a leading dot in the domain", "ana@.mail.com"],
    ["an empty local part", "@mail.com"],
  ])("test-email-invalid: also rejects %s", (_case, email) => {
    expect(validateEmail(email)).toBe("INVALID_EMAIL");
  });

  it("test-email-invalid: accepts ana@mail.com and an email of exactly 254 characters", () => {
    expect(validateEmail("ana@mail.com")).toBeNull();
    expect(validateEmail(`${"a".repeat(245)}@mail.com`)).toBeNull();
  });
});

describe("validatePassword", () => {
  it.each([
    ["abc1", ["PASSWORD_TOO_SHORT"]],
    ["abcdefgh", ["PASSWORD_NEEDS_NUMBER"]],
    ["12345678", ["PASSWORD_NEEDS_LETTER"]],
    ["abc", ["PASSWORD_TOO_SHORT", "PASSWORD_NEEDS_NUMBER"]],
    [`${"a".repeat(128)}1`, ["PASSWORD_TOO_LONG"]],
    ["", ["PASSWORD_TOO_SHORT", "PASSWORD_NEEDS_LETTER", "PASSWORD_NEEDS_NUMBER"]],
  ])("test-password-rules-invalid: %j fails with every broken rule", (password, codes) => {
    expect(validatePassword(password)).toEqual(codes);
  });

  it.each(["festival2026", "ñandú123", `${"a".repeat(127)}1`, "abcdefg1"])(
    "test-password-rules-invalid: accepts %j",
    (password) => {
      expect(validatePassword(password)).toEqual([]);
    },
  );

  it("test-password-rules-invalid: does not trim the password", () => {
    expect(validatePassword("  abc1  ")).toEqual([]);
  });
});

describe("validateName", () => {
  it("test-name-invalid: rejects a blank name with NAME_EMPTY", () => {
    expect(validateName("   ")).toBe("NAME_EMPTY");
    expect(validateName("")).toBe("NAME_EMPTY");
  });

  it("test-name-invalid: rejects 41 characters with NAME_TOO_LONG", () => {
    expect(validateName("a".repeat(41))).toBe("NAME_TOO_LONG");
  });

  it("test-name-invalid: returns the trimmed name", () => {
    expect(validateName("  Ana  ")).toEqual({ name: "Ana" });
  });

  it("test-name-invalid: accepts exactly 40 characters, counted after the trim", () => {
    const forty = "b".repeat(40);

    expect(validateName(forty)).toEqual({ name: forty });
    expect(validateName(`  ${forty}  `)).toEqual({ name: forty });
  });
});

describe("readFormFields", () => {
  it("test-form-fields-missing: reads a File and a missing key as an empty string", () => {
    const formData = new FormData();
    formData.set("email", "ana@mail.com");
    formData.set("password", new File(["x"], "password.txt"));

    expect(readFormFields(formData, ["email", "password", "name"])).toEqual({
      email: "ana@mail.com",
      password: "",
      name: "",
    });
  });

  it("test-form-fields-missing: keeps a string value as it came, without trimming", () => {
    const formData = new FormData();
    formData.set("name", "  Ana  ");

    expect(readFormFields(formData, ["name"])).toEqual({ name: "  Ana  " });
  });
});
