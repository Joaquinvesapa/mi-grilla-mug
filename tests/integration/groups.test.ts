import pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { INVITE_TTL_MS } from "@/lib/group-rules";
import { getDb } from "@/server/db";
import { createGroupsService } from "@/server/groups";
import { generateToken, hashToken, openToken, sealToken } from "@/server/invite-crypto";

const START = new Date("2026-03-10T15:00:00.000Z");
const MINUTE_MS = 60_000;
const LOCK_WAIT_POLLS = 200;
const LOCK_POLL_MS = 25;

let clock = START;
const logged: string[] = [];

/** The real service over the real database, with a clock the test moves. */
const groups = createGroupsService({
  db: getDb(),
  now: () => clock,
  hashToken,
  sealToken,
  openToken,
  log: (line) => logged.push(line),
});

/** A user row straight in the table: these tests are about groups, not about sign-up. */
async function createUser(id: string, name = id): Promise<string> {
  await getDb().user.create({ data: { id, name, email: `${id}@mail.com` } });
  return id;
}

async function createGroupOf(userId: string, name = `Grupo de ${userId}`): Promise<string> {
  const result = await groups.createGroup(userId, name);
  if (!result.ok) {
    throw new Error(`createGroup failed: ${result.code}`);
  }
  return result.groupId;
}

/** The active link of a group, as one of its members sees it. */
async function tokenOf(userId: string, groupId: string): Promise<string> {
  const result = await groups.getGroup(userId, groupId);
  if (!result.ok || !result.group.invite) {
    throw new Error("no readable invite");
  }
  return result.group.invite.token;
}

async function memberCount(groupId: string): Promise<number> {
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM group_members WHERE group_id = ${groupId}`;
  return rows[0]?.count ?? -1;
}

async function groupCountOf(userId: string): Promise<number> {
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM group_members WHERE user_id = ${userId}`;
  return rows[0]?.count ?? -1;
}

/** Seeded show ids (the base is migrated and seeded), sorted as the query sorts them. */
async function seededShowIds(): Promise<string[]> {
  const rows = await getDb().$queryRaw<{ id: string }[]>`SELECT id FROM shows ORDER BY id`;
  expect(rows.length, "seeded shows (pnpm db:seed)").toBeGreaterThanOrEqual(6);
  return rows.map((row) => row.id);
}

/** A saved selection, straight in `selected_shows`. */
async function saveSelection(userId: string, showIds: string[]): Promise<void> {
  for (const showId of showIds) {
    await getDb().$executeRaw`
      INSERT INTO selected_shows (user_id, show_id) VALUES (${userId}, ${showId})`;
  }
}

/** The group's members as the database has them, oldest first. */
async function membersOf(groupId: string): Promise<{ user_id: string; is_admin: boolean }[]> {
  return getDb().$queryRaw<{ user_id: string; is_admin: boolean }[]>`
    SELECT user_id, is_admin FROM group_members WHERE group_id = ${groupId}
    ORDER BY joined_at, user_id`;
}

