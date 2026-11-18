// @vitest-environment node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { UntruncatableDatabaseError } from "../integration/database-guard.ts";
import {
  MissingTestDatabaseError,
  resolveTestDatabaseUrl,
  SameAsDevelopmentDatabaseError,
  UnsupportedTestDatabaseUrlError,
} from "../test-database.ts";

const TEST_DB = "postgresql://test-owner:test-s3cret@127.0.0.1:5432/mi_grilla_test";
const DEV_DB = "postgresql://dev-owner:dev-s3cret@127.0.0.1:5432/mi_grilla";
const SCRIPT = resolve(process.cwd(), "tests/test-database.ts");

/** The error `resolveTestDatabaseUrl` throws for `env`, or undefined when it accepts it. */
function rejectionOf(env: { TEST_DATABASE_URL?: string; DATABASE_URL?: string }): unknown {
  try {
    resolveTestDatabaseUrl(env);
    return undefined;
  } catch (error) {
    return error;
  }
}

/** `node tests/test-database.ts …args` with only PATH, NODE_ENV and `env` in its environment. */
function runCommandMode(args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
  });
}

describe("resolveTestDatabaseUrl", () => {
  it("test-test-database-missing: sin TEST_DATABASE_URL, o vacía, la URL faltante es rechazada y el mensaje nombra la variable", () => {
    for (const env of [{}, { TEST_DATABASE_URL: "" }, { TEST_DATABASE_URL: "  " }]) {
      const rejection = rejectionOf({ ...env, DATABASE_URL: DEV_DB });
      expect(rejection).toBeInstanceOf(MissingTestDatabaseError);
      expect((rejection as Error).name).toBe("MissingTestDatabaseError");
      expect((rejection as Error).message).toContain("TEST_DATABASE_URL");
    }
  });

  it("test-test-database-same-as-development-rejected: la misma base es rechazada (también localhost contra 127.0.0.1, puerto implícito contra :5432 y DATABASE_URL inválida); otra base, otro puerto u otro host local pasan", () => {
    const same: Array<[string, string]> = [
      [DEV_DB, DEV_DB],
      ["postgresql://a:b@localhost:5432/mi_grilla", "postgresql://c:d@127.0.0.1:5432/mi_grilla"],
      ["postgresql://a:b@[::1]:5432/mi_grilla", "postgresql://c:d@localhost/mi_grilla"],
      ["postgresql://a:b@127.0.0.1/mi_grilla", "postgresql://c:d@127.0.0.1:5432/mi_grilla"],
      ["postgresql://a:b@LOCALHOST:5432/mi_grilla", DEV_DB],
      [TEST_DB, "no es una url"],
    ];
    for (const [testUrl, devUrl] of same) {
      const rejection = rejectionOf({ TEST_DATABASE_URL: testUrl, DATABASE_URL: devUrl });
      expect(rejection, `${testUrl} contra ${devUrl}`).toBeInstanceOf(
        SameAsDevelopmentDatabaseError,
      );
      expect((rejection as Error).name).toBe("SameAsDevelopmentDatabaseError");
    }

    const different: Array<[string, string | undefined]> = [
      [TEST_DB, DEV_DB],
      ["postgresql://a:b@127.0.0.1:5433/mi_grilla", DEV_DB],
      ["postgresql://a:b@postgres:5432/mi_grilla", DEV_DB],
      [TEST_DB, undefined],
      [TEST_DB, ""],
    ];
    for (const [testUrl, devUrl] of different) {
      expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: testUrl, DATABASE_URL: devUrl })).toBe(
        testUrl,
      );
    }
  });

  it("test-test-database-query-override-rejected: una TEST_DATABASE_URL inválida o con host, hostaddr, port, dbname o database en la query es rechazada; una DATABASE_URL con ?port= que la iguala es rechazada como misma base", () => {
    const unsupported = [
      "no es una url",
      `${TEST_DB}?port=5433`,
      `${TEST_DB}?host=10.0.0.5`,
      `${TEST_DB}?hostaddr=10.0.0.5`,
      `${TEST_DB}?dbname=mi_grilla`,
      `${TEST_DB}?sslmode=disable&database=mi_grilla`,
      // A malformed escape in the database name cannot be decoded.
      "postgresql://a:b@127.0.0.1:5432/mi_grilla_%zz",
    ];
    for (const testUrl of unsupported) {
      const rejection = rejectionOf({ TEST_DATABASE_URL: testUrl, DATABASE_URL: DEV_DB });
      expect(rejection, testUrl).toBeInstanceOf(UnsupportedTestDatabaseUrlError);
      expect((rejection as Error).name).toBe("UnsupportedTestDatabaseUrlError");
      expect((rejection as Error).message).toContain("TEST_DATABASE_URL");
    }
    // Other query parameters are fine.
    expect(
      resolveTestDatabaseUrl({
        TEST_DATABASE_URL: `${TEST_DB}?sslmode=disable`,
        DATABASE_URL: DEV_DB,
      }),
    ).toBe(`${TEST_DB}?sslmode=disable`);

    // On the DATABASE_URL side the query wins, as it does for `pg`.
    const overridden: string[] = [
      "postgresql://c:d@127.0.0.1:5433/mi_grilla_test?port=5432",
      "postgresql://c:d@127.0.0.1:5432/mi_grilla?dbname=mi_grilla_test",
      "postgresql://c:d@127.0.0.1:5432/mi_grilla?database=mi_grilla_test",
      "postgresql://c:d@10.0.0.5:5432/mi_grilla_test?host=localhost",
      "postgresql://c:d@10.0.0.5:5432/mi_grilla_test?hostaddr=127.0.0.1",
      // An empty override falls back to the URL's own part, as it does for `pg`.
      "postgresql://c:d@127.0.0.1:5432/mi_grilla_test?host=&port=",
      // A DATABASE_URL that cannot be decoded cannot be told apart.
      "postgresql://c:d@127.0.0.1:5432/mi_grilla_%zz",
    ];
    for (const devUrl of overridden) {
      expect(
        rejectionOf({ TEST_DATABASE_URL: TEST_DB, DATABASE_URL: devUrl }),
        devUrl,
      ).toBeInstanceOf(SameAsDevelopmentDatabaseError);
    }
  });

  it("test-test-database-remote-rejected: un host remoto en TEST_DATABASE_URL es rechazado y el host postgres de la CI pasa", () => {
    for (const testUrl of [
      "postgresql://a:b@db.example.com:5432/mi_grilla_test",
      "postgresql://a:b@10.0.0.5:5432/mi_grilla_test",
    ]) {
      const rejection = rejectionOf({ TEST_DATABASE_URL: testUrl });
      expect(rejection, testUrl).toBeInstanceOf(UntruncatableDatabaseError);
      expect((rejection as Error).message).toContain("TEST_DATABASE_URL");
    }
    const ci = "postgresql://mi_grilla:ci-only-password@postgres:5432/mi_grilla";
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: ci })).toBe(ci);
  });

  it("test-test-database-message-without-url: ningún rechazo incluye la URL, el usuario ni la contraseña de ninguna de las dos variables", () => {
    const remote = "postgresql://remote-user:remote-pass@db.example.com:6543/remote_db";
    const cases: Array<{ TEST_DATABASE_URL?: string; DATABASE_URL?: string }> = [
      { DATABASE_URL: DEV_DB },
      { TEST_DATABASE_URL: `${TEST_DB}?port=6543`, DATABASE_URL: DEV_DB },
      { TEST_DATABASE_URL: remote, DATABASE_URL: DEV_DB },
      { TEST_DATABASE_URL: TEST_DB, DATABASE_URL: TEST_DB.replace("test-s3cret", "dev-s3cret") },
      {
        TEST_DATABASE_URL: TEST_DB,
        DATABASE_URL: "postgres://dev-user:dev-pass@127.0.0.1:no-port/db",
      },
    ];
    const secrets = [
      "test-owner",
      "dev-owner",
      "test-s3cret",
      "dev-s3cret",
      "remote-user",
      "remote-pass",
      "db.example.com",
      "6543",
      "remote_db",
      "dev-user",
      "dev-pass",
      "postgresql://",
    ];
    for (const env of cases) {
      const rejection = rejectionOf(env);
      expect(rejection).toBeInstanceOf(Error);
      const message = (rejection as Error).message;
      for (const secret of secrets) {
        expect(message).not.toContain(secret);
      }
    }
  });
});

