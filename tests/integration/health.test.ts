import { createServer, type AddressInfo } from "node:net";

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const LATENCY_BUDGET_MS = 1_000;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL: copiá .env.example a .env y levantá la base con `docker compose up -d`.",
    );
  }
  return url;
}

async function findClosedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

/** Fresh module graph per test, so each one gets its own health checker and its own client. */
async function loadRoute(databaseUrl: string) {
  vi.stubEnv("DATABASE_URL", databaseUrl);
  vi.resetModules();
  return import("@/app/api/health/route");
}

function expectNoStoreJson(response: Response) {
  expect(response.headers.get("content-type")).toMatch(/^application\/json\b/);
  expect(response.headers.get("cache-control")).toBe("no-store");
}

let databaseUrl: string;

beforeAll(() => {
  databaseUrl = requireDatabaseUrl();
});

afterEach(async () => {
  const { disconnectDb } = await import("@/server/db");
  await disconnectDb();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("answers 200 with the exact body against a real Postgres within 1000 ms", async () => {
    const { GET } = await loadRoute(databaseUrl);

    const startedAt = performance.now();
    const response = await GET();
    const body = await response.text();
    const elapsedMs = performance.now() - startedAt;

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toStrictEqual({ status: "ok", database: "up" });
    expectNoStoreJson(response);
    expect(elapsedMs).toBeLessThanOrEqual(LATENCY_BUDGET_MS);
  });

  it("answers 503 with a generic body when the database port is closed", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const unreachable = new URL(databaseUrl);
    unreachable.port = String(await findClosedPort());
    const { GET } = await loadRoute(unreachable.toString());

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toStrictEqual({ status: "error", database: "down" });
    expectNoStoreJson(response);
    for (const secret of [unreachable.hostname, unreachable.port, unreachable.username]) {
      expect(body).not.toContain(secret);
    }

    const logged = errorLog.mock.calls.map((call) => call.map(String).join(" ")).join("\n");
    expect(logged).toContain("DB_UNREACHABLE");
    expect(logged).not.toContain(unreachable.port);
    expect(logged).not.toContain(unreachable.username);
  });
});

describe("other methods on /api/health", () => {
  it("rejects POST with 405, a JSON error body, and advertises GET", async () => {
    const { POST } = await loadRoute(databaseUrl);

    const response = POST();

    expect(response.status).toBe(405);
    expect(await response.json()).toStrictEqual({ error: "METHOD_NOT_ALLOWED" });
    expectNoStoreJson(response);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it.each(["PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const)(
    "rejects %s with the same 405",
    async (method) => {
      const route = await loadRoute(databaseUrl);

      const response = route[method]();

      expect(response.status).toBe(405);
      expect(await response.json()).toStrictEqual({ error: "METHOD_NOT_ALLOWED" });
      expectNoStoreJson(response);
      expect(response.headers.get("allow")).toBe("GET");
    },
  );
});

describe("createDb", () => {
  it("refuses a remote DATABASE_URL without sslmode=require before connecting", async () => {
    vi.resetModules();
    const { createDb } = await import("@/server/db");
    const { UnsafeDatabaseUrlError } = await import("@/server/database-url");

    expect(() => createDb("postgresql://user:pass@db.example.com:5432/mi_grilla")).toThrow(
      UnsafeDatabaseUrlError,
    );
  });
});
