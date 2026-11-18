import "server-only";

import { randomUUID } from "node:crypto";

import {
  GROUP_ID_PATTERN,
  INVITE_TOKEN_PATTERN,
  INVITE_TTL_MS,
  initialsOf,
  MAX_GROUP_MEMBERS,
  MAX_GROUPS_PER_USER,
  normalizeGroupName,
  USER_ID_PATTERN,
} from "@/lib/group-rules";
import { getDb } from "@/server/db";
import type { PrismaClient } from "@/server/generated/prisma/client";
import {
  generateToken as defaultGenerateToken,
  hashToken as sharedHashToken,
  openToken as sharedOpenToken,
  sealToken as sharedSealToken,
} from "@/server/invite-crypto";

type Unavailable = { ok: false; code: "SERVICE_UNAVAILABLE" };

export type GroupMember = { name: string; initials: string; isAdmin: boolean };

export type GroupSummary = { id: string; name: string; members: GroupMember[] };

/**
 * A member as the group's own screen sees it: with the id it removes them by, which only the members
 * of the same group receive (`listGroups` never exposes it), and whether it is the session's user.
 */
export type GroupDetailMember = GroupMember & { userId: string; isSelf: boolean };

export type GroupDetail = Omit<GroupSummary, "members"> & {
  members: GroupDetailMember[];
  isAdmin: boolean;
  /** `null` when the link cannot be opened (a rotated secret): the admin generates a new one. */
  invite: { token: string; expiresAt: Date } | null;
};

export type CreateGroupResult =
  | { ok: true; groupId: string }
  | { ok: false; code: "INVALID_NAME" | "USER_GROUP_LIMIT" }
  | Unavailable;

export type ListGroupsResult = { ok: true; groups: GroupSummary[] } | Unavailable;

export type GetGroupResult =
  | { ok: true; group: GroupDetail }
  | { ok: false; code: "NOT_FOUND" }
  | Unavailable;

export type RegenerateInviteResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "NOT_ADMIN" }
  | Unavailable;

export type RenameGroupResult =
  | { ok: true }
  | { ok: false; code: "INVALID_NAME" | "NOT_FOUND" | "NOT_ADMIN" }
  | Unavailable;

export type RemoveMemberResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "NOT_ADMIN" | "MEMBER_NOT_FOUND" }
  | Unavailable;

export type DeleteGroupResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "NOT_ADMIN" }
  | Unavailable;

export type LeaveGroupResult = { ok: true } | { ok: false; code: "NOT_FOUND" } | Unavailable;

export type InvitePreviewResult =
  | { ok: true; groupId: string; name: string; memberCount: number; alreadyMember: boolean }
  | { ok: false; code: "INVALID_INVITE" }
  | Unavailable;

export type JoinGroupResult =
  | { ok: true; groupId: string; alreadyMember: boolean }
  | { ok: false; code: "INVALID_INVITE" | "GROUP_FULL" | "USER_GROUP_LIMIT" }
  | Unavailable;

export type GroupsOptions = {
  db: Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "$transaction">;
  /** The clock every date is written and compared with; PostgreSQL's own `now()` is never used. */
  now?: () => Date;
  generateToken?: () => string;
  hashToken: (token: string) => string;
  sealToken: (token: string, groupId: string) => string;
  openToken: (ciphertext: string, groupId: string) => string | null;
  /** Receives a single line, `[groups] SERVICE_UNAVAILABLE at=…`. Defaults to `console.error`. */
  log?: (line: string) => void;
};

export type GroupsService = {
  createGroup(userId: string, name: unknown): Promise<CreateGroupResult>;
  listGroups(userId: string): Promise<ListGroupsResult>;
  getGroup(userId: string, groupId: unknown): Promise<GetGroupResult>;
  regenerateInvite(userId: string, groupId: unknown): Promise<RegenerateInviteResult>;
  renameGroup(userId: string, groupId: unknown, name: unknown): Promise<RenameGroupResult>;
  removeMember(
    userId: string,
    groupId: unknown,
    memberUserId: unknown,
  ): Promise<RemoveMemberResult>;
  deleteGroup(userId: string, groupId: unknown): Promise<DeleteGroupResult>;
  leaveGroup(userId: string, groupId: unknown): Promise<LeaveGroupResult>;
  getInvitePreview(userId: string, token: unknown): Promise<InvitePreviewResult>;
  joinGroup(userId: string, token: unknown): Promise<JoinGroupResult>;
};

