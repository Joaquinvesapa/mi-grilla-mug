"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";

import { groupMessageFor, joinGroupMessageFor } from "@/lib/group-messages";
import { AccountsUnavailableError, type CurrentUser, getAccounts } from "@/server/accounts";
import {
  createGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  regenerateInvite,
  removeMember,
  renameGroup,
} from "@/server/groups";

// Thin on purpose: the user comes from the verified session, never from the form (R-01), and the
// fields are validated by src/server/groups.ts. Next rejects a Server Action posted from another
// origin (R-07). Only the catalog's text reaches the screen, never an infrastructure message
// (R-08).
// `redirect` throws to navigate, so it never goes inside a try/catch.

/** What the create form shows: the message, and what the person typed so it is not lost. */
export type CreateGroupFormState = { error: string | null; name: string };

export type RegenerateInviteState = { ok: true } | { ok: false; error: string };

/** What renaming the group or taking a member out answers (FR-01). */
export type GroupChangeState = { ok: true } | { ok: false; error: string };

/** What leaving or deleting answers when it did not happen; success leaves for `/grupos`. */
export type GroupExitState = { ok: false; error: string };

/** What "Unirme" shows when the join did not happen; success leaves for the group's screen. */
export type JoinGroupState = { error: string | null };

type SessionUser =
  | { ok: true; user: CurrentUser }
  | { ok: false; code: "UNAUTHENTICATED" | "SERVICE_UNAVAILABLE" };

async function sessionUser(): Promise<SessionUser> {
  let user: CurrentUser | null;
  try {
    user = await getAccounts().getCurrentUser(await headers());
  } catch (error) {
    // Already logged by the accounts service as SERVICE_UNAVAILABLE.
    if (error instanceof AccountsUnavailableError) {
      return { ok: false, code: "SERVICE_UNAVAILABLE" };
    }
    throw error;
  }
  return user ? { ok: true, user } : { ok: false, code: "UNAUTHENTICATED" };
}

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Creates the group with the session's user as its admin and opens its screen (FR-01). */
export async function createGroupAction(
  _prev: CreateGroupFormState,
  formData: FormData,
): Promise<CreateGroupFormState> {
  const name = textField(formData, "name");
  const session = await sessionUser();
  if (!session.ok) {
    return { error: groupMessageFor(session.code), name };
  }
  const result = await createGroup(session.user.id, name);
  if (!result.ok) {
    return { error: groupMessageFor(result.code), name };
  }
  redirect(`/grupos/${result.groupId}`);
}

/** Replaces the group's link; the service rejects anyone but its admin (FR-05, AC-06). */
export async function regenerateInviteAction(
  _prev: RegenerateInviteState,
  formData: FormData,
): Promise<RegenerateInviteState> {
  const session = await sessionUser();
  if (!session.ok) {
    return { ok: false, error: groupMessageFor(session.code) };
  }
  const groupId = textField(formData, "groupId");
  const result = await regenerateInvite(session.user.id, groupId);
  if (!result.ok) {
    return { ok: false, error: groupMessageFor(result.code) };
  }
  // The service accepted it, so `groupId` is the UUID of a group of this user.
  revalidatePath(`/grupos/${groupId}`);
  return { ok: true };
}

/**
 * "Unirme" (FR-06, FR-09, FR-10): joins with the hidden `token` and opens the group's screen, also
 * for someone who already was a member. A full group or a user already in 10 groups says which
 * limit it hit. A POST without a cookie is sent to /login by the proxy first; this still rejects a
 * session that is not valid.
 */
export async function joinGroupAction(
  _prev: JoinGroupState,
  formData: FormData,
): Promise<JoinGroupState> {
  const session = await sessionUser();
  if (!session.ok) {
    return { error: joinGroupMessageFor(session.code) };
  }
  const result = await joinGroup(session.user.id, textField(formData, "token"));
  if (!result.ok) {
    return { error: joinGroupMessageFor(result.code) };
  }
  redirect(`/grupos/${result.groupId}`);
}

/** Revalidates the group's screen and the list, where its name and members show. */
function revalidateGroup(groupId: string): void {
  revalidatePath(`/grupos/${groupId}`);
  revalidatePath("/grupos");
}

/** "Guardar nombre": the service rejects anyone but the admin and an invalid name (FR-01). */
export async function renameGroupAction(
  _prev: GroupChangeState,
  formData: FormData,
): Promise<GroupChangeState> {
  const session = await sessionUser();
  if (!session.ok) {
    return { ok: false, error: groupMessageFor(session.code) };
  }
  const groupId = textField(formData, "groupId");
  const result = await renameGroup(session.user.id, groupId, textField(formData, "name"));
  if (!result.ok) {
    return { ok: false, error: groupMessageFor(result.code) };
  }
  revalidateGroup(groupId);
  return { ok: true };
}

/** "Sacar": the admin takes `memberUserId` out of the group, without asking (FR-01, AC-14). */
export async function removeMemberAction(
  _prev: GroupChangeState,
  formData: FormData,
): Promise<GroupChangeState> {
  const session = await sessionUser();
  if (!session.ok) {
    return { ok: false, error: groupMessageFor(session.code) };
  }
  const groupId = textField(formData, "groupId");
  const result = await removeMember(session.user.id, groupId, textField(formData, "memberUserId"));
  if (!result.ok) {
    return { ok: false, error: groupMessageFor(result.code) };
  }
  revalidateGroup(groupId);
  return { ok: true };
}

/**
 * "Borrar" (FR-01, AC-15): the admin deletes the group for everyone and goes back to the list. A
 * group that is already gone, or no longer this person's, goes back to the list as well (W6).
 * `replace`, so "Atrás" does not return to the group's screen from Next's router cache (R-11).
 */
export async function deleteGroupAction(
  _prev: GroupExitState | null,
  formData: FormData,
): Promise<GroupExitState> {
  const session = await sessionUser();
  if (!session.ok) {
    return { ok: false, error: groupMessageFor(session.code) };
  }
  const result = await deleteGroup(session.user.id, textField(formData, "groupId"));
  if (!result.ok && result.code !== "NOT_FOUND") {
    return { ok: false, error: groupMessageFor(result.code) };
  }
  revalidatePath("/grupos");
  redirect("/grupos", RedirectType.replace);
}

/**
 * "Salir" (FR-02, AC-19): the person leaves and goes back to the list, also when they were already
 * out or the group no longer exists. `replace`, as with deleting (R-11).
 */
export async function leaveGroupAction(
  _prev: GroupExitState | null,
  formData: FormData,
): Promise<GroupExitState> {
  const session = await sessionUser();
  if (!session.ok) {
    return { ok: false, error: groupMessageFor(session.code) };
  }
  const result = await leaveGroup(session.user.id, textField(formData, "groupId"));
  if (!result.ok && result.code !== "NOT_FOUND") {
    return { ok: false, error: groupMessageFor(result.code) };
  }
  revalidatePath("/grupos");
  redirect("/grupos", RedirectType.replace);
}
