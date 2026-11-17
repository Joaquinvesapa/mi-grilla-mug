import { expect, type Page } from "@playwright/test";

/**
 * Waits until the service worker is active and controls the page. Without it, no navigation can be
 * answered without a connection. It only runs in the production build that Playwright starts
 * (ADR-002).
 */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state ?? "sin service worker activo";
        }),
      { message: "el service worker no llegó a activarse", timeout: 20_000 },
    )
    .toBe("activated");
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), {
      message: "la página no quedó controlada por el service worker",
      timeout: 10_000,
    })
    .toMatch(/\/serwist\/sw\.js$/);
}
