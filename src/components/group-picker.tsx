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
  /**
   * Whether "Sin grupo" is one of the options (the default). Without it, an empty value is
   * ignored like any unknown one, so `onChange(null)` is never called (FEAT-007, the wallpaper).
   */
  withNoGroup?: boolean;
  /** The select's label; `GROUP_PICKER_LABEL` ("Grupo") by default. */
  label?: string;
  /**
   * Refuses changes for now (FEAT-007, while the wallpaper is drawn). `aria-disabled` rather than
   * `disabled`: a focused control that becomes disabled loses the focus.
   */
  disabled?: boolean;
};

/** The option value of "Sin grupo": no group id is empty. */
const NO_GROUP_VALUE = "";

/**
 * Which group's initials the grid shows (FR-01, FR-03), or which group the wallpaper is drawn with
 * (FEAT-007). Controlled: it reports the change and keeps nothing. A native select, so iOS opens its
 * own wheel; 16 px so it does not zoom into it and 44 px tall as a tap target (mobile-native).
 */
export function GroupPicker({
  groups,
  value,
  onChange,
  withNoGroup = true,
  label = GROUP_PICKER_LABEL,
  disabled = false,
}: GroupPickerProps) {
  const selectId = useId();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    if (disabled) {
      return;
    }
    const next = event.target.value;
    if (next === NO_GROUP_VALUE) {
      if (withNoGroup) {
        onChange(null);
      }
      return;
    }
    // Only the ids it was given: anything else is ignored and the group on screen stays.
    if (groups.some((group) => group.id === next)) {
      onChange(next);
    }
  }

  return (
    // The select's wrapper is `w-fit`: in a narrow container (the sheet at 360 px) it may shrink
    // and the select truncates a long group name, instead of the row overflowing its container.
    <div className="flex max-w-full min-w-0 items-center gap-3 [&>[data-slot=native-select-wrapper]]:max-w-full [&>[data-slot=native-select-wrapper]]:min-w-0">
      <label htmlFor={selectId} className="shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {/* No pointer events while it refuses, so iOS does not open its wheel; the focus stays. */}
      <NativeSelect
        id={selectId}
        value={value ?? NO_GROUP_VALUE}
        onChange={handleChange}
        aria-disabled={disabled || undefined}
        className="h-11 truncate text-base aria-disabled:pointer-events-none aria-disabled:opacity-50"
      >
        {groups.map((group) => (
          <NativeSelectOption key={group.id} value={group.id}>
            {group.name}
          </NativeSelectOption>
        ))}
        {withNoGroup ? (
          <NativeSelectOption value={NO_GROUP_VALUE}>{NO_GROUP_OPTION}</NativeSelectOption>
        ) : null}
      </NativeSelect>
    </div>
  );
}
