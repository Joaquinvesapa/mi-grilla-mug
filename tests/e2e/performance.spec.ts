import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { signUp } from "./auth";

const LOAD_BUDGET_MS = 3000;

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