describe("node tests/test-database.ts <comando>", () => {
  it("test-test-database-command-rejected: sin TEST_DATABASE_URL es rechazado con salida 1 sin ejecutar el comando; con una URL válida ejecuta el comando con DATABASE_URL de tests y devuelve su código de salida", () => {
    const marker = ["-e", "console.log('COMMAND-RAN')"];

    const missing = runCommandMode([process.execPath, ...marker], { DATABASE_URL: DEV_DB });
    expect(missing.status).toBe(1);
    expect(missing.stdout).not.toContain("COMMAND-RAN");
    expect(missing.stderr).toContain("Falta TEST_DATABASE_URL");
    expect(missing.stderr).not.toContain("dev-s3cret");

    const same = runCommandMode([process.execPath, ...marker], {
      TEST_DATABASE_URL: DEV_DB,
      DATABASE_URL: DEV_DB,
    });
    expect(same.status).toBe(1);
    expect(same.stdout).not.toContain("COMMAND-RAN");
    expect(same.stderr).not.toContain("dev-s3cret");

    const usage = runCommandMode([], { TEST_DATABASE_URL: TEST_DB });
    expect(usage.status).toBe(1);

    const checksUrl = runCommandMode(
      [
        process.execPath,
        "-e",
        "process.exit(process.env.DATABASE_URL === process.env.EXPECTED_URL ? 0 : 9)",
      ],
      { TEST_DATABASE_URL: TEST_DB, DATABASE_URL: DEV_DB, EXPECTED_URL: TEST_DB },
    );
    expect(checksUrl.status).toBe(0);
    expect(`${checksUrl.stdout}${checksUrl.stderr}`).not.toContain("test-s3cret");

    const failing = runCommandMode([process.execPath, "-e", "process.exit(3)"], {
      TEST_DATABASE_URL: TEST_DB,
    });
    expect(failing.status).toBe(3);
  });
});
