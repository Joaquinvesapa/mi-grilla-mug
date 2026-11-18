// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The E2E helper writes groups and friends straight into the database (FEAT-006c, Block 5). Its
// guard has to refuse a non-local DATABASE_URL before a single connection is opened (R-07): `pg` is
// replaced here so any connection attempt is recorded instead of made.
const connections = vi.hoisted(() => ({ opened: 0 }));

vi.mock("pg", () => {
  class Pool {
    constructor() {
      connections.opened += 1;
    }
    query() {
      return Promise.reject(new Error("no debería consultar"));
    }
    connect() {
      return Promise.reject(new Error("no debería conectarse"));
    }
  }
  return { default: { Pool }, Pool };
});

const REMOTE_URL = "postgresql://user:secret@db.example.com:5432/mi_grilla";
const original = process.env.DATABASE_URL;

/**
 * The helper and the guard's error class from the same fresh module graph: the helper keeps its
 * pool in a module variable, so every test starts from a new one.
 */
async function load() {
  const db = await import("../../e2e/db");
  const { UntruncatableDatabaseError } = await import("../../integration/database-guard");
  return { db, UntruncatableDatabaseError };
}

describe("tests/e2e/db.ts", () => {
  beforeEach(() => {
    connections.opened = 0;
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = original;
    }
  });

  it("test-e2e-db-guard-rejected: el helper con una DATABASE_URL no local es rechazado antes de conectarse", async () => {
    process.env.DATABASE_URL = REMOTE_URL;
    const { db, UntruncatableDatabaseError } = await load();

    await expect(
      db.insertGroup({ name: "Los del Lolla", members: [], joinedAt: new Date() }),
    ).rejects.toBeInstanceOf(UntruncatableDatabaseError);
    await expect(
      db.insertFriends("00000000-0000-4000-8000-000000000000", [{ name: "Ana", showIds: [] }]),
    ).rejects.toBeInstanceOf(UntruncatableDatabaseError);
    await expect(db.insertSelection("someone", [])).rejects.toBeInstanceOf(
      UntruncatableDatabaseError,
    );
    await expect(db.userIdByEmail("e2e@example.com")).rejects.toBeInstanceOf(
      UntruncatableDatabaseError,
    );
    expect(connections.opened).toBe(0);
  });

  it("sin DATABASE_URL también se rechaza antes de conectarse", async () => {
    // `.env` would fill it back in: an empty value is one dotenv never overrides.
    process.env.DATABASE_URL = "";
    const { db, UntruncatableDatabaseError } = await load();

    await expect(db.userIdByEmail("e2e@example.com")).rejects.toBeInstanceOf(
      UntruncatableDatabaseError,
    );
    expect(connections.opened).toBe(0);
  });

  it("con una base local sí se conecta", async () => {
    process.env.DATABASE_URL = "postgresql://user:secret@127.0.0.1:5432/mi_grilla";
    const { db } = await load();

    await expect(db.userIdByEmail("e2e@example.com")).rejects.toThrow("no debería consultar");
    expect(connections.opened).toBe(1);
  });
});
