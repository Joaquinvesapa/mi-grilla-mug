import { expect, type Locator, type Page } from "@playwright/test";

import { GROUP_NAME_MAX_LENGTH } from "@/lib/group-rules";
import {
  PERSONAL_OPTION_LABEL,
  WALLPAPER_CHOICE_LABEL,
  WALLPAPER_GROUP_LABEL,
  WITH_FRIENDS_OPTION_LABEL,
} from "@/lib/wallpaper-messages";

import { signUp } from "./auth";
import { insertFriends, insertGroup, userIdByEmail } from "./db";
import { showById, showsOfDay } from "./grid";
import { GROUP_NAME, test } from "./groups";
import { goOffline, readDeviceCopy, reopenOffline, signUpControlled } from "./offline";
import {
  DOWNLOAD_IMAGE,
  downloadFrom,
  expectGuide,
  expectWallpaperPng,
  openWallpaper,
  PREVIEW_BUDGET_MS,
  readDownload,
  readPreviewTiming,
  sheet,
  trackPreviewTiming,
  waitForPreview,
  wallpaperButton,
  withoutShare,
} from "./wallpaper";

// FEAT-007, Block 4: the group's wallpaper end to end, against the production build with its
// service worker (ADR-002). Runs in the three mobile projects (iphone-webkit, mobile-chromium,
// mobile-360); `desktop` only runs /demo. The viewer signs up through the UI; their groups, the
// friends and the friends' saved selections are written straight into the test database by `db.ts`.
// Every test builds its own groups, so the projects running in parallel never share a row. The
// delivery is forced to the download (`withoutShare`) so the file can be read.

/** Tyler, The Creator on Friday, the day `/` opens on outside the festival. By stable id. */
const TYLER = showById("fri-flow-2215").id;
/** Every Friday show: what each of the 19 friends of the budget test picked (NFR-01). */
const FRIDAY = showsOfDay("fri").map((show) => show.id);
/** A full group: the viewer and 19 friends (`MAX_GROUP_MEMBERS` = 20). */
const FRIENDS_IN_FULL_GROUP = 19;

const OTHER_GROUP = "Los del laburo";
/** A group name as long as the server takes, so the sheet's select has to truncate it. */
const LONG_GROUP_NAME = "Los amigos del Lolla que van a todo 2026";
const MINUTE_MS = 60 * 1000;

/** Why the budget test runs in one project (AGENTS.md: the reason, on the skipped line). */
const BUDGET_SKIP =
  "AC-19 se mide como referencia solo en iphone-webkit; el iPhone 12 real se mide a mano en VERIFY";

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Eva",
  "Facundo",
  "Gala",
  "Hernán",
  "Inés",
  "Juan",
  "Karina",
  "Lucas",
  "Mora",
  "Nicolás",
  "Olivia",
  "Pablo",
  "Quimey",
  "Rocío",
  "Santiago",
];
const LAST_NAMES = ["Pérez", "Díaz", "Ruiz", "Sosa", "Luna", "Gómez", "Ríos", "Vega"];

function choiceButton(page: Page, label: string): Locator {
  return sheet(page).getByRole("button", { name: label, exact: true });
}

/** The sheet's group select, "Grupo del fondo" (a native select, so a combobox). */
function wallpaperGroupPicker(page: Page): Locator {
  return sheet(page).getByRole("combobox", { name: WALLPAPER_GROUP_LABEL, exact: true });
}

/** Signs up the viewer through the UI and returns their user id, read from the database. */
async function signUpViewer(page: Page, testInfo: Parameters<typeof signUp>[1]): Promise<string> {
  const account = await signUp(page, testInfo);
  return userIdByEmail(account.email);
}

/** "Los del Lolla" with the viewer in it and Bruno, who picked Tyler, The Creator. */
async function lollaWithBruno(viewerId: string): Promise<void> {
  const group = await insertGroup({
    name: GROUP_NAME,
    members: [viewerId],
    joinedAt: new Date(Date.now() - MINUTE_MS),
  });
  await insertFriends(group, [{ name: "Bruno Díaz", showIds: [TYLER] }]);
}

/**
 * Taps "Descargar fondo" and waits for the sheet, which opens on "Grilla sola" already drawn: the
 * options refuse while drawing, so the next tap has to wait for the personal preview.
 */
async function openSheet(page: Page): Promise<void> {
  await wallpaperButton(page).click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByText(WALLPAPER_CHOICE_LABEL, { exact: true })).toBeVisible();
  await waitForPreview(page, "fri", DOWNLOAD_IMAGE);
}

