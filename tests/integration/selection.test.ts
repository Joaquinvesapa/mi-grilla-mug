import { describe, expect, it } from "vitest";

import { getDb } from "@/server/db";
import { getSelection, saveSelection } from "@/server/selection";

const LATENCY_BUDGET_MS = 1_000;

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? Number.POSITIVE_INFINITY;
}

/** A user row straight in the table: these tests are about the selection, not about sign-up. */
async function createUser(id: string): Promise<string> {
  await getDb().user.create({ data: { id, name: id, email: `${id}@mail.com` } });
  return id;
}

/** The seeded show ids (the base is migrated and seeded), in start order. */
async function showIds(): Promise<string[]> {
  const rows = await getDb().show.findMany({
    select: { id: true },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });
  expect(rows, "seeded shows (pnpm db:seed)").toHaveLength(91);
  return rows.map((row) => row.id);
}

async function storedIds(userId: string): Promise<string[]> {
  const rows = await getDb().selectedShow.findMany({ where: { userId }, select: { showId: true } });
  return rows.map((row) => row.showId).sort();
}

describe("selection", () => {
  it("test-selection-save-replace: saving [a, b] and then [b, c] leaves exactly {b, c}, and getSelection returns it", async () => {
    const [a = "", b = "", c = ""] = await showIds();
    const userId = await createUser("ana");

    expect(await saveSelection(userId, [a, b])).toStrictEqual({ ok: true });
    expect(await saveSelection(userId, [b, c])).toStrictEqual({ ok: true });

    expect(await storedIds(userId)).toStrictEqual([b, c].sort());
    const selection = await getSelection(userId);
    expect(selection.ok).toBe(true);
    expect(selection.ok && [...selection.showIds].sort()).toStrictEqual([b, c].sort());
  });

  it("test-selection-isolated-users: one account's selection never shows up in another's, and deleting the user deletes its rows", async () => {
    const [a = "", b = "", c = ""] = await showIds();
    const ana = await createUser("ana");
    const beto = await createUser("beto");

    expect(await saveSelection(ana, [a, b])).toStrictEqual({ ok: true });
    expect(await saveSelection(beto, [c])).toStrictEqual({ ok: true });

    expect(await getSelection(beto)).toStrictEqual({ ok: true, showIds: [c] });
    expect(await getSelection("nadie")).toStrictEqual({ ok: true, showIds: [] });

    await getDb().user.delete({ where: { id: ana } });
    expect(await getDb().selectedShow.count({ where: { userId: ana } })).toBe(0);
    expect(await storedIds(beto)).toStrictEqual([c]);
  });

  it("test-selection-concurrent: two simultaneous saves of the same user end with exactly one of both sets, never a mix", async () => {
    const ids = await showIds();
    const first = ids.slice(0, 5).sort();
    const second = ids.slice(5, 10).sort();
    const userId = await createUser("ana");

    for (let round = 0; round < 10; round += 1) {
      const results = await Promise.all([
        saveSelection(userId, first),
        saveSelection(userId, second),
      ]);
      expect(results).toStrictEqual([{ ok: true }, { ok: true }]);
      const stored = await storedIds(userId);
      expect([first, second]).toContainEqual(stored);
    }
  });

  it("an unknown id is rejected and the stored selection stays as it was", async () => {
    const [a = ""] = await showIds();
    const userId = await createUser("ana");
    await saveSelection(userId, [a]);

    expect(await saveSelection(userId, [a, "fri-nope-0000"])).toStrictEqual({
      ok: false,
      code: "INVALID_SELECTION",
    });
    expect(await storedIds(userId)).toStrictEqual([a]);
  });

  it(
    "test-selection-latency: p95 of 20 saves of 10 shows is within 1000 ms, after 1 warm-up",
    { timeout: 60_000 },
    async () => {
      const ids = await showIds();
      const userId = await createUser("ana");
      await saveSelection(userId, ids.slice(0, 10));

      const samples: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        const chosen = ids.slice(i, i + 10);
        const startedAt = performance.now();
        const result = await saveSelection(userId, chosen);
        samples.push(performance.now() - startedAt);
        expect(result).toStrictEqual({ ok: true });
      }

      expect(await storedIds(userId)).toHaveLength(10);
      expect(p95(samples)).toBeLessThanOrEqual(LATENCY_BUDGET_MS);
    },
  );
});
