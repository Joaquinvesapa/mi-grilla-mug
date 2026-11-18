"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { type AuthFormState, toFormState } from "@/lib/account-messages";
import { readFormFields } from "@/lib/account-rules";
import { safeReturnPath } from "@/lib/return-path";
import { getAccounts } from "@/server/accounts";

// Thin on purpose: read the fields, delegate to src/server/accounts.ts, redirect. Next rejects a
// Server Action posted from another origin (R-06). The only destination besides `/` is the form's
// `next` when it is exactly `/invitacion/<token>` (`safeReturnPath`); any other value is ignored
// and a success lands on `/`. This narrows R-16 of FEAT-002 ("no destination parameter") to that
// single allow-listed destination (R-10 of FEAT-006a, ADR-006). `redirect` throws to navigate, so
// it never goes inside a try/catch.

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = readFormFields(formData, ["email", "password", "name"]);
  const next = safeReturnPath(formData.get("next"));
  const result = await getAccounts().registerAccount(fields, await headers());
  if (!result.ok) {
    return toFormState(result, fields);
  }
  redirect(next ?? "/");
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = readFormFields(formData, ["email", "password"]);
  const next = safeReturnPath(formData.get("next"));
  const result = await getAccounts().signIn(fields, await headers());
  if (!result.ok) {
    return toFormState(result, fields);
  }
  redirect(next ?? "/");
}

export async function logoutAction(): Promise<void> {
  // A failure is already logged by the service as SERVICE_UNAVAILABLE; either way the person
  // leaves for /login, and `/` checks the session again on its own.
  await getAccounts().signOut(await headers());
  redirect("/login");
}
