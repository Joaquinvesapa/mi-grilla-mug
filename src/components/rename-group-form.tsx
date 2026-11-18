"use client";

import { useActionState, useId } from "react";

import type { GroupChangeState } from "@/app/group-actions";
import { FormAlert } from "@/components/form-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConnectionGuard } from "@/components/use-connection-guard";
import { NAME_SAVED, RENAME_GROUP_LABEL, SAVE_NAME_BUTTON } from "@/lib/group-messages";

export type RenameGroupAction = (
  prev: GroupChangeState,
  formData: FormData,
) => Promise<GroupChangeState>;

export type RenameGroupFormProps = {
  groupId: string;
  /** The group's current name: what the field starts with. */
  name: string;
  /** The rename Server Action, from the page: a POST with Next's origin check (R-07). */
  action: RenameGroupAction;
};

/**
 * What the last "Guardar nombre" answered, and the name it sent, so a rejection does not lose it.
 */
type RenameView = { result: GroupChangeState | null; name: string };

/**
 * "Cambiar nombre", only for the admin (FR-01): the field with the current name and "Guardar
 * nombre". The length is checked by the server, in code points, with its own message: no
 * `maxLength`, which counts UTF-16 units. React resets the form after the action, so the field
 * comes back from the view's `name`: what was typed, whether it was saved or rejected. Without a
 * connection nothing is sent and the guard says so (FR-04).
 */
export function RenameGroupForm({ groupId, name, action }: RenameGroupFormProps) {
  const nameId = useId();
  const { message, onSubmit, guard } = useConnectionGuard();
  const [view, formAction, pending] = useActionState<RenameView, FormData>(
    guard(async (_prev, formData) => {
      const sent = formData.get("name");
      const result = await action({ ok: true }, formData);
      return { result, name: typeof sent === "string" ? sent : "" };
    }),
    { result: null, name },
  );
  const error = message ?? (view.result?.ok === false ? view.result.error : null);

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>{RENAME_GROUP_LABEL}</Label>
        <Input
          id={nameId}
          name="name"
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          required
          aria-invalid={error ? true : undefined}
          defaultValue={view.name}
        />
      </div>

      <FormAlert message={error} />
      {view.result?.ok === true && message === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {NAME_SAVED}
        </p>
      ) : null}

      <Button type="submit" variant="outline" size="lg" disabled={pending} aria-busy={pending}>
        {SAVE_NAME_BUTTON}
      </Button>
    </form>
  );
}