async function groupExists(groupId: string): Promise<boolean> {
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    SELECT (SELECT count(*) FROM groups WHERE id = ${groupId})::int
         + (SELECT count(*) FROM group_invites WHERE group_id = ${groupId})::int AS count`;
  return (rows[0]?.count ?? 0) > 0;
}

async function groupIdsOf(userId: string): Promise<string[]> {
  const result = await groups.listGroups(userId);
  if (!result.ok) {
    throw new Error(result.code);
  }
  return result.groups.map((group) => group.id);
}

/** Ana creates a group and the given users join it, one minute apart, in that order. */
async function groupWith(admin: string, ...others: string[]): Promise<string> {
  const groupId = await createGroupOf(admin, "Los del Lolla");
  const token = await tokenOf(admin, groupId);
  for (const [index, user] of others.entries()) {
    clock = new Date(START.getTime() + (index + 1) * MINUTE_MS);
    const joined = await groups.joinGroup(user, token);
    if (!joined.ok) {
      throw new Error(`joinGroup failed: ${joined.code}`);
    }
  }
  return groupId;
}

/** A plain `pg` connection, to hold a transaction open while the service runs. */
async function connect(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

/**
 * Waits until some backend of this database is waiting on a row lock, or `settled()` says the
 * operation under test already finished without waiting. True only in the first case.
 */
async function waitUntilBlocked(probe: pg.Client, settled: () => boolean): Promise<boolean> {
  for (let poll = 0; poll < LOCK_WAIT_POLLS; poll += 1) {
    if (settled()) {
      return false;
    }
    const { rows } = await probe.query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if ((rows[0]?.waiting ?? 0) > 0) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  return false;
}

/** Waits until at least `count` backends of this database wait on a lock; false if never. */
async function waitUntilWaiting(probe: pg.Client, count: number): Promise<boolean> {
  for (let poll = 0; poll < LOCK_WAIT_POLLS; poll += 1) {
    const { rows } = await probe.query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if ((rows[0]?.waiting ?? 0) >= count) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  return false;
}

let aux: pg.Client | undefined;
let probe: pg.Client | undefined;

beforeEach(() => {
  clock = START;
  logged.length = 0;
});

afterEach(async () => {
  await aux?.query("ROLLBACK").catch(() => undefined);
  await aux?.end();
  await probe?.end();
  aux = undefined;
  probe = undefined;
});

describe("groups", () => {
  it('groups: crear "Los del Lolla" deja al usuario como único integrante y administrador', async () => {
    const ana = await createUser("ana", "Ana Pérez");

    const result = await groups.createGroup(ana, "Los del Lolla");
    expect(result.ok).toBe(true);
    const groupId = result.ok ? result.groupId : "";
    expect(groupId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    const members = await getDb().$queryRaw<{ user_id: string; is_admin: boolean }[]>`
      SELECT user_id, is_admin FROM group_members WHERE group_id = ${groupId}`;
    expect(members).toStrictEqual([{ user_id: ana, is_admin: true }]);

    const group = await groups.getGroup(ana, groupId);
    expect(group.ok && group.group.name).toBe("Los del Lolla");
    expect(group.ok && group.group.isAdmin).toBe(true);
    expect(group.ok && group.group.members).toStrictEqual([
      { name: "Ana Pérez", initials: "AP", isAdmin: true, userId: ana, isSelf: true },
    ]);
  });

  it("groups: nombre vacío, de 41 puntos de código o con emojis que pasan de 40 es inválido", async () => {
    const ana = await createUser("ana");
    for (const name of ["", "   ", "a".repeat(41), "🎸".repeat(41), `${"🎸".repeat(40)}a`]) {
      expect(await groups.createGroup(ana, name)).toStrictEqual({
        ok: false,
        code: "INVALID_NAME",
      });
    }
    expect(await groupCountOf(ana)).toBe(0);
    const stored = await getDb().$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM groups`;
    expect(stored[0]?.count).toBe(0);

    // 40 emojis are 80 UTF-16 units: the same unit as varchar(40), so PostgreSQL keeps them all.
    const forty = "🎸".repeat(40);
    const groupId = await createGroupOf(ana, ` ${forty} `);
    const rows = await getDb().$queryRaw<{ name: string }[]>`
      SELECT name FROM groups WHERE id = ${groupId}`;
    expect(rows[0]?.name).toBe(forty);
  });

  it("groups: el grupo nace con un link que vence a las 72 h", async () => {
    const ana = await createUser("ana");
    const groupId = await createGroupOf(ana);

    const rows = await getDb().$queryRaw<{ created_at: Date; expires_at: Date }[]>`
      SELECT created_at, expires_at FROM group_invites WHERE group_id = ${groupId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.created_at).toStrictEqual(START);
    expect(rows[0]?.expires_at).toStrictEqual(new Date(START.getTime() + 72 * 60 * MINUTE_MS));

    const group = await groups.getGroup(ana, groupId);
    expect(group.ok && group.group.invite?.expiresAt).toStrictEqual(
      new Date(START.getTime() + INVITE_TTL_MS),
    );
    expect(group.ok && group.group.invite?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("groups: generar un link nuevo invalida el anterior", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await createGroupOf(ana);
    const oldToken = await tokenOf(ana, groupId);

    clock = new Date(START.getTime() + MINUTE_MS);
    expect(await groups.regenerateInvite(ana, groupId)).toStrictEqual({ ok: true });
    const newToken = await tokenOf(ana, groupId);
    expect(newToken).not.toBe(oldToken);

    expect(await groups.getInvitePreview(beto, oldToken)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
    expect(await groups.joinGroup(beto, oldToken)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
    expect(await memberCount(groupId)).toBe(1);

    // The new link counts its 72 h from the moment it was generated.
    const group = await groups.getGroup(ana, groupId);
    expect(group.ok && group.group.invite?.expiresAt).toStrictEqual(
      new Date(clock.getTime() + INVITE_TTL_MS),
    );
    expect((await groups.getInvitePreview(beto, newToken)).ok).toBe(true);
  });

  it("groups: un integrante común que genera un link es rechazado (NOT_ADMIN)", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await createGroupOf(ana);
    const token = await tokenOf(ana, groupId);
    expect((await groups.joinGroup(beto, token)).ok).toBe(true);

    expect(await groups.regenerateInvite(beto, groupId)).toStrictEqual({
      ok: false,
      code: "NOT_ADMIN",
    });
    // The previous link keeps working.
    expect(await tokenOf(ana, groupId)).toBe(token);
    const group = await groups.getGroup(beto, groupId);
    expect(group.ok && group.group.isAdmin).toBe(false);
  });

  it("groups: unirse con un link vigente suma al usuario", async () => {
    const ana = await createUser("ana", "Ana Pérez");
    const beto = await createUser("beto", "Bruno");
    const groupId = await createGroupOf(ana, "Los del Lolla");
    const token = await tokenOf(ana, groupId);

    expect(await groups.getInvitePreview(beto, token)).toStrictEqual({
      ok: true,
      groupId,
      name: "Los del Lolla",
      memberCount: 1,
      alreadyMember: false,
    });
    clock = new Date(START.getTime() + 5 * MINUTE_MS);
    expect(await groups.joinGroup(beto, token)).toStrictEqual({
      ok: true,
      groupId,
      alreadyMember: false,
    });

    const rows = await getDb().$queryRaw<{ is_admin: boolean; joined_at: Date }[]>`
      SELECT is_admin, joined_at FROM group_members WHERE group_id = ${groupId} AND user_id = ${beto}`;
    expect(rows).toStrictEqual([{ is_admin: false, joined_at: clock }]);
    const group = await groups.getGroup(beto, groupId);
    expect(group.ok && group.group.members).toStrictEqual([
      { name: "Ana Pérez", initials: "AP", isAdmin: true, userId: ana, isSelf: false },
      { name: "Bruno", initials: "BR", isAdmin: false, userId: beto, isSelf: true },
    ]);
  });

  it("groups: un link de hace 72 h es inválido y no une; a las 71 h 59 min todavía vale", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const carla = await createUser("carla");
    const groupId = await createGroupOf(ana);
    const token = await tokenOf(ana, groupId);

    clock = new Date(START.getTime() + (72 * 60 - 1) * MINUTE_MS);
    expect((await groups.getInvitePreview(beto, token)).ok).toBe(true);
    expect(await groups.joinGroup(beto, token)).toStrictEqual({
      ok: true,
      groupId,
      alreadyMember: false,
    });

    clock = new Date(START.getTime() + 72 * 60 * MINUTE_MS);
    expect(await groups.getInvitePreview(carla, token)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
    expect(await groups.joinGroup(carla, token)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
    expect(await memberCount(groupId)).toBe(2);
  });

  it("groups: con 20 integrantes el grupo está completo y unirse es rechazado", async () => {
    const ana = await createUser("ana");
    const groupId = await createGroupOf(ana);
    const token = await tokenOf(ana, groupId);
    for (let i = 2; i <= 20; i += 1) {
      const user = await createUser(`user-${String(i).padStart(2, "0")}`);
      expect((await groups.joinGroup(user, token)).ok).toBe(true);
    }
    expect(await memberCount(groupId)).toBe(20);

    const late = await createUser("late");
    expect(await groups.joinGroup(late, token)).toStrictEqual({ ok: false, code: "GROUP_FULL" });
    expect(await memberCount(groupId)).toBe(20);
    expect(await groupCountOf(late)).toBe(0);
  });

  it("groups: con 10 grupos unirse y crear son rechazados", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const first = await createGroupOf(ana, "Primero");
    const second = await createGroupOf(ana, "Segundo");
    for (let i = 1; i <= 9; i += 1) {
      await createGroupOf(beto, `Beto ${i}`);
    }
    // The 10th, by joining.
    expect((await groups.joinGroup(beto, await tokenOf(ana, first))).ok).toBe(true);
    expect(await groupCountOf(beto)).toBe(10);

    expect(await groups.joinGroup(beto, await tokenOf(ana, second))).toStrictEqual({
      ok: false,
      code: "USER_GROUP_LIMIT",
    });
    expect(await groups.createGroup(beto, "Uno más")).toStrictEqual({
      ok: false,
      code: "USER_GROUP_LIMIT",
    });
    expect(await groupCountOf(beto)).toBe(10);
    expect(await memberCount(second)).toBe(1);
  });

  it("groups: el integrante que abre su propio link, vigente o vencido, no se duplica", async () => {
    const ana = await createUser("ana");
    const groupId = await createGroupOf(ana, "Los del Lolla");
    const token = await tokenOf(ana, groupId);
    const own = { ok: true, groupId, name: "Los del Lolla", memberCount: 1, alreadyMember: true };

    expect(await groups.getInvitePreview(ana, token)).toStrictEqual(own);
    expect(await groups.joinGroup(ana, token)).toStrictEqual({
      ok: true,
      groupId,
      alreadyMember: true,
    });

    clock = new Date(START.getTime() + 73 * 60 * MINUTE_MS);
    expect(await groups.getInvitePreview(ana, token)).toStrictEqual(own);
    expect(await groups.joinGroup(ana, token)).toStrictEqual({
      ok: true,
      groupId,
      alreadyMember: true,
    });
    expect(await memberCount(groupId)).toBe(1);
    const rows = await getDb().$queryRaw<{ is_admin: boolean }[]>`
      SELECT is_admin FROM group_members WHERE group_id = ${groupId}`;
    expect(rows).toStrictEqual([{ is_admin: true }]);
  });

  it("groups: la lista trae los grupos con integrantes, iniciales y administrador, en orden", async () => {
    const ana = await createUser("ana", "Ana Pérez");
    const beto = await createUser("beto", "Bruno");
    const carla = await createUser("carla", "Carla Sofía Ruiz");
    const dani = await createUser("dani", "Dani");

    clock = new Date(START.getTime() + 1 * MINUTE_MS);
    const g1 = await createGroupOf(ana, "Uno");
    clock = new Date(START.getTime() + 2 * MINUTE_MS);
    const g2 = await createGroupOf(beto, "Dos");
    clock = new Date(START.getTime() + 3 * MINUTE_MS);
    const g2Token = await tokenOf(beto, g2);
    expect((await groups.joinGroup(ana, g2Token)).ok).toBe(true);
    // Carla and Dani join at the same instant: the tie is broken by user id.
    clock = new Date(START.getTime() + 4 * MINUTE_MS);
    expect((await groups.joinGroup(dani, g2Token)).ok).toBe(true);
    expect((await groups.joinGroup(carla, g2Token)).ok).toBe(true);
    // Two groups created at the same instant: the tie is broken by group id.
    clock = new Date(START.getTime() + 5 * MINUTE_MS);
    const g3 = await createGroupOf(ana, "Tres");
    const g4 = await createGroupOf(ana, "Cuatro");
    const [tieFirst, tieSecond] = [g3, g4].sort();

    const result = await groups.listGroups(ana);
    expect(result.ok).toBe(true);
    const list = result.ok ? result.groups : [];
    expect(list.map((group) => group.id)).toStrictEqual([tieFirst, tieSecond, g2, g1]);
    expect(list.find((group) => group.id === g2)).toStrictEqual({
      id: g2,
      name: "Dos",
      members: [
        { name: "Bruno", initials: "BR", isAdmin: true },
        { name: "Ana Pérez", initials: "AP", isAdmin: false },
        { name: "Carla Sofía Ruiz", initials: "CR", isAdmin: false },
        { name: "Dani", initials: "DA", isAdmin: false },
      ],
    });
    expect(list.find((group) => group.id === g1)).toStrictEqual({
      id: g1,
      name: "Uno",
      members: [{ name: "Ana Pérez", initials: "AP", isAdmin: true }],
    });

    expect(await groups.listGroups(await createUser("nadie"))).toStrictEqual({
      ok: true,
      groups: [],
    });
  });

  it("groups: un no integrante es rechazado y no recibe nombre ni integrantes", async () => {
    const ana = await createUser("ana");
    const intruso = await createUser("intruso");
    const groupId = await createGroupOf(ana, "Los del Lolla");
    const token = await tokenOf(ana, groupId);

    const notFound = { ok: false, code: "NOT_FOUND" };
    expect(await groups.getGroup(intruso, groupId)).toStrictEqual(notFound);
    // A group that does not exist answers exactly the same.
    expect(await groups.getGroup(intruso, crypto.randomUUID())).toStrictEqual(notFound);
    expect(await groups.regenerateInvite(intruso, groupId)).toStrictEqual(notFound);
    expect(await groups.listGroups(intruso)).toStrictEqual({ ok: true, groups: [] });
    // Nothing changed: the link is the same.
    expect(await tokenOf(ana, groupId)).toBe(token);
  });

  it("groups: la fila de la invitación no contiene el token en claro", async () => {
    const ana = await createUser("ana");
    const groupId = await createGroupOf(ana);
    const token = await tokenOf(ana, groupId);

    const rows = await getDb().$queryRaw<
      { token_hash: string; token_ciphertext: string; row: string }[]
    >`
      SELECT token_hash, token_ciphertext, row_to_json(i)::text AS row
      FROM group_invites i WHERE group_id = ${groupId}`;
    const row = rows[0];
    expect(row?.token_hash).toBe(hashToken(token));
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.row).not.toContain(token);
    expect(row?.token_ciphertext).not.toContain(token);
    expect(openToken(row?.token_ciphertext ?? "", groupId)).toBe(token);
    // Nor anywhere else in the database's group tables.
    const anywhere = await getDb().$queryRaw<{ found: number }[]>`
      SELECT (SELECT count(*) FROM groups g WHERE row_to_json(g)::text LIKE ${`%${token}%`})::int
           + (SELECT count(*) FROM group_members m WHERE row_to_json(m)::text LIKE ${`%${token}%`})::int
           + (SELECT count(*) FROM group_invites i WHERE row_to_json(i)::text LIKE ${`%${token}%`})::int
        AS found`;
    expect(anywhere[0]?.found).toBe(0);
  });

  it("groups: un segundo administrador en el mismo grupo es rechazado por el índice parcial", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await createGroupOf(ana);

    // Guard against a future `prisma migrate dev` that drops the hand-written partial index.
    const indexes = await getDb().$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = 'group_members'
        AND indexname = 'group_members_one_admin_idx'`;
    expect(indexes).toHaveLength(1);
    expect(indexes[0]?.indexdef).toMatch(/UNIQUE INDEX .*\(group_id\) WHERE is_admin/);

    await expect(
      getDb().$executeRaw`
        INSERT INTO group_members (group_id, user_id, is_admin, joined_at)
        VALUES (${groupId}, ${beto}, true, ${clock})`,
    ).rejects.toThrow(/group_members_one_admin_idx|unique/i);
    // A common member is fine.
    await getDb().$executeRaw`
      INSERT INTO group_members (group_id, user_id, is_admin, joined_at)
      VALUES (${groupId}, ${beto}, false, ${clock})`;
    expect(await memberCount(groupId)).toBe(2);
  });
});

