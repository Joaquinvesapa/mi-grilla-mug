"use server";

import { headers } from "next/headers";

import { USER_ID_MAX_LENGTH } from "@/lib/offline-selection";
import { AccountsUnavailableError, type CurrentUser, getAccounts } from "@/server/accounts";
import { saveSelection } from "@/server/selection";

// Thin on purpose: the user comes from the verified session, never from the client (R-01), and the
// payload is validated by src/server/selection.ts (R-02). Next rejects a Server Action posted from
// another origin (R-03).
//
// `expectedUserId` is an extra guard, never the identity: it is the owner of the selection the
// client is sending (a pending one saved without a connection, FEAT-003b). If the session belongs
// to someone else, nothing is saved, so one account's pending selection never lands in another's
// (R-01 of FEAT-003b). The result does not say whose session it is.

export type SaveSelectionActionResult =
  | { ok: true }
  | {
      ok: false;
      code: "INVALID_SELECTION" | "UNAUTHENTICATED" | "SERVICE_UNAVAILABLE" | "USER_MISMATCH";
    };

function isSameUser(expectedUserId: unknown, userId: string): boolean {
  return (
    typeof expectedUserId === "string" &&
    expectedUserId.length > 0 &&
    expectedUserId.length <= USER_ID_MAX_LENGTH &&
    expectedUserId === userId
  );
}

export async function saveSelectionAction(
  showIds: unknown,
  expectedUserId: unknown,
): Promise<SaveSelectionActionResult> {
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
  if (!user) {
    return { ok: false, code: "UNAUTHENTICATED" };
  }
  if (!isSameUser(expectedUserId, user.id)) {
    return { ok: false, code: "USER_MISMATCH" };
  }
  return saveSelection(user.id, showIds);
}
