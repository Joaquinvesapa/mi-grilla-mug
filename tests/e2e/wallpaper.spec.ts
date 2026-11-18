import { expect, test } from "@playwright/test";

import { signUp } from "./auth";
import { chooseDay, pendingBar, saveSelection, showBlock, showById } from "./grid";
import {
  expectChosen,
  notice,
  readPendingIds,
  reopenOffline,
  saveOffline,
  signUpControlled,
} from "./offline";
import {
  BUTTON_LABEL,
  DONE_LABEL,
  DOWNLOAD_IMAGE,
  downloadFrom,
  EDGE_CLEARANCE,
  expectGuide,
  expectWallpaperPng,
  openWallpaper,
  placeProbe,
  PREVIEW_BUDGET_MS,
  probeAt,
  probesFor,
  readDownload,
  readPng,
  readPreviewTiming,
  readShareSpy,
  SAVE_TO_PHOTOS,
  sheet,
  showsAt,
  trackPreviewTiming,
  useShareSpy,
  wallpaperButton,
  withoutShare,
} from "./wallpaper";

// FEAT-004 end to end, against the production build with its service worker (ADR-002, ADR-005):
// the wallpaper comes out at 1290 × 2796, with the selection on screen, with and without a
// connection, through both deliveries. Runs in the three mobile projects (iphone-webkit,
// mobile-chromium, mobile-360): playwright.config.ts does not exclude this file from any of them.
// Every test signs up an account of its own. The shared steps (the share spy, the download path,
// decoding the PNG and its probes) live in `wallpaper.ts`.

const SHARE_FAILED_MESSAGE =
  "No pudimos abrir la opción de guardar en Fotos. Descargá la imagen o mantené apretada la vista previa para guardarla en Fotos.";

const PHONE_WIDTHS = [
  { width: 360, height: 780 },
  { width: 430, height: 932 },
];
/** Why the timing test runs in one project (AGENTS.md: the reason, on the skipped line). */
const TIME_SKIP =
  "AC-15 se mide como referencia solo en iphone-webkit; el iPhone 12 real se mide a mano en VERIFY";

// Friday, the day the grid opens on outside the festival. By stable id, never by artist.
const TYLER = showById("fri-flow-2215").id; // Tyler, The Creator
const LORDE = showById("fri-samsung-2100").id; // Lorde
const UNCHOSEN = showById("fri-flow-1800").id;
// AC-09: two places on the Flow column that only Saturday's image paints the way it does. Friday and
// Saturday share the axis (13:00 to 01:00), so a place is the same pixel on both images.
/** Saturday's Flow runs to 23:45; Friday's ends at 23:30: at 23:38 only Saturday has a block. */
const SAT_ONLY = { show: showById("sat-flow-2215").id, at: "23:38" };
/** Friday's Flow plays from 20:00; Saturday's is empty from 19:00 to 20:15: 20:08 is background. */
const FRI_ONLY = { show: showById("fri-flow-2000").id, at: "20:08" };