describe("listGroupPicks", () => {
  it("test-groups-picks-friends — listGroupPicks devuelve los demás integrantes con su selección guardada y sin el propio usuario", async () => {
    const [s1 = "", s2 = "", s3 = ""] = await seededShowIds();
    const ana = await createUser("ana", "Ana Pérez");
    const beto = await createUser("beto", "Bruno");
    const carla = await createUser("carla", "Carla Sofía Ruiz");
    const groupId = await createGroupOf(ana, "Los del Lolla");
    const token = await tokenOf(ana, groupId);
    clock = new Date(START.getTime() + MINUTE_MS);
    expect((await groups.joinGroup(beto, token)).ok).toBe(true);
    clock = new Date(START.getTime() + 2 * MINUTE_MS);
    expect((await groups.joinGroup(carla, token)).ok).toBe(true);
    await saveSelection(ana, [s1]);
    await saveSelection(beto, [s3, s1]);
    await saveSelection(carla, [s2]);

    expect(await groups.listGroupPicks(ana)).toStrictEqual({
      ok: true,
      groups: [
        {
          id: groupId,
          name: "Los del Lolla",
          friends: [
            { name: "Bruno", initials: "BR", showIds: [s1, s3] },
            { name: "Carla Sofía Ruiz", initials: "CR", showIds: [s2] },
          ],
        },
      ],
    });
    // From Bruno's side, Ana is a friend and he is not.
    const fromBeto = await groups.listGroupPicks(beto);
    expect(fromBeto.ok && fromBeto.groups[0]?.friends.map((friend) => friend.name)).toStrictEqual([
      "Ana Pérez",
      "Carla Sofía Ruiz",
    ]);
    expect(logged).toStrictEqual([]);
  });

  it("test-groups-picks-order — listGroupPicks ordena los grupos del más reciente al más viejo y los amigos por fecha de unión", async () => {
    const ana = await createUser("ana", "Ana Pérez");
    const beto = await createUser("beto", "Bruno");
    const dani = await createUser("dani", "Dani");
    // Their ids sort opposite to their names and to the order they join in, so only the
    // user-id tie-break can put Valen first.
    const valen = await createUser("friend-a", "Valen");
    const bauti = await createUser("friend-b", "Bauti");

    clock = new Date(START.getTime() + 1 * MINUTE_MS);
    const g1 = await createGroupOf(ana, "Uno");
    clock = new Date(START.getTime() + 2 * MINUTE_MS);
    const g2 = await createGroupOf(beto, "Dos");
    const g2Token = await tokenOf(beto, g2);
    clock = new Date(START.getTime() + 3 * MINUTE_MS);
    expect((await groups.joinGroup(ana, g2Token)).ok).toBe(true);
    expect((await groups.joinGroup(dani, g2Token)).ok).toBe(true);
    // Two friends (not the viewer) join at the same instant: the tie is broken by user id.
    clock = new Date(START.getTime() + 4 * MINUTE_MS);
    expect((await groups.joinGroup(bauti, g2Token)).ok).toBe(true);
    expect((await groups.joinGroup(valen, g2Token)).ok).toBe(true);
    // Two groups created at the same instant: the tie is broken by group id.
    clock = new Date(START.getTime() + 5 * MINUTE_MS);
    const g3 = await createGroupOf(ana, "Tres");
    const g4 = await createGroupOf(ana, "Cuatro");
    const [tieFirst, tieSecond] = [g3, g4].sort();

    const result = await groups.listGroupPicks(ana);
    expect(result.ok).toBe(true);
    const list = result.ok ? result.groups : [];
    // The first one is the group Ana joined last (FR-04).
    expect(list.map((group) => group.id)).toStrictEqual([tieFirst, tieSecond, g2, g1]);
    expect(
      list.find((group) => group.id === g2)?.friends.map((friend) => friend.name),
    ).toStrictEqual(["Bruno", "Dani", "Valen", "Bauti"]);
  });

  it("test-groups-picks-privacy — listGroupPicks no incluye a quien está en otro grupo ni grupos ajenos", async () => {
    const [s1 = "", s2 = "", , , s5 = "", s6 = ""] = await seededShowIds();
    const ana = await createUser("ana", "Ana Pérez");
    const beto = await createUser("beto", "Bruno");
    const tercero = await createUser("tercero", "Tercero Ajeno");
    const ours = await createGroupOf(ana, "Los del Lolla");
    expect((await groups.joinGroup(beto, await tokenOf(ana, ours))).ok).toBe(true);
    // A third user, in another group with Bruno, with a saved selection of their own.
    const theirs = await createGroupOf(tercero, "Grupo ajeno");
    const theirsWithBeto = await createGroupOf(tercero, "Otro ajeno");
    expect((await groups.joinGroup(beto, await tokenOf(tercero, theirsWithBeto))).ok).toBe(true);
    await saveSelection(tercero, [s5, s6]);
    await saveSelection(beto, [s1, s2]);

    const result = await groups.listGroupPicks(ana);
    expect(result).toStrictEqual({
      ok: true,
      groups: [
        {
          id: ours,
          name: "Los del Lolla",
          friends: [{ name: "Bruno", initials: "BR", showIds: [s1, s2] }],
        },
      ],
    });
    const text = JSON.stringify(result);
    expect(text).not.toContain("Tercero");
    expect(text).not.toContain(theirs);
    expect(text).not.toContain(theirsWithBeto);
    expect(text).not.toContain(s5);
    expect(text).not.toContain(s6);

    // The unauthorized side: the third user does not get Ana's group nor her selection.
    const fromTercero = await groups.listGroupPicks(tercero);
    expect(JSON.stringify(fromTercero)).not.toContain(ours);
    expect(JSON.stringify(fromTercero)).not.toContain("Ana");
    // Someone in no group gets nothing.
    expect(await groups.listGroupPicks(await createUser("nadie"))).toStrictEqual({
      ok: true,
      groups: [],
    });
  });

  it("test-groups-picks-saved-only — listGroupPicks solo trae lo guardado en selected_shows", async () => {
    const [s1 = "", s2 = "", s3 = ""] = await seededShowIds();
    const ana = await createUser("ana", "Ana Pérez");
    const beto = await createUser("beto", "Bruno");
    const carla = await createUser("carla", "Carla");
    const groupId = await createGroupOf(ana, "Los del Lolla");
    const token = await tokenOf(ana, groupId);
    expect((await groups.joinGroup(beto, token)).ok).toBe(true);
    expect((await groups.joinGroup(carla, token)).ok).toBe(true);
    await saveSelection(beto, [s2]);

    const before = await groups.listGroupPicks(ana);
    expect(before.ok && before.groups[0]?.friends).toStrictEqual([
      { name: "Bruno", initials: "BR", showIds: [s2] },
      // Carla saved nothing: she is a friend with an empty selection.
      { name: "Carla", initials: "CA", showIds: [] },
    ]);

    // What Bruno saves next shows up; what he removes, disappears.
    await saveSelection(beto, [s1, s3]);
    await getDb().$executeRaw`
      DELETE FROM selected_shows WHERE user_id = ${beto} AND show_id = ${s2}`;
    const after = await groups.listGroupPicks(ana);
    expect(after.ok && after.groups[0]?.friends[0]?.showIds).toStrictEqual([s1, s3]);
  });

  it("test-groups-picks-alone — un grupo sin otros integrantes aparece con friends vacío", async () => {
    const [s1 = ""] = await seededShowIds();
    const ana = await createUser("ana", "Ana Pérez");
    await saveSelection(ana, [s1]);
    const groupId = await createGroupOf(ana, "Solo yo");

    expect(await groups.listGroupPicks(ana)).toStrictEqual({
      ok: true,
      groups: [{ id: groupId, name: "Solo yo", friends: [] }],
    });
  });

  it("test-groups-picks-no-user-ids — el resultado no tiene ids de cuenta de los amigos", async () => {
    const [s1 = ""] = await seededShowIds();
    const ana = await createUser("acct-ana-7f3a91", "Ana Pérez");
    const beto = await createUser("acct-beto-c42e08", "Bruno");
    const groupId = await createGroupOf(ana, "Los del Lolla");
    expect((await groups.joinGroup(beto, await tokenOf(ana, groupId))).ok).toBe(true);
    await saveSelection(beto, [s1]);

    const result = await groups.listGroupPicks(ana);
    expect(result.ok && result.groups[0]?.friends).toHaveLength(1);
    const text = JSON.stringify(result);
    expect(text).not.toContain(beto);
    expect(text).not.toContain(ana);
    expect(text).not.toContain("acct-");
  });
});

