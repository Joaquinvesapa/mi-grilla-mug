import { expect, type Page } from "@playwright/test";

import {
  groupMessageFor,
  INVITATION_LEAD,
  JOIN_GROUP_BUTTON,
  LINK_REGENERATED,
  memberCountLabel,
  NO_GROUPS,
} from "@/lib/group-messages";

import { signUp, submitLogin } from "./auth";
import { openMenu } from "./grid";
import {
  createGroup,
  expiryTexts,
  GROUP_NAME,
  inviteCard,
  memberRows,
  readInviteLink,
  test,
} from "./groups";

const ADMIN = "Lucía Gómez";
const MEMBER = "Martín Ruiz";
const OUTSIDER = "Sofía Paz";
const INVALID_INVITE = groupMessageFor("INVALID_INVITE");

/** `/login` or `/register` carrying the invitation in `next`, as the app encodes it. */
function withNext(path: "/login" | "/register", invitePath: string): string {
  return `${path}?${new URLSearchParams({ next: invitePath })}`;
}

/**
 * A card's accessible name in "Grupos": "Los del Lolla, 2 integrantes". Chromium puts a space
 * before the comma (the count is an `sr-only` span), so the space is optional.
 */
function cardName(groupName: string, members: number): RegExp {
  return new RegExp(`^${escapeRegExp(groupName)} ?, ${memberCountLabel(members)}$`);
}

/** `text` as a literal inside a `RegExp`: a group name may carry `.`, `(`, `?` or `$`. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The invitation's preview: "Te invitaron a sumarte a", the group's name and its member count. */
async function expectPreview(page: Page, members: number): Promise<void> {
  await expect(page.getByText(INVITATION_LEAD)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: GROUP_NAME })).toBeVisible();
  await expect(page.getByText(memberCountLabel(members), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: JOIN_GROUP_BUTTON })).toBeVisible();
}

/** Opens the link with a session, taps "Unirme" and waits for the group's screen (AC-07). */
async function join(page: Page, link: string, groupId: string): Promise<void> {
  await page.goto(link);
  await page.getByRole("button", { name: JOIN_GROUP_BUTTON }).click();
  await expect(page).toHaveURL(`/grupos/${groupId}`);
  await expect(page.getByRole("heading", { level: 1, name: GROUP_NAME })).toBeVisible();
}