test.describe("el fondo de pantalla (FEAT-004)", () => {
  test('test-e2e-wallpaper-share: viernes con Tyler y Lorde guardados, "Guardar en Fotos" comparte un PNG de 1290 × 2796 y ≤ 5 MB llamado mi-grilla-viernes.png y muestra la guía (AC-01, AC-03, AC-13, NFR-04)', async ({
    page,
  }, testInfo) => {
    await useShareSpy(page);
    await signUpControlled(page, testInfo);
    await showBlock(page, TYLER).click();
    await showBlock(page, LORDE).click();
    await saveSelection(page);

    const action = await openWallpaper(page, "fri", SAVE_TO_PHOTOS);
    await action.click();
    await expectGuide(page);

    const spy = await readShareSpy(page);
    expect(spy.calls, "share se llamó una vez").toBe(1);
    // canShare was asked about the very file that was shared.
    expect(spy.asked).toContain("mi-grilla-viernes.png");
    const png = await readPng(page, { kind: "shared" }, probesFor([TYLER, LORDE, UNCHOSEN]));
    expect(png.name).toBe("mi-grilla-viernes.png");
    expectWallpaperPng(png);
    // The saved selection lit, the rest dimmed (AC-05).
    expect(png.shades).toEqual({ [TYLER]: "lit", [LORDE]: "lit", [UNCHOSEN]: "dimmed" });
  });

  test('test-e2e-wallpaper-download: sin canShare, en el sábado "Descargar imagen" descarga mi-grilla-sabado.png (AC-02, AC-09)', async ({
    page,
  }, testInfo) => {
    await withoutShare(page);
    await signUpControlled(page, testInfo);
    await chooseDay(page, "sat");

    const action = await openWallpaper(page, "sat", DOWNLOAD_IMAGE);
    await expect(sheet(page).getByRole("button", { name: SAVE_TO_PHOTOS })).toHaveCount(0);
    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-sabado.png");
    await expectGuide(page);

    // AC-09: the image is Saturday's grid. Nothing is chosen, so every show is lit (FR-05): the
    // place only Saturday fills is lit, and the place only Friday fills is background.
    const satOnly = probeAt("solo-sábado", "sat", "flow", SAT_ONLY.at, SAT_ONLY.show);
    const friOnly = probeAt("solo-viernes", "fri", "flow", FRI_ONLY.at, FRI_ONLY.show);
    const friOnlyOnSat = placeProbe("solo-viernes", "sat", "flow", friOnly.y, null);
    // The two places tell the days apart: each is empty on the other day's image.
    expect(
      showsAt("fri", "flow", satOnly.y, EDGE_CLEARANCE),
      "el viernes no está vacío ahí",
    ).toEqual([]);
    expect(friOnlyOnSat.y, "la sonda del viernes se movió en la imagen del sábado").toBe(friOnly.y);
    const png = await readDownload(page, download, [satOnly, friOnlyOnSat]);
    expectWallpaperPng(png);
    expect(png.shades).toEqual({ "solo-sábado": "lit", "solo-viernes": "background" });
  });

  test("test-e2e-wallpaper-unsaved: un show marcado sin Guardar entra en el fondo y el cambio sigue pendiente (AC-10)", async ({
    page,
  }, testInfo) => {
    await withoutShare(page);
    await signUpControlled(page, testInfo);
    await showBlock(page, TYLER).click();
    await expect(pendingBar(page)).toBeVisible();

    const action = await openWallpaper(page, "fri", DOWNLOAD_IMAGE);
    const probes = probesFor([TYLER, LORDE]);
    // The preview already draws the draft: only the unsaved show is lit.
    expect((await readPng(page, { kind: "preview" }, probes)).shades).toEqual({
      [TYLER]: "lit",
      [LORDE]: "dimmed",
    });
    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-viernes.png");
    const png = await readDownload(page, download, probes);
    expectWallpaperPng(png);
    expect(png.shades).toEqual({ [TYLER]: "lit", [LORDE]: "dimmed" });

    // Downloading did not save anything: the change is still pending on screen.
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(pendingBar(page)).toBeVisible();
    await expectChosen(page, TYLER, true);
  });

  test("test-e2e-wallpaper-offline-pending: sin conexión guarda un show, recarga / sin conexión y el fondo se genera y se descarga con esa selección (AC-11, AC-12)", async ({
    page,
    context,
  }, testInfo) => {
    await withoutShare(page);
    const { userId } = await signUpControlled(page, testInfo);
    await saveOffline(page, context, TYLER);
    expect(await readPendingIds(page, userId)).toEqual([TYLER]);

    await reopenOffline(page);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    await expect(notice(page)).toBeVisible();
    await expectChosen(page, TYLER, true);
    await expect(wallpaperButton(page)).toBeEnabled();

    const action = await openWallpaper(page, "fri", DOWNLOAD_IMAGE);
    const probes = probesFor([TYLER, LORDE]);
    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-viernes.png");
    await expectGuide(page);
    const png = await readDownload(page, download, probes);
    expectWallpaperPng(png);
    // The pending selection, not yet on the server, is what the image lights.
    expect(png.shades).toEqual({ [TYLER]: "lit", [LORDE]: "dimmed" });
    // Still pending: nothing here syncs it.
    expect(await readPendingIds(page, userId)).toEqual([TYLER]);
  });

  test('test-e2e-wallpaper-share-rejected-error: share rechazado con NotAllowedError muestra la alerta y "Descargar imagen" descarga el fondo', async ({
    page,
  }, testInfo) => {
    await useShareSpy(page, "NotAllowedError");
    await signUpControlled(page, testInfo);

    const share = await openWallpaper(page, "fri", SAVE_TO_PHOTOS);
    await share.click();

    await expect(sheet(page).getByRole("alert")).toHaveText(SHARE_FAILED_MESSAGE);
    // Neither the browser's message nor the guide: the image was not saved.
    await expect(sheet(page).getByText("rechazado por el test")).toHaveCount(0);
    await expect(sheet(page).getByText(DONE_LABEL)).toHaveCount(0);
    expect((await readShareSpy(page)).calls).toBe(1);

    const download = sheet(page).getByRole("button", { name: DOWNLOAD_IMAGE, exact: true });
    await expect(download).toBeEnabled();
    const file = await downloadFrom(page, download);
    expect(file.suggestedFilename()).toBe("mi-grilla-viernes.png");
    await expectGuide(page);
    expectWallpaperPng(await readDownload(page, file));
  });

  test("test-e2e-wallpaper-time: desde el toque hasta la vista previa pasan ≤ 3000 ms (referencia de AC-15)", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "iphone-webkit", TIME_SKIP); // AC-15 se mide solo en WebKit (iPhone)
    await withoutShare(page);
    // Timed by the page itself: from the first pointerdown on the button to the preview's load.
    await trackPreviewTiming(page, BUTTON_LABEL);
    await signUpControlled(page, testInfo);
    await showBlock(page, TYLER).click();
    await saveSelection(page);

    await openWallpaper(page, "fri", DOWNLOAD_IMAGE);
    const timing = await readPreviewTiming(page);
    expect(timing.tap, "no se registró el toque").not.toBeNull();
    expect(timing.preview, "no se registró la carga de la vista previa").not.toBeNull();
    const elapsed = timing.preview! - timing.tap!;
    testInfo.annotations.push({
      type: "AC-15",
      description: `del toque a la vista previa: ${Math.round(elapsed)} ms`,
    });
    expect(elapsed, "la vista previa tardó más de 3 s (AC-15)").toBeLessThanOrEqual(
      PREVIEW_BUDGET_MS,
    );
  });

  for (const viewport of PHONE_WIDTHS) {
    test(`test-e2e-wallpaper-tap-target: a ${viewport.width} px el botón mide ≥ 44 × 44 y la fila de los días no tiene scroll horizontal`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await signUp(page, testInfo);
      await expect(page.getByRole("tab", { name: "Viernes", exact: true })).toBeVisible();

      const button = wallpaperButton(page);
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box, "el botón no tiene caja").not.toBeNull();
      expect(box!.width, "ancho del botón").toBeGreaterThanOrEqual(44);
      expect(box!.height, "alto del botón").toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, "el botón se sale de la pantalla").toBeLessThanOrEqual(
        viewport.width,
      );

      // The row is the tab list's parent: the days and the button, side by side.
      const row = page.getByRole("tablist").locator("xpath=..");
      await expect(row.getByRole("button", { name: BUTTON_LABEL })).toHaveCount(1);
      const sizes = await row.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        right: element.getBoundingClientRect().right,
        documentScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(sizes.scrollWidth, "la fila de los días scrollea en horizontal").toBeLessThanOrEqual(
        sizes.clientWidth,
      );
      expect(sizes.right, "la fila de los días se sale de la pantalla").toBeLessThanOrEqual(
        viewport.width,
      );
      expect(sizes.documentScrollWidth, "la página scrollea en horizontal").toBeLessThanOrEqual(
        sizes.innerWidth,
      );
      // Every day still has its tap target next to the button.
      for (const tab of await page.getByRole("tab").all()) {
        const tabBox = await tab.boundingBox();
        expect(tabBox!.height, "alto del día").toBeGreaterThanOrEqual(44);
      }
    });
  }
});