const UNAVAILABLE = { ok: false, code: "SERVICE_UNAVAILABLE" } as const;
const INVALID_NAME = { ok: false, code: "INVALID_NAME" } as const;
const USER_GROUP_LIMIT = { ok: false, code: "USER_GROUP_LIMIT" } as const;
const GROUP_FULL = { ok: false, code: "GROUP_FULL" } as const;
const INVALID_INVITE = { ok: false, code: "INVALID_INVITE" } as const;
const NOT_FOUND = { ok: false, code: "NOT_FOUND" } as const;
const NOT_ADMIN = { ok: false, code: "NOT_ADMIN" } as const;
const MEMBER_NOT_FOUND = { ok: false, code: "MEMBER_NOT_FOUND" } as const;
const OK = { ok: true } as const;

/** Thrown inside a transaction when the session's user row is gone, so it rolls back. Never leaves here. */
class MissingUserError extends Error {}

/** Only the generic code and the time, never the error (R-08). */
function defaultLog(line: string): void {
  console.error(line);
}

function isGroupId(value: unknown): value is string {
  return typeof value === "string" && GROUP_ID_PATTERN.test(value);
}

function isToken(value: unknown): value is string {
  return typeof value === "string" && INVITE_TOKEN_PATTERN.test(value);
}

function isUserId(value: unknown): value is string {
  return typeof value === "string" && USER_ID_PATTERN.test(value);
}

function memberOf(row: { name: string; is_admin: boolean }): GroupMember {
  return { name: row.name, initials: initialsOf(row.name), isAdmin: row.is_admin };
}

/**
 * Groups, their members and their invite link over `groups`, `group_members` and `group_invites`.
 * The `userId` always comes from a verified session (R-01) and every read filters by its
 * membership (R-04). Every statement is a parameterized tagged template, every write runs in a
 * transaction, and the locks are always taken user first, then group, so they never deadlock
 * (R-03, R-13).
 */
