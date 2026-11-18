// The group on the grid (FEAT-006c): who of the chosen group picked each show, which group is
// chosen, and the checks for what of it is read back from the device. Pure: no I/O. Everything
// that comes from `localStorage` is untrusted (R-04, R-05), so the parsers drop it instead of
// throwing.
import {
  GROUP_ID_PATTERN,
  GROUP_NAME_MAX_LENGTH,
  graphemeCount,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS_PER_USER,
} from "@/lib/group-rules";
import {
  FORMAT_VERSION,
  isBoundedString,
  isFields,
  parseJson,
  USER_ID_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
} from "@/lib/stored-value";

/** A friend in a group: what the grid shows of them, never their account id (R-02). */
export type FriendPicks = { name: string; initials: string; showIds: string[] };

/** One of the user's groups, with the other members and their saved selection. */
export type GroupPicks = { id: string; name: string; friends: FriendPicks[] };

/** What the user chose in the picker: a group, or `null` for "Sin grupo". */
export type GroupChoice = { groupId: string | null };

/** One key per user: reading another user's choice means asking for theirs. */
export const GROUP_CHOICE_KEY_PREFIX = "mi-grilla:group-choice:";

/** How many initials a show block shows before "+N" (FR-02). */
const MAX_VISIBLE_INITIALS = 3;
/** Everyone in the group but the user. */
const MAX_FRIENDS = MAX_GROUP_MEMBERS - 1;
/** `initialsOf` writes 2; a little room, and still a bound. */
const INITIALS_MAX_GRAPHEMES = 4;
/** A cheap bound before segmenting: room for 4 emoji with modifiers, not for a huge string. */
const INITIALS_MAX_UNITS = INITIALS_MAX_GRAPHEMES * 16;

/** For each show, the friends of `group` who picked it, in the order they joined the group. */
export function picksByShow(group: GroupPicks | undefined): Map<string, FriendPicks[]> {
  const byShow = new Map<string, FriendPicks[]>();
  for (const friend of group?.friends ?? []) {
    for (const showId of friend.showIds) {
      const friends = byShow.get(showId);
      if (friends) {
        friends.push(friend);
      } else {
        byShow.set(showId, [friend]);
      }
    }
  }
  return byShow;
}

/** The first 3 friends' initials, and how many more there are for "+N". */
export function indicatorParts(friends: readonly FriendPicks[]): {
  initials: string[];
  extra: number;
} {
  return {
    initials: friends.slice(0, MAX_VISIBLE_INITIALS).map((friend) => friend.initials),
    extra: Math.max(0, friends.length - MAX_VISIBLE_INITIALS),
  };
}

/**
 * The group to show: `undefined` when there are no groups (no picker), `null` for "Sin grupo", the
 * stored group if it is still one of `groups`, and otherwise the most recent one (R-05).
 */
export function resolveGroupChoice(
  groups: readonly GroupPicks[],
  stored: GroupChoice | undefined,
): string | null | undefined {
  const latest = groups[0];
  if (latest === undefined) {
    return undefined;
  }
  if (stored?.groupId === null) {
    return null;
  }
  const kept = groups.find((group) => group.id === stored?.groupId);
  return kept ? kept.id : latest.id;
}

/**
 * The group the wallpaper sheet starts with (FEAT-007, FR-02): `shownGroupId` (the grid picker's
 * value, already resolved by `resolveGroupChoice`) if it is one of `groups`; otherwise, "Sin grupo"
 * (`null`) included, the most recent one; `undefined` when there are no groups.
 */
export function wallpaperGroupDefault(
  groups: readonly GroupPicks[],
  shownGroupId: string | null | undefined,
): string | undefined {
  const shown = groups.find((group) => group.id === shownGroupId);
  return shown ? shown.id : groups[0]?.id;
}

/** The key of the group choice of `userId`. */
export function groupChoiceKey(userId: string): string {
  return `${GROUP_CHOICE_KEY_PREFIX}${userId}`;
}

/**
 * The choice stored as `raw` if it belongs to `userId`, or `undefined`. The owner inside the value
 * must match the one asked for, not only the key it was read from (R-05).
 */
export function parseGroupChoice(raw: string | null, userId: string): GroupChoice | undefined {
  const value = parseJson(raw);
  if (
    !isFields(value) ||
    value.version !== FORMAT_VERSION ||
    !isBoundedString(value.userId, USER_ID_MAX_LENGTH) ||
    value.userId !== userId
  ) {
    return undefined;
  }
  const { groupId } = value;
  if (groupId === null) {
    return { groupId: null };
  }
  return typeof groupId === "string" && GROUP_ID_PATTERN.test(groupId) ? { groupId } : undefined;
}

/** A list of at most `max` items through `parse`, or `null` if it is not one or any item fails. */
function boundedListOf<T>(
  value: unknown,
  max: number,
  parse: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value) || value.length > max) {
    return null;
  }
  const items: T[] = [];
  for (const item of value as unknown[]) {
    const parsed = parse(item);
    if (parsed === null) {
      return null;
    }
    items.push(parsed);
  }
  return items;
}

function isGroupName(value: unknown): value is string {
  // A code point is at most 2 UTF-16 units: a longer string is rejected before it is walked (R-04).
  if (typeof value !== "string" || value.length > GROUP_NAME_MAX_LENGTH * 2) {
    return false;
  }
  // Code points, as `varchar(40)` counts them.
  const length = Array.from(value).length;
  return length >= 1 && length <= GROUP_NAME_MAX_LENGTH;
}

function isInitials(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= INITIALS_MAX_UNITS &&
    graphemeCount(value) <= INITIALS_MAX_GRAPHEMES
  );
}

function friendOf(value: unknown, knownShowIds: ReadonlySet<string>): FriendPicks | null {
  if (
    !isFields(value) ||
    !isBoundedString(value.name, USER_NAME_MAX_LENGTH) ||
    !isInitials(value.initials) ||
    !Array.isArray(value.showIds)
  ) {
    return null;
  }
  const showIds = new Set<string>();
  for (const id of value.showIds as unknown[]) {
    if (typeof id !== "string" || !knownShowIds.has(id) || showIds.has(id)) {
      return null;
    }
    showIds.add(id);
  }
  return { name: value.name, initials: value.initials, showIds: [...showIds] };
}

function groupOf(value: unknown, knownShowIds: ReadonlySet<string>): GroupPicks | null {
  if (
    !isFields(value) ||
    typeof value.id !== "string" ||
    !GROUP_ID_PATTERN.test(value.id) ||
    !isGroupName(value.name)
  ) {
    return null;
  }
  const friends = boundedListOf(value.friends, MAX_FRIENDS, (item) => friendOf(item, knownShowIds));
  return friends ? { id: value.id, name: value.name, friends } : null;
}

/**
 * The groups stored in the device copy, or `[]` if anything in them is off: all of them or none,
 * never a part (R-04). `knownShowIds` are the shows of the copy's own grid.
 */
export function groupPicksOf(value: unknown, knownShowIds: ReadonlySet<string>): GroupPicks[] {
  const groups = boundedListOf(value, MAX_GROUPS_PER_USER, (item) => groupOf(item, knownShowIds));
  if (!groups) {
    return [];
  }
  // The picker keys its options by group id, so a repeated one is as bad as a malformed one.
  const ids = new Set(groups.map((group) => group.id));
  return ids.size === groups.length ? groups : [];
}
