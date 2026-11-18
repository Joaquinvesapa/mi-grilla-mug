// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The E2E helper writes groups and friends straight into the test database (FEAT-006c, Block 5).
// Its guard (FIX-004's `resolveTestDatabaseUrl`) has to refuse a missing, non-local or development
// TEST_DATABASE_URL before a single connection is opened (R-07): `pg` is replaced here so any
// connection attempt is recorded instead of made.
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

const REMOTE_URL = "postgresql://user:secret@db.example.com:5432/mi_grilla_test";
const DEVELOPMENT_URL = "postgresql://user:secret@127.0.0.1:5432/mi_grilla";
const LOCAL_TEST_URL = "postgresql://user:secret@127.0.0.1:5432/mi_grilla_test";
const original = {
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};

/**
 * The helper and the guards' error classes from the same fresh module graph: the helper keeps its
 * pool in a module variable, so every test starts from a new one.
 */
async function load() {
  const db = await import("../../e2e/db");
  const { UntruncatableDatabaseError } = await import("../../integration/database-guard");
  const { MissingTestDatabaseError, SameAsDevelopmentDatabaseError } =
    await import("../../test-database");
  return {
    db,
    UntruncatableDatabaseError,
    MissingTestDatabaseError,
    SameAsDevelopmentDatabaseError,
  };
}

function restore(name: keyof typeof original): void {
  const value = original[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("tests/e2e/db.ts", () => {
  beforeEach(() => {
    connections.opened = 0;
    vi.resetModules();
    process.env.DATABASE_URL = DEVELOPMENT_URL;
  });

  afterEach(() => {
    restore("TEST_DATABASE_URL");
    restore("DATABASE_URL");
  });

  it("test-e2e-db-guard-rejected: el helper con una TEST_DATABASE_URL no local es rechazado antes de conectarse", async () => {
    process.env.TEST_DATABASE_URL = REMOTE_URL;
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

  it("sin TEST_DATABASE_URL también se rechaza antes de conectarse", async () => {
    // `.env` would fill it back in: an empty value is one dotenv never overrides.
    process.env.TEST_DATABASE_URL = "";
    const { db, MissingTestDatabaseError } = await load();

    await expect(db.userIdByEmail("e2e@example.com")).rejects.toBeInstanceOf(
      MissingTestDatabaseError,
    );
    expect(connections.opened).toBe(0);
  });

  it("con la base de desarrollo como TEST_DATABASE_URL es rechazado antes de conectarse", async () => {
    process.env.TEST_DATABASE_URL = DEVELOPMENT_URL;
    const { db, SameAsDevelopmentDatabaseError } = await load();

    await expect(db.userIdByEmail("e2e@example.com")).rejects.toBeInstanceOf(
      SameAsDevelopmentDatabaseError,
    );
    expect(connections.opened).toBe(0);
  });

  it("con una base de tests local sí se conecta", async () => {
    process.env.TEST_DATABASE_URL = LOCAL_TEST_URL;
    const { db } = await load();

    await expect(db.userIdByEmail("e2e@example.com")).rejects.toThrow("no debería consultar");
    expect(connections.opened).toBe(1);
  });
});