export function createGroupsService({
  db,
  now = () => new Date(),
  generateToken = defaultGenerateToken,
  hashToken,
  sealToken,
  openToken,
  log = defaultLog,
}: GroupsOptions): GroupsService {
  function unavailable(): Unavailable {
    log(`[groups] SERVICE_UNAVAILABLE at=${now().toISOString()}`);
    return UNAVAILABLE;
  }

  /** A fresh link for `groupId`, with its dates from the clock: only its hash and ciphertext. */
  function newInvite(groupId: string, at: Date) {
    const token = generateToken();
    return {
      tokenHash: hashToken(token),
      ciphertext: sealToken(token, groupId),
      expiresAt: new Date(at.getTime() + INVITE_TTL_MS),
    };
  }

  /** The session's user row, locked until the transaction ends; throws if it is gone. */
  async function lockUser(tx: Pick<PrismaClient, "$queryRaw">, userId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    if (rows.length === 0) {
      throw new MissingUserError();
    }
  }

  /** Locks the group's row until the transaction ends; `false` if the group does not exist. */
  async function lockGroup(tx: Pick<PrismaClient, "$queryRaw">, groupId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM groups WHERE id = ${groupId} FOR UPDATE`;
    return rows.length > 0;
  }

  /**
   * Locks the group, then reads the session's role in it: `null` if the group does not exist or the
   * user is not a member (R-05). Two statements on purpose: in READ COMMITTED a statement that waited
   * for the lock keeps its old snapshot, while the second one takes a new snapshot and sees what the
   * transaction that held the lock committed — a leave and its promotion included (spec round 1, F1).
   */
  async function lockedRole(
    tx: Pick<PrismaClient, "$queryRaw">,
    userId: string,
    groupId: string,
  ): Promise<{ isAdmin: boolean } | null> {
    if (!(await lockGroup(tx, groupId))) {
      return null;
    }
    const rows = await tx.$queryRaw<{ is_admin: boolean }[]>`
      SELECT is_admin FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}`;
    const membership = rows[0];
    return membership ? { isAdmin: membership.is_admin } : null;
  }

  /**
   * Runs `write` in a transaction with the group locked, only if the session's user administers it.
   * None of these operations adds a group to anybody, so they take no user lock and the "user, then
   * group" order of `joinGroup` holds (R-03).
   */
  async function asAdmin<T>(
    userId: string,
    groupId: unknown,
    write: (tx: Pick<PrismaClient, "$queryRaw" | "$executeRaw">, groupId: string) => Promise<T>,
  ): Promise<T | typeof NOT_FOUND | typeof NOT_ADMIN | Unavailable> {
    if (!isGroupId(groupId)) {
      return NOT_FOUND;
    }
    try {
      return await db.$transaction(async (tx) => {
        const role = await lockedRole(tx, userId, groupId);
        if (!role) {
          return NOT_FOUND;
        }
        if (!role.isAdmin) {
          return NOT_ADMIN;
        }
        return write(tx, groupId);
      });
    } catch {
      return unavailable();
    }
  }

  async function groupCountOf(
    tx: Pick<PrismaClient, "$queryRaw">,
    userId: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM group_members WHERE user_id = ${userId}`;
    return rows[0]?.count ?? 0;
  }

  return {
    async createGroup(userId, rawName) {
      const name = normalizeGroupName(rawName);
      if (name === null) {
        return INVALID_NAME;
      }
      try {
        return await db.$transaction(async (tx): Promise<CreateGroupResult> => {
          // Two creates of the same user queue up here, so neither passes the 10 by counting
          // before the other one commits (R-03).
          await lockUser(tx, userId);
          if ((await groupCountOf(tx, userId)) >= MAX_GROUPS_PER_USER) {
            return USER_GROUP_LIMIT;
          }
          const groupId = randomUUID();
          const at = now();
          const invite = newInvite(groupId, at);
          await tx.$executeRaw`
            INSERT INTO groups (id, name, created_at) VALUES (${groupId}, ${name}, ${at})`;
          await tx.$executeRaw`
            INSERT INTO group_members (group_id, user_id, is_admin, joined_at)
            VALUES (${groupId}, ${userId}, ${true}, ${at})`;
          await tx.$executeRaw`
            INSERT INTO group_invites (group_id, token_hash, token_ciphertext, created_at, expires_at)
            VALUES (${groupId}, ${invite.tokenHash}, ${invite.ciphertext}, ${at}, ${invite.expiresAt})`;
          return { ok: true, groupId };
        });
      } catch {
        return unavailable();
      }
    },

    async listGroups(userId) {
      try {
        const rows = await db.$queryRaw<
          { group_id: string; group_name: string; member_name: string; is_admin: boolean }[]
        >`
          SELECT g.id AS group_id, g.name AS group_name, u.name AS member_name, m.is_admin
          FROM group_members me
          JOIN groups g ON g.id = me.group_id
          JOIN group_members m ON m.group_id = g.id
          JOIN users u ON u.id = m.user_id
          WHERE me.user_id = ${userId}
          ORDER BY me.joined_at DESC, g.id, m.joined_at, m.user_id`;
        // The rows come in the final order: each group starts where its id first appears.
        const groups = new Map<string, GroupSummary>();
        for (const row of rows) {
          let group = groups.get(row.group_id);
          if (!group) {
            group = { id: row.group_id, name: row.group_name, members: [] };
            groups.set(row.group_id, group);
          }
          group.members.push(memberOf({ name: row.member_name, is_admin: row.is_admin }));
        }
        return { ok: true, groups: [...groups.values()] };
      } catch {
        return unavailable();
      }
    },

    async getGroup(userId, groupId) {
      if (!isGroupId(groupId)) {
        return NOT_FOUND;
      }
      try {
        // Joined through the session user's own membership: someone else's group and one that does
        // not exist both find no row, and answer the same (R-04).
        const groups = await db.$queryRaw<
          {
            id: string;
            name: string;
            is_admin: boolean;
            token_ciphertext: string | null;
            expires_at: Date | null;
          }[]
        >`
          SELECT g.id, g.name, me.is_admin, i.token_ciphertext, i.expires_at
          FROM group_members me JOIN groups g ON g.id = me.group_id
          LEFT JOIN group_invites i ON i.group_id = g.id
          WHERE me.user_id = ${userId} AND me.group_id = ${groupId}`;
        const group = groups[0];
        if (!group) {
          return NOT_FOUND;
        }
        const members = await db.$queryRaw<{ user_id: string; name: string; is_admin: boolean }[]>`
          SELECT m.user_id, u.name, m.is_admin
          FROM group_members m JOIN users u ON u.id = m.user_id
          WHERE m.group_id = ${groupId}
          ORDER BY m.joined_at, m.user_id`;
        return {
          ok: true,
          group: {
            id: group.id,
            name: group.name,
            isAdmin: group.is_admin,
            members: members.map((row): GroupDetailMember => ({
              ...memberOf(row),
              userId: row.user_id,
              isSelf: row.user_id === userId,
            })),
            invite: readInvite(group.id, group.token_ciphertext, group.expires_at),
          },
        };
      } catch {
        return unavailable();
      }
    },

    regenerateInvite(userId, groupId) {
      // The same group lock a join takes before re-reading the link: a join with the old link
      // either commits before this replacement or sees the new one and is rejected (R-13).
      return asAdmin(userId, groupId, async (tx, id) => {
        const at = now();
        const invite = newInvite(id, at);
        await tx.$executeRaw`
          INSERT INTO group_invites (group_id, token_hash, token_ciphertext, created_at, expires_at)
          VALUES (${id}, ${invite.tokenHash}, ${invite.ciphertext}, ${at}, ${invite.expiresAt})
          ON CONFLICT (group_id) DO UPDATE SET
            token_hash = EXCLUDED.token_hash,
            token_ciphertext = EXCLUDED.token_ciphertext,
            created_at = EXCLUDED.created_at,
            expires_at = EXCLUDED.expires_at`;
        return OK;
      });
    },

    async renameGroup(userId, groupId, rawName) {
      const name = normalizeGroupName(rawName);
      if (name === null) {
        return INVALID_NAME;
      }
      return asAdmin(userId, groupId, async (tx, id) => {
        await tx.$executeRaw`UPDATE groups SET name = ${name} WHERE id = ${id}`;
        return OK;
      });
    },

    async removeMember(userId, groupId, memberUserId) {
      if (!isGroupId(groupId)) {
        return NOT_FOUND;
      }
      if (!isUserId(memberUserId)) {
        return MEMBER_NOT_FOUND;
      }
      return asAdmin(userId, groupId, async (tx, id) => {
        // Leaving is "Salir": the admin never removes themself, so a group is never left adminless.
        if (memberUserId === userId) {
          return MEMBER_NOT_FOUND;
        }
        const removed = await tx.$executeRaw`
          DELETE FROM group_members WHERE group_id = ${id} AND user_id = ${memberUserId}`;
        return removed === 0 ? MEMBER_NOT_FOUND : OK;
      });
    },

    deleteGroup(userId, groupId) {
      return asAdmin(userId, groupId, async (tx, id) => {
        // Its members and its link go with it (`ON DELETE CASCADE`).
        await tx.$executeRaw`DELETE FROM groups WHERE id = ${id}`;
        return OK;
      });
    },

    async leaveGroup(userId, groupId) {
      if (!isGroupId(groupId)) {
        return NOT_FOUND;
      }
      try {
        return await db.$transaction(async (tx): Promise<LeaveGroupResult> => {
          if (!(await lockGroup(tx, groupId))) {
            return NOT_FOUND;
          }
          // The role is the one the deleted row had, read after the lock: a promotion committed by
          // a leave this one waited for is seen (spec round 1, F1).
          const left = await tx.$queryRaw<{ is_admin: boolean }[]>`
            DELETE FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
            RETURNING is_admin`;
          const membership = left[0];
          if (!membership) {
            return NOT_FOUND;
          }
          const remaining = await tx.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM group_members WHERE group_id = ${groupId}`;
          if ((remaining[0]?.count ?? 0) === 0) {
            // The last one out: the group and its link go too (AC-18).
            await tx.$executeRaw`DELETE FROM groups WHERE id = ${groupId}`;
          } else if (membership.is_admin) {
            // The admin's row is already gone, so the partial unique index allows the new one
            // (AC-17, R-06): the oldest member, ties broken by user id.
            await tx.$executeRaw`
              UPDATE group_members SET is_admin = true
              WHERE (group_id, user_id) = (
                SELECT group_id, user_id FROM group_members WHERE group_id = ${groupId}
                ORDER BY joined_at, user_id LIMIT 1
              )`;
          }
          return OK;
        });
      } catch {
        return unavailable();
      }
    },

    async getInvitePreview(userId, token) {
      if (!isToken(token)) {
        return INVALID_INVITE;
      }
      try {
        const rows = await db.$queryRaw<
          {
            id: string;
            name: string;
            expires_at: Date;
            member_count: number;
            already_member: boolean;
          }[]
        >`
          SELECT g.id, g.name, i.expires_at,
            (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id) AS member_count,
            EXISTS (
              SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = ${userId}
            ) AS already_member
          FROM group_invites i JOIN groups g ON g.id = i.group_id
          WHERE i.token_hash = ${hashToken(token)}`;
        const row = rows[0];
        // A member goes to the group even with an expired link (FR-10 before FR-08); a replaced
        // link is no longer in the table, so it finds no row.
        if (!row || (!row.already_member && now().getTime() >= row.expires_at.getTime())) {
          return INVALID_INVITE;
        }
        return {
          ok: true,
          groupId: row.id,
          name: row.name,
          memberCount: row.member_count,
          alreadyMember: row.already_member,
        };
      } catch {
        return unavailable();
      }
    },

    async joinGroup(userId, token) {
      if (!isToken(token)) {
        return INVALID_INVITE;
      }
      try {
        const tokenHash = hashToken(token);
        return await db.$transaction(async (tx): Promise<JoinGroupResult> => {
          // One instant for the whole join: the one that decides the expiry is the `joined_at`.
          const at = now();
          const found = await tx.$queryRaw<{ group_id: string }[]>`
            SELECT group_id FROM group_invites WHERE token_hash = ${tokenHash}`;
          const groupId = found[0]?.group_id;
          if (groupId === undefined) {
            return INVALID_INVITE;
          }
          // User first, then group: the same order everywhere, so two joins never deadlock.
          await lockUser(tx, userId);
          const locked = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM groups WHERE id = ${groupId} FOR UPDATE`;
          if (locked.length === 0) {
            return INVALID_INVITE;
          }
          const membership = await tx.$queryRaw<{ member: number }[]>`
            SELECT 1 AS member FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}`;
          if (membership.length > 0) {
            return { ok: true, groupId, alreadyMember: true };
          }
          // Read again under the group's lock: a link replaced meanwhile no longer matches (R-13).
          const invites = await tx.$queryRaw<{ token_hash: string; expires_at: Date }[]>`
            SELECT token_hash, expires_at FROM group_invites WHERE group_id = ${groupId}`;
          const invite = invites[0];
          if (
            !invite ||
            invite.token_hash !== tokenHash ||
            at.getTime() >= invite.expires_at.getTime()
          ) {
            return INVALID_INVITE;
          }
          const members = await tx.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count FROM group_members WHERE group_id = ${groupId}`;
          if ((members[0]?.count ?? 0) >= MAX_GROUP_MEMBERS) {
            return GROUP_FULL;
          }
          if ((await groupCountOf(tx, userId)) >= MAX_GROUPS_PER_USER) {
            return USER_GROUP_LIMIT;
          }
          await tx.$executeRaw`
            INSERT INTO group_members (group_id, user_id, is_admin, joined_at)
            VALUES (${groupId}, ${userId}, ${false}, ${at})`;
          return { ok: true, groupId, alreadyMember: false };
        });
      } catch {
        return unavailable();
      }
    },
  };

  /**
   * The link a member sees; `null` if there is none or it cannot be opened. `openToken` already
   * answers `null` for a ciphertext that does not authenticate (a rotated secret), which is not an
   * error and is not logged.
   */
  function readInvite(
    groupId: string,
    ciphertext: string | null,
    expiresAt: Date | null,
  ): GroupDetail["invite"] {
    if (ciphertext === null || expiresAt === null) {
      return null;
    }
    let token: string | null;
    try {
      token = openToken(ciphertext, groupId);
    } catch {
      // Unexpected (a missing secret, for example): the generic code goes to the log, and the
      // group is still shown, without a link and without the error (R-08).
      unavailable();
      token = null;
    }
    return token === null ? null : { token, expiresAt };
  }
}

let sharedGroups: GroupsService | undefined;

function shared(): GroupsService {
  sharedGroups ??= createGroupsService({
    db: getDb(),
    hashToken: sharedHashToken,
    sealToken: sharedSealToken,
    openToken: sharedOpenToken,
  });
  return sharedGroups;
}

/** Creates a group with `userId` as its only member and admin, and its first link (FR-01, FR-03). */
export function createGroup(userId: string, name: unknown): Promise<CreateGroupResult> {
  return shared().createGroup(userId, name);
}

/** The groups of `userId`, with their members (FR-11). */
export function listGroups(userId: string): Promise<ListGroupsResult> {
  return shared().listGroups(userId);
}

/** A group `userId` is a member of, with its link; any other id is `NOT_FOUND` (FR-12). */
export function getGroup(userId: string, groupId: unknown): Promise<GetGroupResult> {
  return shared().getGroup(userId, groupId);
}

/** Replaces the group's link; only its admin may (FR-05). */
export function regenerateInvite(
  userId: string,
  groupId: unknown,
): Promise<RegenerateInviteResult> {
  return shared().regenerateInvite(userId, groupId);
}

/** Renames the group; only its admin may (FR-01). */
export function renameGroup(
  userId: string,
  groupId: unknown,
  name: unknown,
): Promise<RenameGroupResult> {
  return shared().renameGroup(userId, groupId, name);
}

/** Removes another member from the group; only its admin may (FR-01, AC-14). */
export function removeMember(
  userId: string,
  groupId: unknown,
  memberUserId: unknown,
): Promise<RemoveMemberResult> {
  return shared().removeMember(userId, groupId, memberUserId);
}

/** Deletes the group, its members and its link; only its admin may (FR-01, AC-15). */
export function deleteGroup(userId: string, groupId: unknown): Promise<DeleteGroupResult> {
  return shared().deleteGroup(userId, groupId);
}

/**
 * Takes `userId` out of the group: the oldest member becomes admin if the admin left, and the group
 * is deleted with its last member (FR-02, AC-17, AC-18).
 */
export function leaveGroup(userId: string, groupId: unknown): Promise<LeaveGroupResult> {
  return shared().leaveGroup(userId, groupId);
}

/** What a link shows before joining: name and member count (FR-06, FR-08, FR-10). */
export function getInvitePreview(userId: string, token: unknown): Promise<InvitePreviewResult> {
  return shared().getInvitePreview(userId, token);
}

/** Joins `userId` to the group of a live link, within both limits (FR-06, FR-09, FR-10). */
export function joinGroup(userId: string, token: unknown): Promise<JoinGroupResult> {
  return shared().joinGroup(userId, token);
}
