"use client";

import { type ChangeEvent, useId } from "react";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { GROUP_PICKER_LABEL, NO_GROUP_OPTION } from "@/lib/group-messages";
import type { GroupPicks } from "@/lib/group-picks";

export type GroupPickerProps = {
  /** The user's groups, in the order `listGroupPicks` returns them (the most recent first). */
  groups: readonly Pick<GroupPicks, "id" | "name">[];
  /** The group on screen, or `null` for "Sin grupo". */
  value: string | null;
  onChange: (groupId: string | null) => void;
};

/** The option value of "Sin grupo": no group id is empty. */
const NO_GROUP_VALUE = "";

/**
 * Which group's initials the grid shows (FR-01, FR-03). Controlled: it reports the change and
 * keeps nothing. A native select, so iOS opens its own wheel; 16 px so it does not zoom into it and
 * 44 px tall as a tap target (mobile-native).
 */
export function GroupPicker({ groups, value, onChange }: GroupPickerProps) {
  const selectId = useId();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (next === NO_GROUP_VALUE) {
      onChange(null);
      return;
    }
    // Only the ids it was given: anything else is ignored and the group on screen stays.
    if (groups.some((group) => group.id === next)) {
      onChange(next);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={selectId} className="text-sm font-medium text-muted-foreground">
        {GROUP_PICKER_LABEL}
      </label>
      <NativeSelect
        id={selectId}
        value={value ?? NO_GROUP_VALUE}
        onChange={handleChange}
        className="h-11 text-base"
      >
        {groups.map((group) => (
          <NativeSelectOption key={group.id} value={group.id}>
            {group.name}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={NO_GROUP_VALUE}>{NO_GROUP_OPTION}</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}
