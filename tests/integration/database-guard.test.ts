import { describe, expect, it } from "vitest";

import { assertTruncatableDatabaseUrl } from "./database-guard";

const REMOTE = "postgresql://user:remote-password@db.example.com:5432/mi_grilla?sslmode=require";

describe("assertTruncatableDatabaseUrl", () => {
  it.each([
    "postgresql://mi_grilla:pw@localhost:5432/mi_grilla",
    "postgresql://mi_grilla:pw@127.0.0.1:5432/mi_grilla",
    "postgresql://mi_grilla:pw@[::1]:5432/mi_grilla",
    "postgresql://mi_grilla:pw@postgres:5432/mi_grilla",
  ])("accepts the local or CI-service database %s", (url) => {
    expect(() => assertTruncatableDatabaseUrl(url)).not.toThrow();
  });

  it.each([REMOTE, "postgresql://u:p@10.0.0.5:5432/db", "no es una url"])(
    "refuses to empty tables on %s",
    (url) => {
      expect(() => assertTruncatableDatabaseUrl(url)).toThrow(
        /solo vacían una base local \(localhost, 127\.0\.0\.1, ::1\) o el servicio `postgres` de la CI/,
      );
    },
  );

  it("never echoes the URL nor its credentials in the error", () => {
    let message = "";
    try {
      assertTruncatableDatabaseUrl(REMOTE);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe("");
    for (const part of ["db.example.com", "remote-password", "user", "5432"]) {
      expect(message).not.toContain(part);
    }
  });
});
