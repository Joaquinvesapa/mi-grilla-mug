"use client";

import { useActionState } from "react";

import type { GroupChangeState } from "@/app/group-actions";
import { FormAlert } from "@/components/form-feedback";
import { Button } from "@/components/ui/button";
import { REMOVE_MEMBER_BUTTON, removeMemberLabel } from "@/lib/group-messages";
import type { GroupDetailMember } from "@/server/groups";

export type RemoveMemberAction = (
  prev: GroupChangeState,
  formData: FormData,
) => Promise<GroupChangeState>;

export type GroupMembersProps = {
  groupId: string;
  members: GroupDetailMember[];
  /** Whether the session's user manages the group: only then each other row gets "Sacar". */
  isAdmin: boolean;
  /** The remove Server Action, from the page: a POST with Next's origin check (R-07). */
  removeAction: RemoveMemberAction;
};

/** What the last "Sacar" of a row answered; `null` until one is sent. */
type RemoveView = GroupChangeState | null;

/**
 * "Sacar" for one row: the group and the member go hidden, and it sends at once, without asking
 * (the PRD asks first only for deleting and leaving; whoever is taken out can come back with a
 * link). Its own `useActionState`, so a row's answer stays in that row. On success the page is
 * revalidated and the row goes away.
 */
function RemoveMemberForm({
  groupId,
  member,
  action,
}: {
  groupId: string;
  member: GroupDetailMember;
  action: RemoveMemberAction;
}) {
  const [state, formAction, pending] = useActionState<RemoveView, FormData>(
    async (_prev, formData) => action({ ok: true }, formData),
    null,
  );

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberUserId" value={member.userId} />
      <Button
        type="submit"
        variant="outline"
        className="ml-auto"
        aria-label={removeMemberLabel(member.name)}
        disabled={pending}
        aria-busy={pending}
      >
        {REMOVE_MEMBER_BUTTON}
      </Button>
      {/* Under the row, full width: the form is `contents`, so this wraps inside the row's flex. */}
      {state?.ok === false ? (
        <div className="basis-full">
          <FormAlert message={state.error} />
        </div>
      ) : null}
    </form>
  );
}

/**
 * The members of a group, one per row: their initials in a 44 px circle, their visible name and,
 * for the one who manages it, "Administrador" in words (AC-13). The initials are decoration for a
 * screen reader: the name already says who it is. The admin also gets "Sacar" on every row but
 * their own; a member who does not manage the group sees none (AC-16).
 */
export function GroupMembers({ groupId, members, isAdmin, removeAction }: GroupMembersProps) {
  return (
    <ul aria-label="Integrantes" className="flex flex-col gap-3">
      {members.map((member) => (
        <li key={member.userId} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold"
          >
            {member.initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{member.name}</span>
            {member.isAdmin ? (
              <span className="text-sm text-muted-foreground">Administrador</span>
            ) : null}
          </span>
          {isAdmin && !member.isSelf ? (
            <RemoveMemberForm groupId={groupId} member={member} action={removeAction} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
