import { describe, expect, it } from "vitest";

/** What `pg` connects to, without the credentials: the only part a failure may print. */
function databaseNameOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

describe("base de los tests de integración (FIX-004)", () => {
  it("test-integration-runs-on-test-database: la suite corre sobre TEST_DATABASE_URL, que no es la base de desarrollo", () => {
    const current = process.env.DATABASE_URL ?? "";
    const testDatabase = process.env.TEST_DATABASE_URL ?? "";
    const development = process.env.MI_GRILLA_DEVELOPMENT_DATABASE_URL;

    // Booleans, never the URLs: a failure must not print credentials.
    expect(testDatabase !== "", "falta TEST_DATABASE_URL").toBe(true);
    expect(current === testDatabase, "DATABASE_URL no es la base de TEST_DATABASE_URL").toBe(true);
    // The setup keeps the DATABASE_URL it received (empty when there was none, as in the CI).
    expect(development !== undefined, "el setup no guardó la base de desarrollo").toBe(true);
    if (development) {
      expect(databaseNameOf(current)).not.toBe(databaseNameOf(development));
    }
  });
});
