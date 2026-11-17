// Clashes between chosen shows (FR-14). Pure: no I/O.
import type { Show } from "@/lib/schedule-types";

type Timed = Pick<Show, "id" | "dayId" | "startsAt" | "endsAt">;

/**
 * The selected ids that share at least one minute with another selected show of the same day.
 * Touching at the edge (one ends 18:00, the next starts 18:00) is not a clash (AC-18).
 */
export function findClashes(
  shows: readonly Timed[],
  selectedIds: ReadonlySet<string>,
): Set<string> {
  const chosen = shows
    .filter((show) => selectedIds.has(show.id))
    .map((show) => ({
      id: show.id,
      dayId: show.dayId,
      start: Date.parse(show.startsAt),
      end: Date.parse(show.endsAt),
    }));
  const clashes = new Set<string>();
  chosen.forEach((a, index) => {
    for (const b of chosen.slice(index + 1)) {
      if (a.dayId === b.dayId && a.start < b.end && b.start < a.end) {
        clashes.add(a.id);
        clashes.add(b.id);
      }
    }
  });
  return clashes;
}
