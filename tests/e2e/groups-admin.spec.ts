import { expect, type Locator, type Page } from "@playwright/test";

import {
  DELETE_GROUP_BUTTON,
  DELETE_GROUP_CONFIRM,
  DELETE_GROUP_WARNING,
  deleteGroupTitle,
  groupMessageFor,
  LEAVE_GROUP_BUTTON,
  LEAVE_GROUP_CONFIRM,
  leaveGroupTitle,
  NAME_SAVED,
  NO_GROUPS,
  OFFLINE_ACTION,
  REMOVE_MEMBER_BUTTON,
  removeMemberLabel,
  RENAME_GROUP_LABEL,
  SAVE_NAME_BUTTON,
  CANCEL,
} from "@/lib/group-messages";

import { signUp } from "./auth";
import { createGroup, GROUP_NAME, joinGroup, memberRows, readInviteLink, test } from "./groups";
import { goOffline } from "./offline";

const ADMIN = "Lucía Gómez";
const MEMBER = "Martín Ruiz";
const THIRD = "Sofía Paz";
const OUTSIDER = "Tomás Díaz";
const NEW_NAME = "Los del Lolla 2026";
const INVALID_INVITE = groupMessageFor("INVALID_INVITE");

/** The group's title on its screen. */
function groupHeading(page: Page, name = GROUP_NAME): Locator {
  return page.getByRole("heading", { level: 1, name });
}

