import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { expect, test, type Page } from "@playwright/test";

// Runs only in the `desktop` project (1280×800): /demo is the desktop showcase (playwright.config).

function appFrame(page: Page) {
  return page.frameLocator('iframe[title="Mi Grilla"]');
}

test.describe("/demo con marco de iPhone", () => {
  test("se ve el marco con la app adentro, entero y sin scroll de página (AC-06, NFR-02)", async ({
    page,
  }) => {
    await page.goto("/demo");

    const frame = page.getByTestId("iphone-frame");
    await expect(frame).toBeVisible();
    const iframe = page.locator('iframe[title="Mi Grilla"]');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute("src", "/");
    await expect(
      appFrame(page).getByRole("heading", { level: 1, name: "Mi Grilla" }),
    ).toBeVisible();

    const metrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
    }));
    expect(metrics.innerWidth).toBe(1280);
    expect(metrics.innerHeight).toBe(800);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);

    // The whole phone, bezel included, inside the viewport.
    await expect(async () => {
      const box = await frame.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(metrics.innerWidth);
      expect(box!.y + box!.height).toBeLessThanOrEqual(metrics.innerHeight);
      // Scaled down to fit 800 px, but still the size of a phone, not a thumbnail.
      expect(box!.height).toBeGreaterThan(600);
    }).toPass();
  });

  // The wheel half relies on `/` being taller than the 852 px screen once the install guide is
  // open: with nothing to scroll, the wheel cannot move it. The precondition is asserted below, so
  // a shorter home fails as that and not as a /demo bug.
  test("la app del marco responde a clicks y al scroll con la rueda (AC-07)", async ({ page }) => {
    await page.goto("/demo");
    const app = appFrame(page);

    const trigger = app.getByRole("button", { name: "Cómo instalarla" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(app.getByRole("listitem")).toHaveCount(3);

    const iframe = page.locator('iframe[title="Mi Grilla"]');
    const appWindow = await (await iframe.elementHandle()).contentFrame();
    expect(appWindow, "no se encontró el frame de la app").not.toBeNull();
    const fit = await appWindow!.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(
      fit.scrollHeight,
      "precondición: / con la guía desplegada tiene que ser más alta que la pantalla para poder scrollear",
    ).toBeGreaterThan(fit.innerHeight);
    await appWindow!.evaluate(() => window.scrollTo(0, 0));
    expect(await appWindow!.evaluate(() => window.scrollY)).toBe(0);

    const box = await iframe.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 400);

    await expect.poll(() => appWindow!.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    // The page around the phone does not move.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("clickjacking (R-08)", () => {
  test("/ y /demo responden con X-Frame-Options SAMEORIGIN y frame-ancestors 'self'", async ({
    request,
  }) => {
    for (const path of ["/", "/demo"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["x-frame-options"], path).toBe("SAMEORIGIN");
      expect(headers["content-security-policy"], path).toMatch(/frame-ancestors 'self'/);
    }
  });

  test.describe("embebida desde otro origen", () => {
    let server: Server | undefined;
    let foreignOrigin: string;

    test.beforeAll(async ({ baseURL }) => {
      const foreign = createServer((req, res) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        if (req.url === "/control") {
          res.end("<!doctype html><title>control</title><p>control listo</p>");
          return;
        }
        res.end(
          `<!doctype html><title>sitio ajeno</title>
          <iframe id="control" src="/control"></iframe>
          <iframe id="app" src="${baseURL}/"></iframe>`,
        );
      });
      server = foreign;
      await new Promise<void>((resolve) => foreign.listen(0, "127.0.0.1", resolve));
      foreignOrigin = `http://127.0.0.1:${(foreign.address() as AddressInfo).port}`;
    });

    test.afterAll(async () => {
      // beforeAll may have failed before creating it.
      const foreign = server;
      if (!foreign) return;
      await new Promise((resolve) => foreign.close(resolve));
    });

    test("otro origen (otro puerto) no puede mostrar la app en un iframe", async ({
      page,
      baseURL,
    }) => {
      expect(new URL(foreignOrigin).origin).not.toBe(new URL(baseURL!).origin);

      // `load` waits for both frames, the refused one included.
      await page.goto(foreignOrigin, { waitUntil: "load" });

      // Control: a frameable page in the same setup does render, so the check below is not vacuous.
      await expect(page.frameLocator("#control").getByText("control listo")).toBeVisible();

      const app = await (await page.locator("#app").elementHandle()).contentFrame();
      expect(app, "el iframe no tiene frame").not.toBeNull();
      await expect(app!.getByRole("heading", { level: 1, name: "Mi Grilla" })).toHaveCount(0);
      expect(await app!.evaluate(() => document.title)).not.toBe("Mi Grilla");
    });
  });
});
