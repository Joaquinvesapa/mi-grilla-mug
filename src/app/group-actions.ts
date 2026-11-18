"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { groupMessageFor } from "@/lib/group-messages";
import { AccountsUnavailableError, type CurrentUser, getAccounts } from "@/server/accounts";
import { createGroup, regenerateInvite } from "@/server/groups";

// Thin on purpose: the user comes from the verified session, never from the form (R-01), and the
// fields are validated by src/server/groups.ts. Next rejects a Server Action posted from another
// origin (R-07). Only the catalog's text reaches the screen, never an infrastructure message (R-08).
// `redirect` throws to navigate, so it never goes inside a try/catch.

/** What the create form shows: the message, and what the person typed so it is not lost. */
export type CreateGroupFormState = { error: string | null; name: string };

export type RegenerateInviteState = { ok: true } | { ok: false; error: string };

type SessionUser = { ok: true; user: CurrentUser } | { ok: false; error: string };

async function sessionUser(): Promise<SessionUser> {
  let user: CurrentUser | null;
  try {
    user = await getAccounts().getCurrentUser(await headers());
  } catch (error) {
    // Already logged by the accounts service as SERVICE_UNAVAILABLE.
    if (error instanceof AccountsUnavailableError) {
      return { ok: false, error: groupMessageFor("SERVICE_UNAVAILABLE") };
    }
    throw error;
  }
  return user ? { ok: true, user } : { ok: false, error: groupMessageFor("UNAUTHENTICATED") };
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
    return { error: session.error, name };
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
    return { ok: false, error: session.error };
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
