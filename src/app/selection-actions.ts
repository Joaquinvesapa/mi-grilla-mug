"use server";

import { headers } from "next/headers";

import { AccountsUnavailableError, type CurrentUser, getAccounts } from "@/server/accounts";
import { saveSelection } from "@/server/selection";

// Thin on purpose: the user comes from the verified session, never from the client (R-01), and the
// payload is validated by src/server/selection.ts (R-02). Next rejects a Server Action posted from
// another origin (R-03).

export type SaveSelectionActionResult =
  | { ok: true }
  | { ok: false; code: "INVALID_SELECTION" | "UNAUTHENTICATED" | "SERVICE_UNAVAILABLE" };

export async function saveSelectionAction(showIds: unknown): Promise<SaveSelectionActionResult> {
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
  return saveSelection(user.id, showIds);
}
