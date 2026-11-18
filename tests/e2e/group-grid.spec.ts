import { expect, type Locator, type Page } from "@playwright/test";

import { GROUP_PICKER_LABEL, NO_GROUP_OPTION } from "@/lib/group-messages";

import { signUp } from "./auth";
import { DAYS, chooseDay, gridRegion, SCHEDULE, saveSelection, showBlock, showById } from "./grid";
import { insertFriends, insertGroup, userIdByEmail } from "./db";
import { createGroup, GROUP_NAME, join, readInviteLink, test } from "./groups";
import { expectChosen, goOffline, reopenOffline, signUpControlled } from "./offline";

// FEAT-006c, AC-20 to AC-27 and AC-32, end to end on the production build (ADR-002). The one who
// looks at the grid signs up through the UI; the friends and their saved selections are written
// straight into the database by `db.ts` (except in AC-26, where the friend is a real account that
// marks a show without saving). Every test builds its own groups, so the 4 projects running in
// parallel never share a row.

/** Tyler, The Creator on Friday, the day `/` opens on outside the festival (AC-21). */
const TYLER = showById("fri-flow-2215").id;
/** Two other Friday shows, by stable id, for AC-26. */
const SAVED_SHOW = showById("fri-flow-1800").id;
const UNSAVED_SHOW = showById("fri-samsung-2100").id;

const OTHER_GROUP = "Los del laburo";
const MINUTE_MS = 60 * 1000;

/** The picker "Grupo": a native select (a combobox) labelled by its visible label. */
function groupPicker(page: Page): Locator {
  return page.getByRole("combobox", { name: GROUP_PICKER_LABEL, exact: true });
}

/** Every row of friends' initials on screen. */
function friendRows(page: Page): Locator {
  return page.locator("[data-friend-picks]");
}

/** The row of friends' initials of one show's block. */
function friendRow(page: Page, showId: string): Locator {
  return showBlock(page, showId).locator("[data-friend-picks]");
}

/** The initials the row shows, chip by chip ("AP", "BD", "+2"). */
async function chipTexts(row: Locator): Promise<string[]> {
  return (await row.locator(":scope > *").allTextContents()).map((text) => text.trim());
}

/** The name of the option the picker shows as chosen. */
async function chosenGroupName(page: Page): Promise<string> {
  return groupPicker(page).evaluate((select) => {
    const element = select as HTMLSelectElement;
    return element.selectedOptions[0]?.textContent?.trim() ?? "";
  });
}

/** Signs up the viewer through the UI and returns their user id, read from the database. */
async function signUpViewer(
  page: Page,
  testInfo: Parameters<typeof signUp>[1],
  name?: string,
): Promise<string> {
  const account = await signUp(page, testInfo, name ? { name } : {});
  return userIdByEmail(account.email);
}

