"use client";

import { useActionState, useState } from "react";

import type { GroupExitState } from "@/app/group-actions";
import { FormAlert } from "@/components/form-feedback";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useConnectionGuard } from "@/components/use-connection-guard";
import {
  CANCEL,
  DELETE_GROUP_BUTTON,
  DELETE_GROUP_CONFIRM,
  DELETE_GROUP_WARNING,
  deleteGroupTitle,
  LEAVE_GROUP_BUTTON,
  LEAVE_GROUP_CONFIRM,
  leaveGroupTitle,
} from "@/lib/group-messages";

/** Leave or delete: success redirects to `/grupos`, so only a rejection comes back. */
export type GroupExitAction = (
  prev: GroupExitState | null,
  formData: FormData,
) => Promise<GroupExitState>;

export type GroupDangerZoneProps = {
  groupId: string;
  groupName: string;
  /** Whether the session's user manages the group: only then "Borrar grupo" shows. */
  isAdmin: boolean;
  /** The Server Actions, from the page: POSTs with Next's origin check (R-07). */
  leaveAction: GroupExitAction;
  deleteAction: GroupExitAction;
};

type ConfirmExitProps = {
  groupId: string;
  trigger: string;
  triggerVariant: "outline" | "destructive";
  title: string;
  /** What the dialog explains under its title; without one, the dialog has no description. */
  warning: string | null;
  confirm: string;
  action: GroupExitAction;
};

/**
 * The dialog's answer and its confirm button. It lives inside the dialog and is mounted again on
 * every opening, so a rejection or the offline notice from an earlier try does not come back
 * after "Cancelar". The confirm button is a plain submit inside its form, not AlertDialogAction:
 * closing the dialog on click would unmount the form before the browser submits it (as in
 * app-menu.tsx). It stays disabled while the answer comes, and a rejection shows in the dialog.
 * Without a connection nothing is sent and the notice shows in the dialog too (FR-04).
 */
function ExitConfirm({
  groupId,
  confirm,
  action,
}: Pick<ConfirmExitProps, "groupId" | "confirm" | "action">) {
  const { message, onSubmit, guard } = useConnectionGuard();
  const [state, formAction, pending] = useActionState(
    guard<GroupExitState | null, FormData>(action),
    null,
  );

  return (
    <>
      <FormAlert message={message ?? state?.error ?? null} />
      <AlertDialogFooter>
        <AlertDialogCancel>{CANCEL}</AlertDialogCancel>
        <form action={formAction} onSubmit={onSubmit} className="contents">
          <input type="hidden" name="groupId" value={groupId} />
          <Button type="submit" variant="destructive" disabled={pending} aria-busy={pending}>
            {confirm}
          </Button>
        </form>
      </AlertDialogFooter>
    </>
  );
}

/**
 * A button that asks first: the dialog closes with "Cancelar" or a tap outside (gestures), and only
 * its confirm button sends. Each opening gets a fresh `ExitConfirm` through its `key`.
 */
function ConfirmExit({
  groupId,
  trigger,
  triggerVariant,
  title,
  warning,
  confirm,
  action,
}: ConfirmExitProps) {
  const [opening, setOpening] = useState(0);

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (open) {
          setOpening((count) => count + 1);
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size="lg" className="w-full">
          {trigger}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        size="sm"
        {...(warning === null ? { "aria-describedby": undefined } : {})}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">{title}</AlertDialogTitle>
          {warning === null ? null : <AlertDialogDescription>{warning}</AlertDialogDescription>}
        </AlertDialogHeader>
        <ExitConfirm key={opening} groupId={groupId} confirm={confirm} action={action} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The screen's last section, apart from "Generar link nuevo" (design-taste-frontend): "Salir del
 * grupo" for everyone (FR-02) and, for the admin, "Borrar grupo" (FR-01). Both ask first (AC-15).
 */
export function GroupDangerZone({
  groupId,
  groupName,
  isAdmin,
  leaveAction,
  deleteAction,
}: GroupDangerZoneProps) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <ConfirmExit
        groupId={groupId}
        trigger={LEAVE_GROUP_BUTTON}
        triggerVariant="outline"
        title={leaveGroupTitle(groupName)}
        warning={null}
        confirm={LEAVE_GROUP_CONFIRM}
        action={leaveAction}
      />
      {isAdmin ? (
        <ConfirmExit
          groupId={groupId}
          trigger={DELETE_GROUP_BUTTON}
          triggerVariant="destructive"
          title={deleteGroupTitle(groupName)}
          warning={DELETE_GROUP_WARNING}
          confirm={DELETE_GROUP_CONFIRM}
          action={deleteAction}
        />
      ) : null}
    </section>
  );
}