test.describe("el fondo de pantalla del grupo (FEAT-007)", () => {
  // A sign-up, a reload or two and up to 20 members' picks per test; the margin is for a slow CI.
  test.describe.configure({ timeout: 120_000 });

  test('test-e2e-wallpaper-group-default: en un grupo, "Descargar fondo" ofrece "Grilla sola" o "Con amigos" y ya dibuja "Grilla sola" sin tocar nada (color-en-vivo, S7)', async ({
    page,
  }, testInfo) => {
    await withoutShare(page);
    const viewerId = await signUpViewer(page, testInfo);
    await lollaWithBruno(viewerId);
    await page.reload();

    await openSheet(page);
    await expect(choiceButton(page, WITH_FRIENDS_OPTION_LABEL)).toBeVisible();
    await expect(choiceButton(page, PERSONAL_OPTION_LABEL)).toHaveAttribute("aria-pressed", "true");
    await expect(choiceButton(page, WITH_FRIENDS_OPTION_LABEL)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // The personal preview (no group name in its alt) is drawn on open, without pressing an
    // option (S7).
    await waitForPreview(page, "fri", DOWNLOAD_IMAGE);
  });

  test('test-e2e-wallpaper-group-download: un solo grupo "Los del Lolla" y un amigo que eligió Tyler: "Con amigos" descarga mi-grilla-viernes-los-del-lolla.png, un PNG de 1290 × 2796 y ≤ 5 MB, y muestra la guía (AC-03, AC-16, AC-18, NFR-04)', async ({
    page,
  }, testInfo) => {
    await withoutShare(page);
    const viewerId = await signUpViewer(page, testInfo);
    await lollaWithBruno(viewerId);
    await page.reload();

    await openSheet(page);
    await choiceButton(page, WITH_FRIENDS_OPTION_LABEL).click();
    const action = await waitForPreview(page, "fri", DOWNLOAD_IMAGE, GROUP_NAME);
    await expect(choiceButton(page, WITH_FRIENDS_OPTION_LABEL)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // AC-03: a single group, so no select to change it.
    await expect(wallpaperGroupPicker(page)).toHaveCount(0);

    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-viernes-los-del-lolla.png");
    await expectGuide(page);
    expectWallpaperPng(await readDownload(page, download));
  });

  test('test-e2e-wallpaper-group-budget: con 19 amigos que eligieron todo el viernes, desde "Con amigos" hasta la vista previa pasan ≤ 3000 ms (AC-19, NFR-01)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "iphone-webkit", BUDGET_SKIP); // AC-19 se mide solo en WebKit (iPhone)
    await withoutShare(page);
    // Timed by the page itself: from the first pointerdown on "Con amigos" to the preview's load.
    // With groups "Grilla sola" is drawn on opening, before that tap (`openSheet` waits for it),
    // so the first preview after the tap is the group's.
    await trackPreviewTiming(page, WITH_FRIENDS_OPTION_LABEL);
    const viewerId = await signUpViewer(page, testInfo);
    const group = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(Date.now() - MINUTE_MS),
    });
    await insertFriends(
      group,
      Array.from({ length: FRIENDS_IN_FULL_GROUP }, (_, index) => ({
        name: `${FIRST_NAMES[index]!} ${LAST_NAMES[index % LAST_NAMES.length]!}`,
        showIds: FRIDAY,
      })),
    );
    await page.reload();

    await openSheet(page);
    await choiceButton(page, WITH_FRIENDS_OPTION_LABEL).click();
    await waitForPreview(page, "fri", DOWNLOAD_IMAGE, GROUP_NAME);
    const timing = await readPreviewTiming(page);
    expect(timing.tap, "no se registró el toque").not.toBeNull();
    expect(timing.preview, "no se registró la carga de la vista previa").not.toBeNull();
    const elapsed = timing.preview! - timing.tap!;
    testInfo.annotations.push({
      type: "AC-19",
      description: `de "Con amigos" a la vista previa, 19 amigos: ${Math.round(elapsed)} ms`,
    });
    expect(elapsed, "la vista previa del grupo tardó más de 3 s (AC-19)").toBeLessThanOrEqual(
      PREVIEW_BUDGET_MS,
    );
  });

  test("test-e2e-wallpaper-group-no-groups: sin grupos la hoja genera directamente el fondo personal, sin pregunta (AC-05)", async ({
    page,
  }, testInfo) => {
    await withoutShare(page);
    await signUp(page, testInfo);

    // `openWallpaper` waits for the personal preview right after the tap: nothing else is pressed.
    const action = await openWallpaper(page, "fri", DOWNLOAD_IMAGE);
    await expect(sheet(page).getByText(WALLPAPER_CHOICE_LABEL, { exact: true })).toHaveCount(0);
    await expect(choiceButton(page, PERSONAL_OPTION_LABEL)).toHaveCount(0);
    await expect(choiceButton(page, WITH_FRIENDS_OPTION_LABEL)).toHaveCount(0);

    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-viernes.png");
    expectWallpaperPng(await readDownload(page, download));
  });

  test('test-e2e-wallpaper-group-offline: con el grupo en la copia del dispositivo, sin conexión "Con amigos" genera y descarga el fondo del grupo (AC-15)', async ({
    page,
    context,
  }, testInfo) => {
    await withoutShare(page);
    const { account } = await signUpControlled(page, testInfo);
    await lollaWithBruno(await userIdByEmail(account.email));

    // The last load with a connection: it writes the group into the device copy.
    await page.reload();
    await expect
      .poll(async () => (await readDeviceCopy(page))?.groups?.map((item) => item.name) ?? [], {
        message: "la copia del dispositivo no guardó el grupo",
      })
      .toEqual([GROUP_NAME]);

    await goOffline(page, context);
    await reopenOffline(page);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);

    await openSheet(page);
    await choiceButton(page, WITH_FRIENDS_OPTION_LABEL).click();
    const action = await waitForPreview(page, "fri", DOWNLOAD_IMAGE, GROUP_NAME);
    const download = await downloadFrom(page, action);
    expect(download.suggestedFilename()).toBe("mi-grilla-viernes-los-del-lolla.png");
    await expectGuide(page);
    expectWallpaperPng(await readDownload(page, download));
  });

  test('test-e2e-wallpaper-group-long-name-fits: a 360 px, con dos grupos y uno de 40 caracteres, "Grupo del fondo" queda dentro de la hoja y de la pantalla', async ({
    page,
  }, testInfo) => {
    expect(Array.from(LONG_GROUP_NAME)).toHaveLength(GROUP_NAME_MAX_LENGTH);
    // Measured at 360 px wide in every project (mobile-360 already is).
    const viewport = { width: 360, height: 780 };
    await page.setViewportSize(viewport);
    await withoutShare(page);
    const viewerId = await signUpViewer(page, testInfo);
    const base = Date.now() - 10 * MINUTE_MS;
    const other = await insertGroup({
      name: OTHER_GROUP,
      members: [viewerId],
      joinedAt: new Date(base),
    });
    await insertFriends(other, [{ name: "Diego Sosa", showIds: [TYLER] }]);
    // Joined last, so it is the one the grid and the sheet start with.
    const long = await insertGroup({
      name: LONG_GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(base + MINUTE_MS),
    });
    await insertFriends(long, [{ name: "Bruno Díaz", showIds: [TYLER] }]);
    await page.reload();

    await openSheet(page);
    await choiceButton(page, WITH_FRIENDS_OPTION_LABEL).click();
    // Drawn for the long-named group, and with the question and the select above the preview the
    // delivery button is still fully on screen without scrolling: it is stuck to the bottom of the
    // sheet's body (the user's decision, decisions-FEAT-007.md).
    const action = await waitForPreview(page, "fri", DOWNLOAD_IMAGE, LONG_GROUP_NAME);

    const picker = wallpaperGroupPicker(page);
    await expect(picker).toBeVisible();
    await expect(picker).toHaveValue(long);
    const pickerBox = await picker.boundingBox();
    const sheetBox = await sheet(page).boundingBox();
    expect(pickerBox, "el selector no tiene caja").not.toBeNull();
    expect(sheetBox, "la hoja no tiene caja").not.toBeNull();
    expect(pickerBox!.x, "el selector empieza fuera de la hoja").toBeGreaterThanOrEqual(
      sheetBox!.x,
    );
    expect(
      pickerBox!.x + pickerBox!.width,
      "el selector se sale de la hoja por la derecha",
    ).toBeLessThanOrEqual(sheetBox!.x + sheetBox!.width + 0.5);
    expect(
      pickerBox!.x + pickerBox!.width,
      "el selector se sale de la pantalla",
    ).toBeLessThanOrEqual(viewport.width);
    // 44 px tall, a tap target (mobile-native).
    expect(pickerBox!.height).toBeGreaterThanOrEqual(44);
    // The delivery button, with the select on screen: whole inside the sheet and the screen, below
    // the select, and 44 px tall (mobile-native).
    const deliveryBox = await action.boundingBox();
    expect(deliveryBox, "el botón de entrega no tiene caja").not.toBeNull();
    expect(deliveryBox!.y, "el botón de entrega queda arriba del selector").toBeGreaterThan(
      pickerBox!.y + pickerBox!.height,
    );
    expect(
      deliveryBox!.y + deliveryBox!.height,
      `"${DOWNLOAD_IMAGE}" se sale por abajo de la pantalla`,
    ).toBeLessThanOrEqual(viewport.height);
    expect(
      deliveryBox!.y + deliveryBox!.height,
      `"${DOWNLOAD_IMAGE}" se sale por abajo de la hoja`,
    ).toBeLessThanOrEqual(sheetBox!.y + sheetBox!.height + 0.5);
    expect(deliveryBox!.height).toBeGreaterThanOrEqual(44);
    const widths = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(widths.documentScrollWidth, "la página scrollea en horizontal").toBeLessThanOrEqual(
      widths.innerWidth,
    );
  });
});
