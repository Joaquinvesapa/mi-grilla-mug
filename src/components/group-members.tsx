import type { GroupMember } from "@/server/groups";

/**
 * The members of a group, one per row: their initials in a 44 px circle, their visible name and,
 * for the one who manages it, "Administrador" in words (AC-13). The initials are decoration for a
 * screen reader: the name already says who it is.
 */
export function GroupMembers({ members }: { members: GroupMember[] }) {
  return (
    <ul aria-label="Integrantes" className="flex flex-col gap-3">
      {members.map((member, index) => (
        // Members have no id on screen and two can share a name; the list's order is stable
        // (`joined_at`, then `user_id`), so the position identifies the row.
        <li key={index} className="flex min-h-11 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold"
          >
            {member.initials}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{member.name}</span>
            {member.isAdmin ? (
              <span className="text-sm text-muted-foreground">Administrador</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