describe("administrar y salir de un grupo", () => {
  const notFound = { ok: false, code: "NOT_FOUND" } as const;

  it("groups: test-remove-member-ac14: el admin saca a un integrante y ya no figura", async () => {
    const ana = await createUser("ana", "Ana Pérez");
    const beto = await createUser("beto", "Bruno");
    const carla = await createUser("carla", "Carla");
    const groupId = await groupWith(ana, beto, carla);

    expect(await groups.removeMember(ana, groupId, beto)).toStrictEqual({ ok: true });

    const group = await groups.getGroup(ana, groupId);
    expect(group.ok && group.group.members).toStrictEqual([
      { name: "Ana Pérez", initials: "AP", isAdmin: true, userId: ana, isSelf: true },
      { name: "Carla", initials: "CA", isAdmin: false, userId: carla, isSelf: false },
    ]);
  });

  it("groups: test-delete-group-ac15: el admin borra el grupo y desaparece para todos", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await groupWith(ana, beto);
    const token = await tokenOf(ana, groupId);

    expect(await groups.deleteGroup(ana, groupId)).toStrictEqual({ ok: true });

    for (const user of [ana, beto]) {
      expect(await groups.getGroup(user, groupId)).toStrictEqual(notFound);
      expect(await groupIdsOf(user)).toStrictEqual([]);
    }
    expect(await groupExists(groupId)).toBe(false);
    expect(await memberCount(groupId)).toBe(0);
    // The link no longer exists: nobody can preview it or join with it.
    const carla = await createUser("carla");
    expect(await groups.getInvitePreview(carla, token)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
    expect(await groups.joinGroup(carla, token)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
  });

  it("groups: test-admin-leaves-ac17: sale el admin y el integrante más antiguo pasa a administrar", async () => {
    const ana = await createUser("ana");
    // `zoe` joins before `beto`: the oldest `joined_at` wins, not the lowest id.
    const zoe = await createUser("zoe");
    const beto = await createUser("beto");
    const groupId = await groupWith(ana, zoe, beto);

    expect(await groups.leaveGroup(ana, groupId)).toStrictEqual({ ok: true });

    expect(await membersOf(groupId)).toStrictEqual([
      { user_id: zoe, is_admin: true },
      { user_id: beto, is_admin: false },
    ]);
    const group = await groups.getGroup(zoe, groupId);
    expect(group.ok && group.group.isAdmin).toBe(true);
  });

  it("groups: test-admin-leaves-ac17: con dos integrantes que entraron a la vez desempata el user_id", async () => {
    const ana = await createUser("ana");
    const zoe = await createUser("zoe");
    const beto = await createUser("beto");
    const groupId = await createGroupOf(ana);
    const token = await tokenOf(ana, groupId);
    clock = new Date(START.getTime() + MINUTE_MS);
    expect((await groups.joinGroup(zoe, token)).ok).toBe(true);
    expect((await groups.joinGroup(beto, token)).ok).toBe(true);

    expect(await groups.leaveGroup(ana, groupId)).toStrictEqual({ ok: true });

    expect(await membersOf(groupId)).toStrictEqual([
      { user_id: beto, is_admin: true },
      { user_id: zoe, is_admin: false },
    ]);
  });

  it("groups: test-last-member-leaves-ac18: sale el último integrante y el grupo y su link dejan de existir", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await createGroupOf(ana);
    const token = await tokenOf(ana, groupId);

    expect(await groups.leaveGroup(ana, groupId)).toStrictEqual({ ok: true });

    expect(await groupExists(groupId)).toBe(false);
    expect(await memberCount(groupId)).toBe(0);
    expect(await groups.getInvitePreview(beto, token)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
  });

  it("groups: test-left-member-rejected-ac19: quien salió y quien fue sacado no ven más el grupo", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const carla = await createUser("carla");
    const groupId = await groupWith(ana, beto, carla);

    expect(await groups.leaveGroup(beto, groupId)).toStrictEqual({ ok: true });
    expect(await groups.removeMember(ana, groupId, carla)).toStrictEqual({ ok: true });

    for (const user of [beto, carla]) {
      expect(await groups.getGroup(user, groupId)).toStrictEqual(notFound);
      expect(await groupIdsOf(user)).toStrictEqual([]);
    }
    expect(await groupIdsOf(ana)).toStrictEqual([groupId]);
  });

  it("groups: test-rejoin-after-leave: quien salió vuelve a unirse con un link vigente", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await groupWith(ana, beto);
    expect(await groups.leaveGroup(beto, groupId)).toStrictEqual({ ok: true });

    const token = await tokenOf(ana, groupId);
    expect(await groups.joinGroup(beto, token)).toStrictEqual({
      ok: true,
      groupId,
      alreadyMember: false,
    });
    expect(await membersOf(groupId)).toStrictEqual([
      { user_id: ana, is_admin: true },
      { user_id: beto, is_admin: false },
    ]);
  });

  it("groups: test-rename-group: el admin renombra y el grupo tiene el nombre nuevo", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await groupWith(ana, beto);

    expect(await groups.renameGroup(ana, groupId, "  Los de siempre ")).toStrictEqual({ ok: true });

    for (const user of [ana, beto]) {
      const group = await groups.getGroup(user, groupId);
      expect(group.ok && group.group.name).toBe("Los de siempre");
    }
  });

  it("groups: test-member-leaves-keeps-admin: sale un integrante común y el admin sigue siendo el mismo", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const carla = await createUser("carla");
    const groupId = await groupWith(ana, beto, carla);

    expect(await groups.leaveGroup(beto, groupId)).toStrictEqual({ ok: true });

    expect(await membersOf(groupId)).toStrictEqual([
      { user_id: ana, is_admin: true },
      { user_id: carla, is_admin: false },
    ]);
  });

  it("groups: test-non-admin-rejected: un integrante común no renombra, no saca ni borra", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const carla = await createUser("carla");
    const groupId = await groupWith(ana, beto, carla);
    const token = await tokenOf(ana, groupId);
    const notAdmin = { ok: false, code: "NOT_ADMIN" };

    expect(await groups.renameGroup(beto, groupId, "Mío")).toStrictEqual(notAdmin);
    expect(await groups.removeMember(beto, groupId, carla)).toStrictEqual(notAdmin);
    expect(await groups.removeMember(beto, groupId, ana)).toStrictEqual(notAdmin);
    expect(await groups.deleteGroup(beto, groupId)).toStrictEqual(notAdmin);

    // Nothing changed.
    const group = await groups.getGroup(ana, groupId);
    expect(group.ok && group.group.name).toBe("Los del Lolla");
    expect(await membersOf(groupId)).toStrictEqual([
      { user_id: ana, is_admin: true },
      { user_id: beto, is_admin: false },
      { user_id: carla, is_admin: false },
    ]);
    expect(await tokenOf(ana, groupId)).toBe(token);
  });

  it("groups: test-foreign-group-rejected: un no integrante y un groupId inválido reciben NOT_FOUND", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const intruso = await createUser("intruso");
    const groupId = await groupWith(ana, beto);

    for (const target of [groupId, crypto.randomUUID(), "not-a-uuid", groupId.toUpperCase()]) {
      expect(await groups.renameGroup(intruso, target, "Mío")).toStrictEqual(notFound);
      expect(await groups.removeMember(intruso, target, beto)).toStrictEqual(notFound);
      expect(await groups.deleteGroup(intruso, target)).toStrictEqual(notFound);
      expect(await groups.leaveGroup(intruso, target)).toStrictEqual(notFound);
    }
    // Ana is the admin of her own group, but a malformed id is still nobody's group.
    expect(await groups.deleteGroup(ana, "not-a-uuid")).toStrictEqual(notFound);

    const group = await groups.getGroup(ana, groupId);
    expect(group.ok && group.group.name).toBe("Los del Lolla");
    expect(await memberCount(groupId)).toBe(2);
  });

  it("groups: test-invalid-name-rejected: renombrar con un nombre vacío o de 41 puntos de código es rechazado", async () => {
    const ana = await createUser("ana");
    const groupId = await createGroupOf(ana, "Los del Lolla");

    for (const name of ["", "   ", "a".repeat(41), "🎸".repeat(41)]) {
      expect(await groups.renameGroup(ana, groupId, name)).toStrictEqual({
        ok: false,
        code: "INVALID_NAME",
      });
    }
    const group = await groups.getGroup(ana, groupId);
    expect(group.ok && group.group.name).toBe("Los del Lolla");
  });

  it("groups: test-member-not-found-rejected: sacarse a uno mismo, a alguien que no está o un id inválido", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const otro = await createUser("otro");
    const groupId = await groupWith(ana, beto);
    const memberNotFound = { ok: false, code: "MEMBER_NOT_FOUND" };

    for (const memberUserId of [ana, otro, "nadie", "", "beto; DROP TABLE users", "x".repeat(65)]) {
      expect(await groups.removeMember(ana, groupId, memberUserId)).toStrictEqual(memberNotFound);
    }
    expect(await membersOf(groupId)).toStrictEqual([
      { user_id: ana, is_admin: true },
      { user_id: beto, is_admin: false },
    ]);
  });

  it("groups: test-regenerate-after-leave-rejected: el admin que salió no regenera y el promovido sí", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await groupWith(ana, beto);
    const token = await tokenOf(ana, groupId);

    expect(await groups.leaveGroup(ana, groupId)).toStrictEqual({ ok: true });

    expect(await groups.regenerateInvite(ana, groupId)).toStrictEqual(notFound);
    expect(await tokenOf(beto, groupId)).toBe(token);
    expect(await groups.regenerateInvite(beto, groupId)).toStrictEqual({ ok: true });
    expect(await tokenOf(beto, groupId)).not.toBe(token);
  });

  it("groups: las operaciones de administrar y salir no registran nada", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const carla = await createUser("carla");
    const groupId = await groupWith(ana, beto, carla);
    await groups.renameGroup(ana, groupId, "Otro");
    await groups.removeMember(ana, groupId, carla);
    await groups.leaveGroup(ana, groupId);
    await groups.deleteGroup(beto, groupId);
    expect(await groupExists(groupId)).toBe(false);
    expect(logged).toStrictEqual([]);
  });
});

