// The device copy and the pending selections in `localStorage` (ADR-004). No "use client" of its
// own: only client components import it. Storage can be missing (server render), blocked (private
// mode) or full (quota), so every access is guarded: writes report `STORAGE_UNAVAILABLE` for the
// screen to show (Block 2) and reads fall back to "nothing stored". Everything read goes through
// `src/lib/offline-selection.ts` before anyone sees it (R-02).
import { type GroupChoice, groupChoiceKey, parseGroupChoice } from "@/lib/group-picks";
import {
  type DeviceSnapshot,
  parsePending,
  parseSnapshot,
  pendingKey,
  type PendingSelection,
  SNAPSHOT_KEY,
} from "@/lib/offline-selection";

export type DeviceStoreResult = { ok: true } | { ok: false; code: "STORAGE_UNAVAILABLE" };

const OK = { ok: true } as const;
const UNAVAILABLE = { ok: false, code: "STORAGE_UNAVAILABLE" } as const;

/** The raw value under `key`, or `null` when there is none or storage cannot be read. */
function read(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    // Unreadable storage is "no copy": the screen behaves as if nothing was stored.
    return null;
  }
}

function write(key: string, value: string): DeviceStoreResult {
  try {
    globalThis.localStorage.setItem(key, value);
    return OK;
  } catch {
    return UNAVAILABLE;
  }
}

function remove(key: string): DeviceStoreResult {
  try {
    globalThis.localStorage.removeItem(key);
    return OK;
  } catch {
    return UNAVAILABLE;
  }
}

/** The device copy, if there is a valid one. */
export function readSnapshot(): DeviceSnapshot | null {
  return parseSnapshot(read(SNAPSHOT_KEY));
}

/** Replaces the device copy: there is only one, the last user's. */
export function writeSnapshot(snapshot: DeviceSnapshot): DeviceStoreResult {
  return write(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

/** Forgets the device copy. Pending selections are kept for their owners. */
export function clearSnapshot(): DeviceStoreResult {
  return remove(SNAPSHOT_KEY);
}

/** The pending selection of `userId`, if there is a valid one of theirs. */
export function readPending(userId: string): PendingSelection | null {
  return parsePending(read(pendingKey(userId)), userId);
}

/** Saves `pending` under its owner's key, replacing their previous one. */
export function writePending(pending: PendingSelection): DeviceStoreResult {
  return write(pendingKey(pending.userId), JSON.stringify(pending));
}

/** Forgets the pending selection of `userId` only. */
export function clearPending(userId: string): DeviceStoreResult {
  return remove(pendingKey(userId));
}

/**
 * The group `userId` chose on the grid (FEAT-006c, FR-04): `undefined` when they never chose, or
 * what is stored is invalid or another account's; `{ groupId: null }` for "Sin grupo" (R-05).
 */
export function readGroupChoice(userId: string): GroupChoice | undefined {
  return parseGroupChoice(read(groupChoiceKey(userId)), userId);
}

/**
 * Remembers the group `userId` chose, or `null` for "Sin grupo". Kept when signing out, like the
 * pending selections (ADR-007): it names a group, never what its members picked.
 */
export function writeGroupChoice(userId: string, groupId: string | null): DeviceStoreResult {
  return write(groupChoiceKey(userId), JSON.stringify({ version: 1, userId, groupId }));
}