// Several accounts per test, each on its own browser context: the ACs go together so the suite fits
// in the `e2e` job's 10 minutes. Up to four sign-ups per test: locally under 8 s in WebKit, the
// 120 s leave room for a slower CI runner without turning a slow run into a flaky one.
test.describe("grupos (FEAT-006a)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("groups e2e: crear un grupo y ver su link con vencimiento", async ({ page }, testInfo) => {
    await signUp(page, testInfo, { name: ADMIN });
    const sheet = await openMenu(page);
    await sheet.getByRole("link", { name: "Grupos" }).click();
    await expect(page).toHaveURL("/grupos");
    await expect(page.getByText(NO_GROUPS)).toBeVisible();

    const before = Date.now();
    await createGroup(page, GROUP_NAME);
    const after = Date.now();

    // AC-01: the creator is its only member, and its admin.
    await expect(memberRows(page)).toHaveCount(1);
    await expect(memberRows(page).first()).toContainText(ADMIN);
    await expect(memberRows(page).first()).toContainText("Administrador");

    // AC-04: the active link, on the server's own origin, when it expires and "Compartir link".
    const link = new URL(await readInviteLink(page));
    expect(link.origin).toBe(new URL(page.url()).origin);
    const expiry = inviteCard(page).getByText(/^Vence el /);
    await expect(expiry).toBeVisible();
    expect(expiryTexts(before, after)).toContain(await expiry.textContent());
    await expect(inviteCard(page).getByRole("button", { name: "Compartir link" })).toBeEnabled();
  });

  test("groups e2e: unirse con sesión y volver a la invitación sin sesión", async ({
    page,
    openDevice,
  }, testInfo) => {
    await signUp(page, testInfo, { name: ADMIN });
    const groupId = await createGroup(page, GROUP_NAME);
    const link = await readInviteLink(page);
    const invitePath = new URL(link).pathname;

    // AC-07: with a session, the link shows the group and "Unirme" leaves on its screen, as a member.
    const member = await openDevice();
    await signUp(member, testInfo, { name: MEMBER });
    await member.goto(link);
    await expectPreview(member, 1);
    await join(member, link, groupId);
    await expect(memberRows(member)).toHaveCount(2);
    await expect(memberRows(member).nth(1)).toContainText(MEMBER);

    // AC-08: without a session the link goes to sign in and, once in, back to the invitation. Both
    // ways in: creating the account and signing in to an existing one.
    const newcomer = await openDevice();
    await newcomer.goto(link);
    await expect(newcomer).toHaveURL(withNext("/login", invitePath));
    await newcomer.getByRole("link", { name: "¿Primera vez? Creá tu cuenta" }).click();
    await expect(newcomer).toHaveURL(withNext("/register", invitePath));
    const account = await signUp(newcomer, testInfo, {
      name: OUTSIDER,
      from: withNext("/register", invitePath),
      expectedPath: invitePath,
    });
    await expectPreview(newcomer, 2);

    await newcomer.context().clearCookies();
    await newcomer.goto(link);
    await expect(newcomer).toHaveURL(withNext("/login", invitePath));
    await submitLogin(newcomer, account.email, account.password);
    await expect(newcomer).toHaveURL(invitePath);
    await expectPreview(newcomer, 2);
  });

  test("groups e2e: el link reemplazado deja de funcionar y el no administrador no lo regenera", async ({
    page,
    openDevice,
  }, testInfo) => {
    await signUp(page, testInfo, { name: ADMIN });
    const groupId = await createGroup(page, GROUP_NAME);
    const oldLink = await readInviteLink(page);

    // AC-06: a member who is not the admin sees the link, but not "Generar link nuevo".
    const member = await openDevice();
    await signUp(member, testInfo, { name: MEMBER });
    await join(member, oldLink, groupId);
    await expect(inviteCard(member).getByRole("button", { name: "Compartir link" })).toBeVisible();
    await expect(member.getByRole("button", { name: "Generar link nuevo" })).toHaveCount(0);

    // AC-05: the admin generates a new link with one tap, nothing asks first (R-14, accepted risk).
    await page.getByRole("button", { name: "Generar link nuevo" }).click();
    await expect(page.getByText(LINK_REGENERATED)).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect.poll(() => readInviteLink(page)).not.toBe(oldLink);
    const newLink = await readInviteLink(page);

    // AC-05, AC-09 (replaced): the old link shows FR-08's message to someone outside the group,
    // with nothing of the group and nothing to join.
    const outsider = await openDevice();
    await signUp(outsider, testInfo, { name: OUTSIDER });
    await outsider.goto(oldLink);
    await expect(outsider.getByText(INVALID_INVITE)).toBeVisible();
    await expect(outsider.getByText(GROUP_NAME)).toHaveCount(0);
    await expect(outsider.getByRole("button", { name: JOIN_GROUP_BUTTON })).toHaveCount(0);

    // The new one works.
    await outsider.goto(newLink);
    await expectPreview(outsider, 2);
  });

  test("groups e2e: abrir el link propio no duplica y la lista muestra iniciales y administrador", async ({
    page,
    openDevice,
  }, testInfo) => {
    await signUp(page, testInfo, { name: ADMIN });
    const groupId = await createGroup(page, GROUP_NAME);
    const link = await readInviteLink(page);

    // AC-12: the admin opening its own link lands on the group, still its only member.
    await page.goto(link);
    await expect(page).toHaveURL(`/grupos/${groupId}`);
    await expect(memberRows(page)).toHaveCount(1);

    // And a member who already joined, the same: back on the group, not twice in it.
    const member = await openDevice();
    await signUp(member, testInfo, { name: MEMBER });
    await join(member, link, groupId);
    await member.goto(link);
    await expect(member).toHaveURL(`/grupos/${groupId}`);
    await expect(memberRows(member)).toHaveCount(2);

    // AC-13: "Grupos" lists every group of the user, each with its members' initials.
    await createGroup(page, "Primos");
    await page.goto("/");
    const sheet = await openMenu(page);
    await sheet.getByRole("link", { name: "Grupos" }).click();
    await expect(page).toHaveURL("/grupos");
    const list = page.getByRole("list", { name: "Tus grupos" });
    await expect(list.getByRole("link")).toHaveCount(2);
    const lolla = list.getByRole("link", { name: cardName(GROUP_NAME, 2) });
    await expect(lolla.getByTitle(ADMIN)).toHaveText("LG");
    await expect(lolla.getByTitle(MEMBER)).toHaveText("MR");
    const primos = list.getByRole("link", { name: cardName("Primos", 1) });
    await expect(primos.getByTitle(ADMIN)).toHaveText("LG");

    // In the group: each member with their visible name and initials, the admin marked as such.
    await lolla.click();
    await expect(page).toHaveURL(`/grupos/${groupId}`);
    const [adminRow, memberRow] = [memberRows(page).nth(0), memberRows(page).nth(1)];
    await expect(memberRows(page)).toHaveCount(2);
    await expect(adminRow).toContainText(ADMIN);
    await expect(adminRow).toContainText("LG");
    await expect(adminRow).toContainText("Administrador");
    await expect(memberRow).toContainText(MEMBER);
    await expect(memberRow).toContainText("MR");
    await expect(memberRow).not.toContainText("Administrador");
  });

  test("groups e2e: un no integrante no ve el grupo", async ({ page, openDevice }, testInfo) => {
    await signUp(page, testInfo, { name: ADMIN });
    const groupId = await createGroup(page, GROUP_NAME);

    // AC-29: someone signed in who is not a member gets a 404 with nothing of the group, not even
    // in the HTML or the RSC payload.
    const outsider = await openDevice();
    await signUp(outsider, testInfo, { name: OUTSIDER });
    const response = await outsider.goto(`/grupos/${groupId}`);
    expect(response?.status()).toBe(404);
    const html = (await response?.text()) ?? "";
    // Guard: the body is the app's page, so the absences below mean something.
    expect(html).toContain("<html");
    expect(html).not.toContain(GROUP_NAME);
    expect(html).not.toContain(ADMIN);
    await expect(outsider.getByText(GROUP_NAME)).toHaveCount(0);
    await expect(outsider.getByText(ADMIN)).toHaveCount(0);
    await expect(outsider.getByRole("list", { name: "Integrantes" })).toHaveCount(0);

    // Nor is it among their groups.
    await outsider.goto("/grupos");
    await expect(outsider.getByText(NO_GROUPS)).toBeVisible();
    await expect(outsider.getByText(GROUP_NAME)).toHaveCount(0);
  });
});
