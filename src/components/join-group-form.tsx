"use client";

import { useActionState } from "react";

import type { JoinGroupState } from "@/app/group-actions";
import { FormAlert } from "@/components/form-feedback";
import { Button } from "@/components/ui/button";
import { JOIN_GROUP_BUTTON } from "@/lib/group-messages";

export type JoinGroupAction = (prev: JoinGroupState, formData: FormData) => Promise<JoinGroupState>;

const INITIAL_STATE: JoinGroupState = { error: null };

/**
 * "Unirme" on an invitation (FR-06). The token travels hidden: the server validates it again and
 * takes the user from the session (R-01). A failure says which limit was hit — the group is full or
 * the person is already in 10 groups (FR-09); success leaves for the group's screen.
 */
export function JoinGroupForm({ action, token }: { action: JoinGroupAction; token: string }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <FormAlert message={state.error} />

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {JOIN_GROUP_BUTTON}
      </Button>
    </form>
  );
}