test.describe("el grupo en la grilla (FEAT-006c)", () => {
  // Up to two sign-ups and a reload or two per test; the margin is for a slower CI runner.
  test.describe.configure({ timeout: 120_000 });

  test("test-e2e-group-grid-no-groups: sin grupos no hay selector ni iniciales", async ({
    page,
  }, testInfo) => {
    await signUpViewer(page, testInfo);
    await expect(gridRegion(page, "fri")).toBeVisible();
    await expect(showBlock(page, TYLER)).toBeVisible();

    // AC-20: neither the picker nor any friend's initials.
    await expect(groupPicker(page)).toHaveCount(0);
    await expect(page.getByText(GROUP_PICKER_LABEL, { exact: true })).toHaveCount(0);
    await expect(friendRows(page)).toHaveCount(0);
  });

  test('test-e2e-group-grid-initials: "Los del Lolla": Ana y Bruno eligieron Tyler, The Creator y su bloque muestra sus iniciales', async ({
    page,
  }, testInfo) => {
    const viewerId = await signUpViewer(page, testInfo, "Carla Ruiz");
    const base = Date.now() - 10 * MINUTE_MS;
    const lolla = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(base),
    });
    await insertFriends(lolla, [
      { name: "Ana Pérez", showIds: [TYLER] },
      { name: "Bruno Díaz", showIds: [TYLER] },
    ]);
    // A more recent group, so "Los del Lolla" is not on screen until it is chosen.
    const other = await insertGroup({
      name: OTHER_GROUP,
      members: [viewerId],
      joinedAt: new Date(base + MINUTE_MS),
    });
    await insertFriends(other, [{ name: "Diego Sosa", showIds: [] }]);

    await page.reload();
    await expect(groupPicker(page)).toBeVisible();
    expect(await chosenGroupName(page)).toBe(OTHER_GROUP);
    await expect(friendRow(page, TYLER)).toHaveCount(0);

    // AC-21: choosing "Los del Lolla" shows Ana's and Bruno's initials on Tyler's block.
    await groupPicker(page).selectOption({ label: GROUP_NAME });
    await expect(friendRow(page, TYLER)).toBeVisible();
    expect(await chipTexts(friendRow(page, TYLER))).toEqual(["AP", "BD"]);
    // The friends go in the block's accessible description, which names them.
    await expect(showBlock(page, TYLER)).toHaveAccessibleDescription(
      "Lo eligieron: Ana Pérez, Bruno Díaz",
    );
    // Nobody else picked anything: Tyler's is the only row.
    await expect(friendRows(page)).toHaveCount(1);
  });

  test('test-e2e-group-grid-extra: 5 amigos en el mismo show: 3 iniciales, "+2" y sin las del usuario', async ({
    page,
  }, testInfo) => {
    const viewerId = await signUpViewer(page, testInfo, "Zoe Zárate");
    const group = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(Date.now() - MINUTE_MS),
    });
    await insertFriends(group, [
      { name: "Ana Pérez", showIds: [TYLER] },
      { name: "Bruno Díaz", showIds: [TYLER] },
      { name: "Carla Ruiz", showIds: [TYLER] },
      { name: "Diego Sosa", showIds: [TYLER] },
      { name: "Eva Luna", showIds: [TYLER] },
    ]);
    // The viewer picked it too: their own initials still do not show.
    await showBlock(page, TYLER).click();
    await saveSelection(page);

    await page.reload();
    await expectChosen(page, TYLER, true);
    await expect(friendRow(page, TYLER)).toBeVisible();

    // AC-22: the first 3 friends to join, then "+2"; never the user's own "ZZ".
    const chips = await chipTexts(friendRow(page, TYLER));
    expect(chips).toEqual(["AP", "BD", "CR", "+2"]);
    expect(chips).not.toContain("ZZ");
  });

  test('test-e2e-group-grid-no-group: "Sin grupo" saca las iniciales', async ({
    page,
  }, testInfo) => {
    const viewerId = await signUpViewer(page, testInfo);
    const group = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(Date.now() - MINUTE_MS),
    });
    await insertFriends(group, [
      { name: "Ana Pérez", showIds: [TYLER, SAVED_SHOW] },
      { name: "Bruno Díaz", showIds: [UNSAVED_SHOW] },
    ]);

    await page.reload();
    await expect(friendRows(page)).toHaveCount(3);

    // AC-23: with "Sin grupo" no block shows a friend.
    await groupPicker(page).selectOption({ label: NO_GROUP_OPTION });
    await expect(friendRows(page)).toHaveCount(0);
    expect(await chosenGroupName(page)).toBe(NO_GROUP_OPTION);
    // The block keeps its accessible name and no description of friends.
    await expect(showBlock(page, TYLER)).toHaveAccessibleDescription("");
  });

  test("test-e2e-group-grid-remembers: el grupo elegido sigue al cerrar y volver a abrir", async ({
    page,
    context,
  }, testInfo) => {
    const viewerId = await signUpViewer(page, testInfo);
    const base = Date.now() - 10 * MINUTE_MS;
    const lolla = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(base),
    });
    await insertFriends(lolla, [{ name: "Ana Pérez", showIds: [TYLER] }]);
    const other = await insertGroup({
      name: OTHER_GROUP,
      members: [viewerId],
      joinedAt: new Date(base + MINUTE_MS),
    });
    await insertFriends(other, [{ name: "Diego Sosa", showIds: [SAVED_SHOW] }]);

    await page.reload();
    expect(await chosenGroupName(page)).toBe(OTHER_GROUP);
    await groupPicker(page).selectOption({ label: GROUP_NAME });
    await expect(friendRow(page, TYLER)).toBeVisible();

    // AC-24: the app closed and opened again (a new page of the same device) keeps the group, even
    // though it is not the most recent one.
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto("/");
    await expect(groupPicker(reopened)).toBeVisible();
    await expect.poll(() => chosenGroupName(reopened)).toBe(GROUP_NAME);
    await expect(friendRow(reopened, TYLER)).toBeVisible();
    await expect(friendRow(reopened, SAVED_SHOW)).toHaveCount(0);
  });

  test("test-e2e-group-grid-latest: la primera vez se muestra el grupo al que se unió último", async ({
    page,
  }, testInfo) => {
    const viewerId = await signUpViewer(page, testInfo);
    const base = Date.now() - 10 * MINUTE_MS;
    // The group joined last was created first: the order is the user's joining, not the group's age.
    const joinedLast = await insertGroup({
      name: OTHER_GROUP,
      members: [viewerId],
      joinedAt: new Date(base + 2 * MINUTE_MS),
      createdAt: new Date(base - 60 * MINUTE_MS),
    });
    await insertFriends(joinedLast, [{ name: "Diego Sosa", showIds: [SAVED_SHOW] }]);
    const joinedFirst = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(base),
    });
    await insertFriends(joinedFirst, [{ name: "Ana Pérez", showIds: [TYLER] }]);

    // AC-25: the first time the grid opens with both groups, the one joined last.
    await page.reload();
    await expect(groupPicker(page)).toBeVisible();
    await expect.poll(() => chosenGroupName(page)).toBe(OTHER_GROUP);
    await expect(friendRow(page, SAVED_SHOW)).toBeVisible();
    await expect(friendRow(page, TYLER)).toHaveCount(0);
  });

  test("test-e2e-group-grid-unsaved: lo que un amigo marcó sin guardar no aparece", async ({
    page,
    openDevice,
  }, testInfo) => {
    await signUp(page, testInfo, { name: "Carla Ruiz" });
    const groupId = await createGroup(page, GROUP_NAME);
    const link = await readInviteLink(page);

    // A real friend: signs up, joins with the link, saves one show and then changes it unsaved.
    const friend = await openDevice();
    await signUp(friend, testInfo, { name: "Bruno Díaz" });
    await join(friend, link, groupId);
    await friend.goto("/");
    await showBlock(friend, SAVED_SHOW).click();
    await saveSelection(friend);
    await showBlock(friend, SAVED_SHOW).click();
    await showBlock(friend, UNSAVED_SHOW).click();
    await expectChosen(friend, SAVED_SHOW, false);
    await expectChosen(friend, UNSAVED_SHOW, true);

    // AC-26: while the friend has those changes unsaved, the viewer sees what they saved last.
    await page.goto("/");
    await expect(groupPicker(page)).toBeVisible();
    await expect(friendRow(page, SAVED_SHOW)).toBeVisible();
    expect(await chipTexts(friendRow(page, SAVED_SHOW))).toEqual(["BD"]);
    await expect(friendRow(page, UNSAVED_SHOW)).toHaveCount(0);
    await expect(friendRows(page)).toHaveCount(1);
  });

  test("test-e2e-group-grid-offline: sin conexión se ven los indicadores de la última carga", async ({
    page,
    context,
  }, testInfo) => {
    const { account } = await signUpControlled(page, testInfo);
    const viewerId = await userIdByEmail(account.email);
    const group = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(Date.now() - MINUTE_MS),
    });
    await insertFriends(group, [
      { name: "Ana Pérez", showIds: [TYLER] },
      { name: "Bruno Díaz", showIds: [TYLER] },
    ]);

    // The last load with a connection: it writes the group into the device copy.
    await page.reload();
    await expect(friendRow(page, TYLER)).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const raw = localStorage.getItem("mi-grilla:snapshot");
            const copy = raw ? (JSON.parse(raw) as { groups?: { name: string }[] }) : null;
            return copy?.groups?.map((item) => item.name) ?? [];
          }),
        { message: "la copia del dispositivo no guardó el grupo" },
      )
      .toEqual([GROUP_NAME]);

    // AC-27: without a connection, `/` from the device copy shows the same initials.
    await goOffline(page, context);
    await reopenOffline(page);
    await expect(groupPicker(page)).toBeVisible();
    expect(await chosenGroupName(page)).toBe(GROUP_NAME);
    await expect(friendRow(page, TYLER)).toBeVisible();
    expect(await chipTexts(friendRow(page, TYLER))).toEqual(["AP", "BD"]);
  });

  test("test-e2e-group-grid-size: a 360 px las iniciales miden al menos 12 px y el selector al menos 44 × 44", async ({
    page,
  }, testInfo) => {
    // Measured at 360 px wide in every project (mobile-360 already is).
    await page.setViewportSize({ width: 360, height: 780 });
    const viewerId = await signUpViewer(page, testInfo);
    const group = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(Date.now() - MINUTE_MS),
    });
    await insertFriends(group, [
      { name: "Ana Pérez", showIds: [TYLER] },
      { name: "Bruno Díaz", showIds: [TYLER] },
      { name: "Carla Ruiz", showIds: [TYLER] },
      { name: "Diego Sosa", showIds: [TYLER] },
    ]);

    await page.reload();
    await expect(friendRow(page, TYLER)).toBeVisible();
    expect(page.viewportSize()?.width).toBe(360);

    // AC-32: every chip's text at 12 px or more.
    const sizes = await friendRow(page, TYLER)
      .locator(":scope > *")
      .evaluateAll((chips) =>
        chips.map((chip) => Number.parseFloat(getComputedStyle(chip).fontSize)),
      );
    expect(sizes).toHaveLength(4);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(12);

    // AC-32: the picker, a 44 × 44 tap target at least (CSS px are iOS points).
    const box = await groupPicker(page).boundingBox();
    expect(box, "el selector no tiene caja").not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("test-e2e-group-grid-fit: con un amigo que eligió todo, la fila de iniciales entra en cada bloque de los tres días", async ({
    page,
  }, testInfo) => {
    const viewerId = await signUpViewer(page, testInfo);
    const group = await insertGroup({
      name: GROUP_NAME,
      members: [viewerId],
      joinedAt: new Date(Date.now() - MINUTE_MS),
    });
    await insertFriends(group, [
      { name: "Ana Pérez", showIds: SCHEDULE.shows.map((show) => show.id) },
    ]);

    await page.reload();
    await expect(groupPicker(page)).toBeVisible();

    for (const day of DAYS) {
      await chooseDay(page, day.id);
      const region = gridRegion(page, day.id);
      const dayShows = SCHEDULE.shows.filter((show) => show.dayId === day.id);
      await expect(region.locator("[data-friend-picks]")).toHaveCount(dayShows.length);

      // Inside each block: the row of initials and the time line, which is never hidden.
      const misfits = await region.locator("[data-show-id]").evaluateAll((blocks) =>
        blocks.flatMap((block) => {
          const own = block.getBoundingClientRect();
          const row = block.querySelector("[data-friend-picks]")?.getBoundingClientRect();
          const time = block.querySelector("[data-time-line]")?.getBoundingClientRect();
          const name = block.firstElementChild?.getBoundingClientRect();
          // Where it does not fit, the heights say why: the block's and those of its parts.
          const detail = `alto ${own.height}; nombre ${name?.height}, horario ${time?.height}, fila ${row?.height}`;
          const id = block.getAttribute("data-show-id") ?? "?";
          const problems: string[] = [];
          // Half a pixel of slack for subpixel rounding.
          if (!row || row.height === 0 || row.bottom > own.bottom + 0.5) {
            problems.push(
              `${id}: la fila (${row?.bottom}) pasa el bloque (${own.bottom}); ${detail}`,
            );
          }
          if (!time || time.height === 0 || time.bottom > own.bottom + 0.5) {
            problems.push(
              `${id}: el horario (${time?.bottom}) pasa el bloque (${own.bottom}); ${detail}`,
            );
          }
          if (row && time && row.top < time.bottom - 0.5) {
            problems.push(
              `${id}: la fila (${row.top}) tapa el horario (${time.bottom}); ${detail}`,
            );
          }
          return problems;
        }),
      );
      expect(misfits, `${day.name}: bloques donde la fila no entra`).toEqual([]);
    }
  });
});
