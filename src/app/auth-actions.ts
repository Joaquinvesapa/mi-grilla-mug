"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { type AuthFormState, toFormState } from "@/lib/account-messages";
import { readFormFields } from "@/lib/account-rules";
import { getAccounts } from "@/server/accounts";

// Thin on purpose: read the fields, delegate to src/server/accounts.ts, redirect. Next rejects a
// Server Action posted from another origin (R-06). There is no destination parameter: a success
// always lands on `/` (R-16). `redirect` throws to navigate, so it never goes inside a try/catch.

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = readFormFields(formData, ["email", "password", "name"]);
  const result = await getAccounts().registerAccount(fields, await headers());
  if (!result.ok) {
    return toFormState(result, fields);
  }
  redirect("/");
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fields = readFormFields(formData, ["email", "password"]);
  const result = await getAccounts().signIn(fields, await headers());
  if (!result.ok) {
    return toFormState(result, fields);
  }
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  // A failure is already logged by the service as SERVICE_UNAVAILABLE; either way the person
  // leaves for /login, and `/` checks the session again on its own.
  await getAccounts().signOut(await headers());
  redirect("/login");
}