describe("groups under concurrency", () => {
  it("groups: con el grupo bloqueado, la unión número 21 espera y es rechazada", async () => {
    const ana = await createUser("ana");
    const groupId = await createGroupOf(ana);
    const token = await tokenOf(ana, groupId);
    for (let i = 2; i <= 19; i += 1) {
      const user = await createUser(`user-${String(i).padStart(2, "0")}`);
      expect((await groups.joinGroup(user, token)).ok).toBe(true);
    }
    const twentieth = await createUser("user-20");
    const late = await createUser("late");
    expect(await memberCount(groupId)).toBe(19);

    // Another join holds the group's lock and adds the 20th member, without committing yet.
    aux = await connect();
    probe = await connect();
    await aux.query("BEGIN");
    await aux.query("SELECT id FROM groups WHERE id = $1 FOR UPDATE", [groupId]);
    await aux.query(
      "INSERT INTO group_members (group_id, user_id, is_admin, joined_at) VALUES ($1, $2, false, $3)",
      [groupId, twentieth, clock],
    );

    let settled = false;
    const joining = groups.joinGroup(late, token).finally(() => {
      settled = true;
    });
    const waited = await waitUntilBlocked(probe, () => settled);
    await aux.query("COMMIT");
    const result = await joining;

    expect(result).toStrictEqual({ ok: false, code: "GROUP_FULL" });
    expect(waited).toBe(true);
    expect(await memberCount(groupId)).toBe(20);
  });

  it("groups: con el usuario bloqueado, unirse a dos grupos en 9 deja una rechazada", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    for (let i = 1; i <= 9; i += 1) {
      await createGroupOf(beto, `Beto ${i}`);
    }
    const first = await createGroupOf(ana, "Primero");
    const second = await createGroupOf(ana, "Segundo");
    const secondToken = await tokenOf(ana, second);

    // The first join holds beto's lock and adds his 10th group, without committing yet.
    aux = await connect();
    probe = await connect();
    await aux.query("BEGIN");
    await aux.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [beto]);
    await aux.query(
      "INSERT INTO group_members (group_id, user_id, is_admin, joined_at) VALUES ($1, $2, false, $3)",
      [first, beto, clock],
    );

    let settled = false;
    const joining = groups.joinGroup(beto, secondToken).finally(() => {
      settled = true;
    });
    const waited = await waitUntilBlocked(probe, () => settled);
    await aux.query("COMMIT");
    const result = await joining;

    expect(result).toStrictEqual({ ok: false, code: "USER_GROUP_LIMIT" });
    expect(waited).toBe(true);
    expect(await groupCountOf(beto)).toBe(10);
    expect(await memberCount(second)).toBe(1);
  });

  it("groups: test-concurrent-leaves: el admin y el más antiguo salen a la vez y queda un solo admin", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const carla = await createUser("carla");
    const groupId = await groupWith(ana, beto, carla);

    // Something else holds the group's lock, so both leaves queue up behind it: ana first, then
    // beto, who waits for ana's promotion of him to commit.
    aux = await connect();
    probe = await connect();
    await aux.query("BEGIN");
    await aux.query("SELECT id FROM groups WHERE id = $1 FOR UPDATE", [groupId]);

    const adminLeaves = groups.leaveGroup(ana, groupId);
    const firstWaits = await waitUntilWaiting(probe, 1);
    const oldestLeaves = groups.leaveGroup(beto, groupId);
    const secondWaits = await waitUntilWaiting(probe, 2);
    await aux.query("COMMIT");
    const results = await Promise.all([adminLeaves, oldestLeaves]);

    expect(firstWaits).toBe(true);
    expect(secondWaits).toBe(true);
    expect(results).toStrictEqual([{ ok: true }, { ok: true }]);
    expect(await membersOf(groupId)).toStrictEqual([{ user_id: carla, is_admin: true }]);
    const admins = await getDb().$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM group_members WHERE group_id = ${groupId} AND is_admin`;
    expect(admins[0]?.count).toBe(1);
    expect(logged).toStrictEqual([]);
  });

  it("groups: test-concurrent-leaves: si la promoción commitea mientras espera, quien sale la ve", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const carla = await createUser("carla");
    const groupId = await groupWith(ana, beto, carla);

    // Ana's leave in flight, by hand: the group locked, her row gone and beto promoted, not
    // committed. Beto's leave waits for it and must see that he is the admin now (spec round 1, F1).
    aux = await connect();
    probe = await connect();
    await aux.query("BEGIN");
    await aux.query("SELECT id FROM groups WHERE id = $1 FOR UPDATE", [groupId]);
    await aux.query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2", [
      groupId,
      ana,
    ]);
    await aux.query(
      "UPDATE group_members SET is_admin = true WHERE group_id = $1 AND user_id = $2",
      [groupId, beto],
    );

    let settled = false;
    const leaving = groups.leaveGroup(beto, groupId).finally(() => {
      settled = true;
    });
    const waited = await waitUntilBlocked(probe, () => settled);
    await aux.query("COMMIT");
    const result = await leaving;

    expect(waited).toBe(true);
    expect(result).toStrictEqual({ ok: true });
    expect(await membersOf(groupId)).toStrictEqual([{ user_id: carla, is_admin: true }]);
  });

  it("groups: unirse con el link viejo mientras se regenera es rechazado", async () => {
    const ana = await createUser("ana");
    const beto = await createUser("beto");
    const groupId = await createGroupOf(ana);
    const oldToken = await tokenOf(ana, groupId);

    // regenerateInvite in flight: the group's lock taken and the invite replaced, not committed.
    const newToken = generateToken();
    aux = await connect();
    probe = await connect();
    await aux.query("BEGIN");
    await aux.query("SELECT id FROM groups WHERE id = $1 FOR UPDATE", [groupId]);
    await aux.query(
      `UPDATE group_invites SET token_hash = $2, token_ciphertext = $3, created_at = $4, expires_at = $5
       WHERE group_id = $1`,
      [
        groupId,
        hashToken(newToken),
        sealToken(newToken, groupId),
        clock,
        new Date(clock.getTime() + INVITE_TTL_MS),
      ],
    );

    let settled = false;
    const joining = groups.joinGroup(beto, oldToken).finally(() => {
      settled = true;
    });
    const waited = await waitUntilBlocked(probe, () => settled);
    await aux.query("COMMIT");
    const result = await joining;

    expect(result).toStrictEqual({ ok: false, code: "INVALID_INVITE" });
    expect(waited).toBe(true);
    expect(await memberCount(groupId)).toBe(1);
    expect(await tokenOf(ana, groupId)).toBe(newToken);
  });
});

describe("groups logging", () => {
  it("las operaciones correctas no registran nada", async () => {
    const ana = await createUser("ana");
    await createGroupOf(ana);
    expect(logged).toStrictEqual([]);
  });
});
