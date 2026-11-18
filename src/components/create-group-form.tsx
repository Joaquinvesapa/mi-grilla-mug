"use client";

import { useActionState, useId } from "react";

import type { CreateGroupFormState } from "@/app/group-actions";
import { FormAlert } from "@/components/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConnectionGuard } from "@/components/use-connection-guard";
import { CREATE_GROUP_BUTTON, GROUP_NAME_LABEL } from "@/lib/group-messages";

export type CreateGroupAction = (
  prev: CreateGroupFormState,
  formData: FormData,
) => Promise<CreateGroupFormState>;

const INITIAL_STATE: CreateGroupFormState = { error: null, name: "" };

/**
 * "Crear grupo": the name and the button. The length is checked by the server, in code points, with
 * its own message (FR-01): no `maxLength`, which counts UTF-16 units and would cut an emoji in half.
 * After an error the name comes back as typed. Success leaves for the group's screen. Without a
 * connection nothing is sent and the guard says so (FR-04).
 */
export function CreateGroupForm({ action }: { action: CreateGroupAction }) {
  const { message, onSubmit, guard } = useConnectionGuard();
  const [state, formAction, pending] = useActionState(guard(action), INITIAL_STATE);
  const nameId = useId();

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>{GROUP_NAME_LABEL}</Label>
        <Input
          id={nameId}
          name="name"
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          required
          aria-invalid={state.error ? true : undefined}
          defaultValue={state.name}
        />
      </div>

      <FormAlert message={message ?? state.error} />

      <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
        {CREATE_GROUP_BUTTON}
      </Button>
    </form>
  );
}