/** Opens `/grupos/<id>` and checks it answers 404 with nothing of the group (AC-19, NFR-01). */
async function expectNotFound(page: Page, groupId: string, name = GROUP_NAME): Promise<void> {
  const response = await page.goto(`/grupos/${groupId}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText(name)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Integrantes" })).toHaveCount(0);
}

/** "Grupos" without any group: the group is not among theirs. */
async function expectNoGroups(page: Page, name = GROUP_NAME): Promise<void> {
  await page.goto("/grupos");
  await expect(page.getByText(NO_GROUPS)).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
}

/** Taps `trigger`, waits for its confirmation dialog and returns it. */
async function openConfirm(page: Page, trigger: string, title: string): Promise<Locator> {
  await page.getByRole("button", { name: trigger }).click();
  const dialog = page.getByRole("alertdialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** "Salir del grupo", confirmed: the page lands on "Grupos" (replacing the group's screen). */
async function leave(page: Page, name = GROUP_NAME): Promise<void> {
  const dialog = await openConfirm(page, LEAVE_GROUP_BUTTON, leaveGroupTitle(name));
  await dialog.getByRole("button", { name: LEAVE_GROUP_CONFIRM, exact: true }).click();
  await expect(page).toHaveURL("/grupos");
}

/** The admin's controls: renaming, "Sacar" on the other rows and "Borrar grupo" (AC-16). */
async function expectAdminControls(page: Page, visible: boolean): Promise<void> {
  const controls = [
    page.getByLabel(RENAME_GROUP_LABEL),
    page.getByRole("button", { name: SAVE_NAME_BUTTON }),
    // Every "Sacar a <nombre>" button: the name match is a substring.
    page.getByRole("button", { name: REMOVE_MEMBER_BUTTON }),
    page.getByRole("button", { name: DELETE_GROUP_BUTTON }),
  ];
  for (const control of controls) {
    if (visible) {
      await expect(control.first()).toBeVisible();
    } else {
      await expect(control).toHaveCount(0);
    }
  }
}

/**
 * The admin creates the group and `others` join it with its link, each on their own device, in
 * order (so the first of them is the oldest member). Returns the group's id, the link and the pages.
 */
async function groupWith(
  admin: Page,
  openDevice: () => Promise<Page>,
  testInfo: Parameters<typeof signUp>[1],
  others: string[],
): Promise<{ groupId: string; link: string; pages: Page[] }> {
  await signUp(admin, testInfo, { name: ADMIN });
  const groupId = await createGroup(admin, GROUP_NAME);
  const link = await readInviteLink(admin);
  const pages: Page[] = [];
  for (const name of others) {
    const page = await openDevice();
    await signUp(page, testInfo, { name });
    await joinGroup(page, link, groupId, GROUP_NAME);
    pages.push(page);
  }
  return { groupId, link, pages };
}

// One browser context per person, as in groups.spec.ts. Up to four sign-ups per test: the 120 s
// leave room for a slower CI runner.
test.describe("administrar y salir de un grupo (FEAT-006b)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("test-e2e-remove-member: el admin saca a un integrante y el sacado ya no ve el grupo (AC-14, AC-19)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { groupId, pages } = await groupWith(page, openDevice, testInfo, [MEMBER]);
    const member = pages[0]!;

    await page.reload();
    await expect(memberRows(page)).toHaveCount(2);
    await page.getByRole("button", { name: removeMemberLabel(MEMBER) }).click();

    // AC-14: the row goes away, with no dialog in between.
    await expect(memberRows(page)).toHaveCount(1);
    await expect(memberRows(page).first()).toContainText(ADMIN);
    await expect(page.getByRole("list", { name: "Integrantes" })).not.toContainText(MEMBER);
    await page.reload();
    await expect(memberRows(page)).toHaveCount(1);

    // AC-19: whoever was taken out gets a 404 and does not find it among their groups.
    await expectNotFound(member, groupId);
    await expectNoGroups(member);
  });

  test("test-e2e-member-no-controls: un integrante común no ve los controles del admin (AC-16)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { pages } = await groupWith(page, openDevice, testInfo, [MEMBER]);
    const member = pages[0]!;

    // Guard: the admin does see them, so the absences below mean something.
    await page.reload();
    await expectAdminControls(page, true);

    await expect(memberRows(member)).toHaveCount(2);
    await expectAdminControls(member, false);
    await expect(member.getByRole("button", { name: LEAVE_GROUP_BUTTON })).toBeVisible();
  });

  test("test-e2e-admin-leaves: sale el admin y el más antiguo pasa a administrar (AC-17)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { pages } = await groupWith(page, openDevice, testInfo, [MEMBER, THIRD]);
    const [oldest, newest] = [pages[0]!, pages[1]!];

    await leave(page);
    await expectNoGroups(page);

    // The oldest of the rest is now the admin, with every control.
    await oldest.reload();
    await expect(memberRows(oldest)).toHaveCount(2);
    await expect(memberRows(oldest).nth(0)).toContainText(MEMBER);
    await expect(memberRows(oldest).nth(0)).toContainText("Administrador");
    await expect(memberRows(oldest).nth(1)).toContainText(THIRD);
    await expect(memberRows(oldest).nth(1)).not.toContainText("Administrador");
    await expect(oldest.getByRole("list", { name: "Integrantes" })).not.toContainText(ADMIN);
    await expectAdminControls(oldest, true);
    await expect(oldest.getByRole("button", { name: removeMemberLabel(THIRD) })).toBeVisible();

    // The newest is still a common member.
    await newest.reload();
    await expect(memberRows(newest)).toHaveCount(2);
    await expectAdminControls(newest, false);
  });

  test("test-e2e-last-leaves: sale el último integrante, el grupo deja de existir y su link no sirve (AC-18)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { groupId, link } = await groupWith(page, openDevice, testInfo, []);

    await leave(page);
    await expectNoGroups(page);
    await expectNotFound(page, groupId);

    // The old link says it is no longer valid, with nothing of the group.
    const outsider = await openDevice();
    await signUp(outsider, testInfo, { name: OUTSIDER });
    await outsider.goto(link);
    await expect(outsider.getByText(INVALID_INVITE)).toBeVisible();
    await expect(outsider.getByText(GROUP_NAME)).toHaveCount(0);
  });

  test("test-e2e-delete-group: el admin borra el grupo confirmando y el otro integrante recibe 404 (AC-15)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { groupId, pages } = await groupWith(page, openDevice, testInfo, [MEMBER]);
    const member = pages[0]!;

    // "Cancelar" closes the dialog and nothing changes.
    let dialog = await openConfirm(page, DELETE_GROUP_BUTTON, deleteGroupTitle(GROUP_NAME));
    await expect(dialog.getByText(DELETE_GROUP_WARNING)).toBeVisible();
    await dialog.getByRole("button", { name: CANCEL }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(groupHeading(page)).toBeVisible();
    await expect(memberRows(page)).toHaveCount(2);

    // Confirmed, it is deleted for everyone.
    dialog = await openConfirm(page, DELETE_GROUP_BUTTON, deleteGroupTitle(GROUP_NAME));
    await dialog.getByRole("button", { name: DELETE_GROUP_CONFIRM, exact: true }).click();
    await expect(page).toHaveURL("/grupos");
    await expectNoGroups(page);
    await expectNotFound(member, groupId);
    await expectNoGroups(member);
  });

  test("test-e2e-back-after-leave: después de salir, Atrás no muestra el grupo (NFR-01)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { groupId, pages } = await groupWith(page, openDevice, testInfo, [MEMBER]);
    const member = pages[0]!;

    // Into the group from "Grupos", as the app does: a client navigation the router caches.
    await member.goto("/grupos");
    await member.getByRole("list", { name: "Tus grupos" }).getByRole("link").click();
    await expect(member).toHaveURL(`/grupos/${groupId}`);
    await expect(groupHeading(member)).toBeVisible();

    await leave(member);
    await expect(member.getByText(NO_GROUPS)).toBeVisible();

    await member.goBack();
    await expect(member).not.toHaveURL(`/grupos/${groupId}`);
    await expect(member.getByText(NO_GROUPS)).toBeVisible();
    await expect(groupHeading(member)).toHaveCount(0);
    await expect(member.getByRole("list", { name: "Integrantes" })).toHaveCount(0);
  });

  test("test-e2e-rename: el admin renombra y el otro integrante ve el nombre nuevo (FR-01)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { groupId, pages } = await groupWith(page, openDevice, testInfo, [MEMBER]);
    const member = pages[0]!;

    await page.reload();
    await page.getByLabel(RENAME_GROUP_LABEL).fill(NEW_NAME);
    await page.getByRole("button", { name: SAVE_NAME_BUTTON }).click();
    await expect(page.getByRole("status").filter({ hasText: NAME_SAVED })).toBeVisible();
    await expect(groupHeading(page, NEW_NAME)).toBeVisible();
    await expect(page.getByLabel(RENAME_GROUP_LABEL)).toHaveValue(NEW_NAME);

    await member.goto(`/grupos/${groupId}`);
    await expect(groupHeading(member, NEW_NAME)).toBeVisible();
    await member.goto("/grupos");
    await expect(member.getByRole("list", { name: "Tus grupos" })).toContainText(NEW_NAME);
  });

  test("test-e2e-offline-ac28: sin conexión, Salir del grupo avisa y el integrante sigue en el grupo (AC-28)", async ({
    page,
    openDevice,
  }, testInfo) => {
    const { groupId, pages } = await groupWith(page, openDevice, testInfo, [MEMBER]);
    const member = pages[0]!;

    await goOffline(member, member.context());
    const dialog = await openConfirm(member, LEAVE_GROUP_BUTTON, leaveGroupTitle(GROUP_NAME));
    await dialog.getByRole("button", { name: LEAVE_GROUP_CONFIRM, exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(OFFLINE_ACTION);
    await expect(member).toHaveURL(`/grupos/${groupId}`);

    // Back online, the change was never made: still a member, on both screens.
    await member.context().setOffline(false);
    await member.reload();
    await expect(groupHeading(member)).toBeVisible();
    await expect(memberRows(member)).toHaveCount(2);
    await expect(memberRows(member).nth(1)).toContainText(MEMBER);
    await page.reload();
    await expect(memberRows(page)).toHaveCount(2);
  });
});
