import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { MAX_GROUP_MEMBERS } from "@/lib/group-rules";

import { signUp } from "./auth";
import { insertFriends, insertGroup, insertSelection, userIdByEmail } from "./db";
import { gridRegion, showsOfDay } from "./grid";

/** A full group: everyone but the viewer (AC-30). */
const MAX_FRIENDS = MAX_GROUP_MEMBERS - 1;

const LOAD_BUDGET_MS = 3000;
/** NFR-01 of FEAT-003a: the day's grid on screen, whole, in 2 s or less over 4G. */
const GRID_BUDGET_MS = 2000;

// 4G as the spec fixes it: 4 Mbps down, 3 Mbps up, 20 ms of latency (throughput in bytes/s).
const NETWORK_4G = {
  offline: false,
  latency: 20,
  downloadThroughput: (4 * 1_000_000) / 8,
  uploadThroughput: (3 * 1_000_000) / 8,
};

async function emulateNetwork(context: BrowserContext, page: Page, offline: boolean) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { ...NETWORK_4G, offline });
}

/**
 * Loads `path` and returns the `load` event time from the navigation timing entry. A navigation
 * that does not finish (a network error, a server error) fails with the time it had been waiting.
 */
async function measureLoad(page: Page, path: string): Promise<number> {
  const started = Date.now();
  try {
    const response = await page.goto(path, { waitUntil: "load", timeout: 15_000 });
    if (!response?.ok()) throw new Error(`respuesta ${response?.status() ?? "vacía"}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : String(error);
    throw new Error(`La carga de ${path} falló tras ${Date.now() - started} ms: ${reason}`);
  }
  return page.evaluate(() => {
    const [navigation] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    return navigation ? navigation.loadEventEnd : Number.NaN;
  });
}

function expectWithinBudget(path: string, loadMs: number) {
  test
    .info()
    .annotations.push({ type: "NFR-03", description: `${path}: load en ${loadMs.toFixed(0)} ms` });
  expect(loadMs, `${path}: load en ${loadMs.toFixed(0)} ms`).toBeGreaterThan(0);
  expect(loadMs, `${path}: load en ${loadMs.toFixed(0)} ms`).toBeLessThanOrEqual(LOAD_BUDGET_MS);
}

test.describe("rendimiento con 4G simulada (NFR-03)", () => {
  test(`sin sesión, el evento load de /login llega en ≤ ${LOAD_BUDGET_MS} ms`, async ({
    page,
    context,
  }) => {
    await emulateNetwork(context, page, false);

    expectWithinBudget("/login", await measureLoad(page, "/login"));
  });

  test(`con sesión, el evento load de / llega en ≤ ${LOAD_BUDGET_MS} ms`, async ({
    page,
    context,
  }, testInfo) => {
    // The sign-up is setup, not what is measured: it runs before the network is throttled.
    await signUp(page, testInfo);
    await emulateNetwork(context, page, false);

    const loadMs = await measureLoad(page, "/");

    expect(new URL(page.url()).pathname, "la medición no fue sobre /").toBe("/");
    expectWithinBudget("/", loadMs);
  });

  test("con un error de red la medición falla e informa el tiempo medido", async ({
    page,
    context,
  }) => {
    await emulateNetwork(context, page, true);

    await expect(measureLoad(page, "/login")).rejects.toThrow(
      /^La carga de \/login falló tras \d+ ms: /,
    );
  });
});

test.describe("la grilla con 4G simulada (NFR-01 de FEAT-003a)", () => {
  test(`test-e2e-grid-load-4g: desde la navegación a / hasta ver los bloques del día pasan ≤ ${GRID_BUDGET_MS} ms`, async ({
    page,
    context,
  }, testInfo) => {
    // The sign-up is setup, not what is measured: it runs before the network is throttled.
    await signUp(page, testInfo);
    await emulateNetwork(context, page, false);
    // Outside the festival `/` opens on Friday (FR-08): those are the blocks to wait for.
    const expected = showsOfDay("fri");
    const region = gridRegion(page, "fri");
    const blocks = region.locator("[data-show-id]");

    const started = Date.now();
    await page.goto("/", { waitUntil: "commit" });
    await expect(blocks).toHaveCount(expected.length, { timeout: 15_000 });
    await expect(blocks.first()).toBeVisible({ timeout: 15_000 });
    await expect(region.locator("[data-stage-header]").first()).toBeVisible({ timeout: 15_000 });
    const elapsed = Date.now() - started;

    expect(new URL(page.url()).pathname, "la medición no fue sobre /").toBe("/");
    test
      .info()
      .annotations.push({ type: "NFR-01", description: `/: bloques del día en ${elapsed} ms` });
    expect(elapsed, `/: bloques del día en ${elapsed} ms`).toBeLessThanOrEqual(GRID_BUDGET_MS);
  });
});

test.describe("el grupo en la grilla con 4G simulada (NFR-01 de FEAT-006c)", () => {
  test(`test-e2e-group-grid-load: con 4G, la grilla con 20 integrantes se ve completa con indicadores en ≤ ${GRID_BUDGET_MS} ms`, async ({
    page,
    context,
  }, testInfo) => {
    // Setup, not what is measured: the viewer, a group of 20 (19 friends) where everyone picked the
    // whole of Friday. The network is throttled only after it.
    const account = await signUp(page, testInfo);
    const viewerId = await userIdByEmail(account.email);
    const expected = showsOfDay("fri");
    const fridayIds = expected.map((show) => show.id);
    const groupId = await insertGroup({
      name: "Los del Lolla",
      members: [viewerId],
      joinedAt: new Date(Date.now() - 60_000),
    });
    await insertFriends(
      groupId,
      Array.from({ length: MAX_FRIENDS }, (_, index) => ({
        name: `Amigo ${index + 1}`,
        showIds: fridayIds,
      })),
    );
    await insertSelection(viewerId, fridayIds);
    await emulateNetwork(context, page, false);

    const region = gridRegion(page, "fri");
    const blocks = region.locator("[data-show-id]");
    const indicators = region.locator("[data-friend-picks]");

    const started = Date.now();
    await page.goto("/", { waitUntil: "commit" });
    await expect(blocks).toHaveCount(expected.length, { timeout: 15_000 });
    await expect(indicators).toHaveCount(expected.length, { timeout: 15_000 });
    await expect(blocks.first()).toBeVisible({ timeout: 15_000 });
    await expect(indicators.first()).toBeVisible({ timeout: 15_000 });
    const elapsed = Date.now() - started;

    expect(new URL(page.url()).pathname, "la medición no fue sobre /").toBe("/");
    // Every block of the day carries the 19 friends: 3 initials and "+16".
    await expect(indicators.first()).toContainText(`+${MAX_FRIENDS - 3}`);
    test.info().annotations.push({
      type: "NFR-01",
      description: `/: bloques con indicadores de 20 integrantes en ${elapsed} ms`,
    });
    expect(elapsed, `/: bloques con indicadores en ${elapsed} ms`).toBeLessThanOrEqual(
      GRID_BUDGET_MS,
    );
  });
});
