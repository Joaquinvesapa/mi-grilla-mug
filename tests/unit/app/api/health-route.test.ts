// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const check = vi.hoisted(() => vi.fn<() => Promise<unknown>>());

vi.mock("@/server/health", () => ({ getHealthChecker: () => ({ check }) }));

import { GET } from "@/app/api/health/route";

afterEach(() => {
  check.mockReset();
});

describe("GET /api/health body", () => {
  it("sends only status and database, even if the server result grows a field", async () => {
    check.mockResolvedValue({ status: "ok", database: "up", detail: "PostgreSQL 17.6 on db-1" });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ status: "ok", database: "up" });
  });

  it("does the same on the 503 path", async () => {
    check.mockResolvedValue({ status: "error", database: "down", cause: "ECONNREFUSED" });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toStrictEqual({ status: "error", database: "down" });
  });
});
