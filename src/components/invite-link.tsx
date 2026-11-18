"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

import type { RegenerateInviteState } from "@/app/group-actions";
import { FormAlert } from "@/components/form-feedback";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ASK_THE_ADMIN,
  formatInviteExpiry,
  inviteShareText,
  LINK_COPIED,
  LINK_COPY_FAILED,
  LINK_EXPIRED,
  LINK_REGENERATED,
  NO_ACTIVE_LINK,
  REGENERATE_CONFIRM,
} from "@/lib/group-messages";

export type InviteLinkProps = {
  groupId: string;
  groupName: string;
  /** The active link; `null` when there is none or it cannot be opened (a rotated secret). */
  invite: { token: string; expiresAt: Date } | null;
  isAdmin: boolean;
  /** The request's time, from the page: whether the link still works is decided once, on the server. */
  now: Date;
  /** The regenerate Server Action: a POST with Next's origin check (R-07). */
  regenerateAction: (
    prev: RegenerateInviteState,
    formData: FormData,
  ) => Promise<RegenerateInviteState>;
};

type CopyNotice = "copied" | "copy-failed" | null;

/** What the last "Generar link nuevo" answered; `null` until one is sent. */
type RegenerateView = RegenerateInviteState | null;

function subscribeNever(): () => void {
  return () => {};
}

/**
 * The page's own origin, read in the browser (audit finding 8): the server never builds the URL from
 * the `Host` header. `null` while rendering on the server, so hydration never mismatches.
 */
function useOrigin(): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => null,
  );
}

function isAbort(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

/** Copies `url`; `false` if the Clipboard API is missing or refuses (no permission, no focus). */
async function copyToClipboard(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // The person still has the link on screen, selectable, with the reason why.
    return false;
  }
}

/**
 * The group's invite link (FR-04, FR-05): the URL, when it expires and "Compartir link", which opens
 * the system share sheet within the tap and, without one, copies the link. Until the browser knows
 * its origin (the server render) there is no URL and nothing to share, so a relative URL is never
 * shown or shared. The admin also gets "Generar link nuevo", which asks first because it cuts off
 * the link already shared (R-14); the dialog stays, with "Generar" disabled, until the answer comes.
 * An expired link, or none at all, is not offered for sharing: the admin generates a new one
 * (without asking, there is nothing to cut off) and everyone else is told who to ask.
 */
export function InviteLink({
  groupId,
  groupName,
  invite,
  isAdmin,
  now,
  regenerateAction,
}: InviteLinkProps) {
  const origin = useOrigin();
  const [notice, setNotice] = useState<CopyNotice>(null);
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<RegenerateView, FormData>(
    async (_prev, formData) => {
      const result = await regenerateAction({ ok: true }, formData);
      // Closed with the answer, not on the tap: while it is sent "Generar" cannot be sent twice.
      setConfirming(false);
      return result;
    },
    null,
  );

  const active = invite !== null && now.getTime() < invite.expiresAt.getTime() ? invite : null;
  const url = active && origin !== null ? `${origin}/invitacion/${active.token}` : null;

  async function share(link: string) {
    setNotice(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ ...inviteShareText(groupName), url: link });
        return;
      } catch (error) {
        // AbortError: the person closed the sheet, nothing to say. Any other failure copies instead.
        if (isAbort(error)) {
          return;
        }
      }
    }
    setNotice((await copyToClipboard(link)) ? "copied" : "copy-failed");
  }

  return (
    <section aria-labelledby={`${groupId}-invite`} className="app-card">
      <h2 id={`${groupId}-invite`} className="text-xl font-semibold">
        Link de invitación
      </h2>

      {active ? (
        <>
          {url === null ? null : (
            // Plain text, not a link or a button, so a long press selects it (mobile-native).
            <p className="rounded-md bg-input/30 px-3 py-2 font-mono text-sm break-all select-all">
              {url}
            </p>
          )}
          <p className="text-sm text-muted-foreground">{formatInviteExpiry(active.expiresAt)}</p>
          <Button
            type="button"
            size="lg"
            disabled={url === null}
            onClick={() => {
              if (url !== null) {
                void share(url);
              }
            }}
          >
            Compartir link
          </Button>
          {notice === "copied" ? (
            <p role="status" className="text-sm text-muted-foreground">
              {LINK_COPIED}
            </p>
          ) : null}
          <FormAlert message={notice === "copy-failed" ? LINK_COPY_FAILED : null} />
        </>
      ) : (
        <>
          <p>{invite === null ? NO_ACTIVE_LINK : LINK_EXPIRED}</p>
          {isAdmin ? null : <p className="text-sm text-muted-foreground">{ASK_THE_ADMIN}</p>}
        </>
      )}

      {isAdmin && active ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          aria-busy={pending}
          onClick={() => setConfirming(true)}
        >
          Generar link nuevo
        </Button>
      ) : null}
      {isAdmin && !active ? (
        <form action={formAction}>
          <input type="hidden" name="groupId" value={groupId} />
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={pending}
            aria-busy={pending}
          >
            Generar link nuevo
          </Button>
        </form>
      ) : null}

      {state?.ok === true ? (
        <p role="status" className="text-sm text-muted-foreground">
          {LINK_REGENERATED}
        </p>
      ) : null}
      <FormAlert message={state?.ok === false ? state.error : null} />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Generar link nuevo</AlertDialogTitle>
            <AlertDialogDescription>{REGENERATE_CONFIRM}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            {/* A plain submit, not AlertDialogAction: closing the dialog on click would unmount
                the form before the browser submits it. */}
            <form action={formAction} className="contents">
              <input type="hidden" name="groupId" value={groupId} />
              <Button type="submit" disabled={pending} aria-busy={pending}>
                Generar
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
