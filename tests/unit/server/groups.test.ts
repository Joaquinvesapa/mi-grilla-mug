import { afterEach, describe, expect, it, vi } from "vitest";

const sharedDb = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => {
    throw new Error("connect ECONNREFUSED db.internal:5432 password=hunter2");
  }),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
const getDb = vi.hoisted(() => vi.fn(() => sharedDb));
vi.mock("@/server/db", () => ({ getDb }));

import { INVITE_TTL_MS } from "@/lib/group-rules";
import {
  createGroup,
  createGroupsService,
  getGroup,
  getInvitePreview,
  joinGroup,
  listGroupPicks,
  listGroups,
  regenerateInvite,
} from "@/server/groups";

// Tests may not import the generated client (no-restricted-imports): take its type from the signature.
type GroupsDb = Parameters<typeof createGroupsService>[0]["db"];
type RawCall = unknown[];
/** A rule of the fake database: the first whose pattern matches the SQL answers with its rows. */
type Rule = [pattern: RegExp, answer: unknown[] | ((params: unknown[]) => unknown[])];

const NOW = new Date("2026-03-10T15:00:00.000Z");
const USER_ID = "user-ana";
const GROUP_ID = "0b6c1f0e-8f5d-4c1a-9b8e-2f3d4c5b6a7e";
const TOKEN = "T".repeat(43);
const NEW_TOKEN = "N".repeat(43);
const PG_SECRET = "connect ECONNREFUSED db.internal:5432 password=hunter2";
const LOG_LINE = `[groups] SERVICE_UNAVAILABLE at=${NOW.toISOString()}`;

/** The SQL text of a tagged-template call, with each parameter as `$`. */
function sqlOf(call: RawCall | undefined): string {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join("$").replace(/\s+/g, " ").trim();
}

function paramsOf(call: RawCall | undefined): unknown[] {
  return (call ?? []).slice(1);
}

/**
 * A database that answers each statement with the first rule matching its SQL. A statement no rule
 * matches is a test bug, and throws with the SQL so it shows up.
 */
function fakeDb(rules: Rule[] = []) {
  const answer = async (...args: unknown[]): Promise<unknown> => {
    const sql = sqlOf(args);
    const rule = rules.find(([pattern]) => pattern.test(sql));
    if (!rule) {
      throw new Error(`unexpected SQL: ${sql}`);
    }
    const [, rows] = rule;
    return typeof rows === "function" ? rows(paramsOf(args)) : rows;
  };
  const tx = {
    $queryRaw: vi.fn(answer),
    $executeRaw: vi.fn(async (..._args: unknown[]): Promise<unknown> => 1),
  };
  const db = {
    $queryRaw: vi.fn(answer),
    $executeRaw: vi.fn(async (..._args: unknown[]): Promise<unknown> => 1),
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { db, tx };
}

function brokenDb() {
  const fail = vi.fn(async (..._args: unknown[]): Promise<unknown> => {
    throw new Error(PG_SECRET);
  });
  return { $queryRaw: fail, $executeRaw: fail, $transaction: fail };
}

function cryptoFakes() {
  return {
    generateToken: vi.fn(() => NEW_TOKEN),
    hashToken: vi.fn((token: string) => `hash(${token})`),
    sealToken: vi.fn((token: string, groupId: string) => `sealed(${token}|${groupId})`),
    openToken: vi.fn((ciphertext: string, groupId: string): string | null => {
      const match = /^sealed\((.+)\|(.+)\)$/.exec(ciphertext);
      return match && match[2] === groupId ? (match[1] ?? null) : null;
    }),
  };
}

function serviceOver(db: unknown, overrides: Partial<ReturnType<typeof cryptoFakes>> = {}) {
  const fakes = { ...cryptoFakes(), ...overrides };
  const log = vi.fn((_line: string) => {});
  const service = createGroupsService({
    db: db as GroupsDb,
    now: () => NOW,
    log,
    ...fakes,
  });
  return { service, log, ...fakes };
}

const USER_LOCK = /^SELECT id FROM users WHERE id = \$ FOR UPDATE$/;
const GROUP_LOCK = /^SELECT id FROM groups WHERE id = \$ FOR UPDATE$/;
const USER_COUNT = /FROM group_members WHERE user_id = \$$/;
const GROUP_COUNT = /FROM group_members WHERE group_id = \$$/;
const INVITE_BY_HASH = /FROM group_invites WHERE token_hash = \$$/;
const INVITE_BY_GROUP = /FROM group_invites WHERE group_id = \$$/;
const MEMBERSHIP = /FROM group_members WHERE group_id = \$ AND user_id = \$$/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("input validation", () => {
  it("groups: token mal formado es inválido sin consultar la base", async () => {
    const { db } = fakeDb();
    const { service, hashToken } = serviceOver(db);
    const malformed: unknown[] = [
      "",
      "T".repeat(42),
      "T".repeat(44),
      `${"T".repeat(42)}=`,
      `${"T".repeat(42)}/`,
      `${"T".repeat(42)} `,
      "' OR 1=1 --",
      null,
      undefined,
      42,
      ["T".repeat(43)],
    ];
    for (const token of malformed) {
      expect(await service.getInvitePreview(USER_ID, token)).toStrictEqual({
        ok: false,
        code: "INVALID_INVITE",
      });
      expect(await service.joinGroup(USER_ID, token)).toStrictEqual({
        ok: false,
        code: "INVALID_INVITE",
      });
    }
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(hashToken).not.toHaveBeenCalled();
  });

  it("groups: id de grupo mal formado es rechazado sin consultar la base", async () => {
    const { db } = fakeDb();
    const { service } = serviceOver(db);
    for (const groupId of [
      "",
      "1",
      "not-a-uuid",
      `${GROUP_ID}x`,
      GROUP_ID.toUpperCase(),
      null,
      7,
    ]) {
      expect(await service.getGroup(USER_ID, groupId)).toStrictEqual({
        ok: false,
        code: "NOT_FOUND",
      });
      expect(await service.regenerateInvite(USER_ID, groupId)).toStrictEqual({
        ok: false,
        code: "NOT_FOUND",
      });
    }
    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("un nombre inválido es INVALID_NAME sin consultar la base", async () => {
    const { db } = fakeDb();
    const { service } = serviceOver(db);
    for (const name of ["", "   ", "a".repeat(41), "🎸".repeat(41), null, 3]) {
      expect(await service.createGroup(USER_ID, name)).toStrictEqual({
        ok: false,
        code: "INVALID_NAME",
      });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("createGroup", () => {
  it("bloquea al usuario, cuenta sus grupos y guarda grupo, administrador e invitación con el reloj", async () => {
    const { db, tx } = fakeDb([
      [USER_LOCK, [{ id: USER_ID }]],
      [USER_COUNT, [{ count: 9 }]],
    ]);
    const { service, sealToken, hashToken } = serviceOver(db);

    const result = await service.createGroup(USER_ID, "  Los del Lolla ");
    expect(result.ok).toBe(true);
    const groupId = result.ok ? result.groupId : "";
    expect(groupId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    // The user is locked before counting.
    expect(sqlOf(tx.$queryRaw.mock.calls[0])).toMatch(USER_LOCK);
    expect(sqlOf(tx.$queryRaw.mock.calls[1])).toMatch(USER_COUNT);

    const inserts = tx.$executeRaw.mock.calls;
    expect(inserts).toHaveLength(3);
    expect(sqlOf(inserts[0])).toMatch(/^INSERT INTO groups \(id, name, created_at\)/);
    expect(paramsOf(inserts[0])).toStrictEqual([groupId, "Los del Lolla", NOW]);
    expect(sqlOf(inserts[1])).toMatch(
      /^INSERT INTO group_members \(group_id, user_id, is_admin, joined_at\)/,
    );
    expect(paramsOf(inserts[1])).toStrictEqual([groupId, USER_ID, true, NOW]);
    expect(sqlOf(inserts[2])).toMatch(/^INSERT INTO group_invites/);
    expect(paramsOf(inserts[2])).toStrictEqual([
      groupId,
      `hash(${NEW_TOKEN})`,
      `sealed(${NEW_TOKEN}|${groupId})`,
      NOW,
      new Date(NOW.getTime() + INVITE_TTL_MS),
    ]);
    expect(hashToken).toHaveBeenCalledWith(NEW_TOKEN);
    expect(sealToken).toHaveBeenCalledWith(NEW_TOKEN, groupId);
    // No default of PostgreSQL writes a date: every one is a parameter from the clock.
    for (const call of inserts) {
      expect(sqlOf(call)).not.toMatch(/now\(\)|current_timestamp/i);
    }
  });

  it("con 10 grupos es USER_GROUP_LIMIT y no escribe", async () => {
    const { db, tx } = fakeDb([
      [USER_LOCK, [{ id: USER_ID }]],
      [USER_COUNT, [{ count: 10 }]],
    ]);
    const { service } = serviceOver(db);
    expect(await service.createGroup(USER_ID, "Otro")).toStrictEqual({
      ok: false,
      code: "USER_GROUP_LIMIT",
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("un usuario que ya no existe es SERVICE_UNAVAILABLE", async () => {
    const { db, tx } = fakeDb([[USER_LOCK, []]]);
    const { service, log } = serviceOver(db);
    expect(await service.createGroup(USER_ID, "Otro")).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(LOG_LINE);
  });
});

describe("listGroups", () => {
  it("agrupa las filas en el orden de la consulta, con iniciales y administrador", async () => {
    const rows = [
      { group_id: "g2", group_name: "Segundo", member_name: "Bruno", is_admin: true },
      { group_id: "g2", group_name: "Segundo", member_name: "Ana Pérez", is_admin: false },
      { group_id: "g1", group_name: "Primero", member_name: "Ana Pérez", is_admin: true },
    ];
    const { db } = fakeDb([[/FROM group_members me/, rows]]);
    const { service } = serviceOver(db);

    expect(await service.listGroups(USER_ID)).toStrictEqual({
      ok: true,
      groups: [
        {
          id: "g2",
          name: "Segundo",
          members: [
            { name: "Bruno", initials: "BR", isAdmin: true },
            { name: "Ana Pérez", initials: "AP", isAdmin: false },
          ],
        },
        {
          id: "g1",
          name: "Primero",
          members: [{ name: "Ana Pérez", initials: "AP", isAdmin: true }],
        },
      ],
    });
    const call = db.$queryRaw.mock.calls[0];
    const sql = sqlOf(call);
    expect(sql).toMatch(/WHERE me\.user_id = \$/);
    expect(sql).toMatch(/ORDER BY me\.joined_at DESC, g\.id, m\.joined_at, m\.user_id$/);
    expect(paramsOf(call)).toStrictEqual([USER_ID]);
  });

  it("sin grupos devuelve una lista vacía", async () => {
    const { db } = fakeDb([[/FROM group_members me/, []]]);
    expect(await serviceOver(db).service.listGroups(USER_ID)).toStrictEqual({
      ok: true,
      groups: [],
    });
  });
});

describe("listGroupPicks", () => {
  const PICKS = /FROM group_members me JOIN groups g .* LEFT JOIN selected_shows s/;
  const anaRows = [
    { group_id: "g2", group_name: "Segundo", member_name: "Bruno", show_ids: ["s-1", "s-3"] },
    { group_id: "g2", group_name: "Segundo", member_name: "Carla Sofía Ruiz", show_ids: [] },
    { group_id: "g1", group_name: "Primero", member_name: "Dani", show_ids: ["s-2"] },
  ];

  it("test-groups-picks-friends — listGroupPicks devuelve los demás integrantes con su selección guardada y sin el propio usuario", async () => {
    const { db } = fakeDb([[PICKS, anaRows]]);
    const { service } = serviceOver(db);

    expect(await service.listGroupPicks(USER_ID)).toStrictEqual({
      ok: true,
      groups: [
        {
          id: "g2",
          name: "Segundo",
          friends: [
            { name: "Bruno", initials: "BR", showIds: ["s-1", "s-3"] },
            { name: "Carla Sofía Ruiz", initials: "CR", showIds: [] },
          ],
        },
        {
          id: "g1",
          name: "Primero",
          friends: [{ name: "Dani", initials: "DA", showIds: ["s-2"] }],
        },
      ],
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const call = db.$queryRaw.mock.calls[0];
    const sql = sqlOf(call);
    // Anchored on the session's own membership, without the user among the friends, and only
    // the saved selection (R-01, FR-02, FR-05).
    expect(sql).toMatch(/FROM group_members me JOIN groups g ON g\.id = me\.group_id/);
    expect(sql).toMatch(
      /LEFT JOIN group_members m ON m\.group_id = g\.id AND m\.user_id <> me\.user_id/,
    );
    expect(sql).toMatch(/LEFT JOIN selected_shows s ON s\.user_id = m\.user_id/);
    expect(sql).toMatch(
      /array_agg\(s\.show_id ORDER BY s\.show_id\) FILTER \(WHERE s\.show_id IS NOT NULL\)/,
    );
    expect(sql).toMatch(/WHERE me\.user_id = \$ GROUP BY/);
    // Parameterized: the id travels as a parameter, never inside the SQL text.
    expect(paramsOf(call)).toStrictEqual([USER_ID]);
    expect(sql).not.toContain(USER_ID);
  });

  it("test-groups-picks-order — listGroupPicks ordena los grupos del más reciente al más viejo y los amigos por fecha de unión", async () => {
    // The rows of one group may be split by the database order; a group starts where its id first
    // appears and keeps the friends in the order they come.
    const { db } = fakeDb([[PICKS, anaRows]]);
    const { service } = serviceOver(db);
    const result = await service.listGroupPicks(USER_ID);

    expect(result.ok && result.groups.map((group) => group.id)).toStrictEqual(["g2", "g1"]);
    expect(result.ok && result.groups[0]?.friends.map((friend) => friend.name)).toStrictEqual([
      "Bruno",
      "Carla Sofía Ruiz",
    ]);
    expect(sqlOf(db.$queryRaw.mock.calls[0])).toMatch(
      /ORDER BY me\.joined_at DESC, g\.id, m\.joined_at, m\.user_id$/,
    );
  });

  it("test-groups-picks-alone — un grupo sin otros integrantes aparece con friends vacío", async () => {
    const { db } = fakeDb([
      [PICKS, [{ group_id: "g1", group_name: "Solo yo", member_name: null, show_ids: [] }]],
    ]);
    expect(await serviceOver(db).service.listGroupPicks(USER_ID)).toStrictEqual({
      ok: true,
      groups: [{ id: "g1", name: "Solo yo", friends: [] }],
    });

    const none = fakeDb([[PICKS, []]]);
    expect(await serviceOver(none.db).service.listGroupPicks(USER_ID)).toStrictEqual({
      ok: true,
      groups: [],
    });
  });

  it("test-groups-picks-no-user-ids — el resultado no tiene ids de cuenta de los amigos", async () => {
    // Even if a row carried an account id, it would not leave the function (R-02).
    const rows = [
      { ...anaRows[0], user_id: "user-bruno-secret-id", member_id: "user-bruno-secret-id" },
    ];
    const { db } = fakeDb([[PICKS, rows]]);
    const result = await serviceOver(db).service.listGroupPicks(USER_ID);

    expect(JSON.stringify(result)).not.toContain("user-bruno-secret-id");
    expect(result.ok && Object.keys(result.groups[0] ?? {})).toStrictEqual([
      "id",
      "name",
      "friends",
    ]);
    expect(result.ok && Object.keys(result.groups[0]?.friends[0] ?? {})).toStrictEqual([
      "name",
      "initials",
      "showIds",
    ]);
    // Nor does the query select one: the only user id it reads is the session's, in the filter.
    const select = sqlOf(db.$queryRaw.mock.calls[0]).split(" FROM ")[0] ?? "";
    expect(select).not.toMatch(/user_id/);
  });

  it("test-groups-picks-unavailable — con la base caída devuelve SERVICE_UNAVAILABLE, rechazado sin datos, y registra una línea genérica", async () => {
    const { service, log } = serviceOver(brokenDb());
    expect(await service.listGroupPicks(USER_ID)).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(LOG_LINE);
    expect(String(log.mock.calls[0]?.[0])).not.toContain("hunter2");
  });
});

describe("getGroup", () => {
  const groupRow = {
    id: GROUP_ID,
    name: "Los del Lolla",
    is_admin: true,
    token_ciphertext: `sealed(${TOKEN}|${GROUP_ID})`,
    expires_at: new Date(NOW.getTime() + INVITE_TTL_MS),
  };
  const memberRows = [
    { name: "Ana Pérez", is_admin: true },
    { name: "Bruno", is_admin: false },
  ];

  it("devuelve nombre, integrantes, si administra y el link abierto", async () => {
    const { db } = fakeDb([
      [/FROM group_members me JOIN groups g/, [groupRow]],
      [/FROM group_members m JOIN users u/, memberRows],
    ]);
    const { service, openToken } = serviceOver(db);

    expect(await service.getGroup(USER_ID, GROUP_ID)).toStrictEqual({
      ok: true,
      group: {
        id: GROUP_ID,
        name: "Los del Lolla",
        isAdmin: true,
        members: [
          { name: "Ana Pérez", initials: "AP", isAdmin: true },
          { name: "Bruno", initials: "BR", isAdmin: false },
        ],
        invite: { token: TOKEN, expiresAt: groupRow.expires_at },
      },
    });
    expect(openToken).toHaveBeenCalledWith(groupRow.token_ciphertext, GROUP_ID);
    // Both reads filter by the session's user or by the group it is a member of (R-04).
    expect(paramsOf(db.$queryRaw.mock.calls[0])).toStrictEqual([USER_ID, GROUP_ID]);
    expect(sqlOf(db.$queryRaw.mock.calls[1])).toMatch(/ORDER BY m\.joined_at, m\.user_id$/);
  });

  it("groups: un ciphertext que no abre muestra el grupo sin link", async () => {
    const { db } = fakeDb([
      [/FROM group_members me JOIN groups g/, [{ ...groupRow, token_ciphertext: "rotated" }]],
      [/FROM group_members m JOIN users u/, memberRows],
    ]);
    // A ciphertext that does not authenticate is an expected outcome: no link, nothing logged.
    const { service, log } = serviceOver(db, { openToken: vi.fn(() => null) });
    const result = await service.getGroup(USER_ID, GROUP_ID);
    expect(result.ok && result.group.invite).toBeNull();
    expect(result.ok && result.group.name).toBe("Los del Lolla");
    expect(result.ok && result.group.members).toHaveLength(2);
    expect(log).not.toHaveBeenCalled();
  });

  it("si openToken lanza, el grupo vuelve sin link y queda solo el código en el log", async () => {
    const { db } = fakeDb([
      [/FROM group_members me JOIN groups g/, [groupRow]],
      [/FROM group_members m JOIN users u/, memberRows],
    ]);
    const openToken = vi.fn((_ciphertext: string, _groupId: string): string | null => {
      throw new Error("BETTER_AUTH_SECRET password=hunter2");
    });
    const { service, log } = serviceOver(db, { openToken });
    const result = await service.getGroup(USER_ID, GROUP_ID);

    expect(result.ok && result.group.invite).toBeNull();
    expect(result.ok && result.group.name).toBe("Los del Lolla");
    expect(result.ok && result.group.members).toHaveLength(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(LOG_LINE);
  });

  it("un grupo sin fila de invitación se muestra sin link", async () => {
    const { db } = fakeDb([
      [
        /FROM group_members me JOIN groups g/,
        [{ ...groupRow, token_ciphertext: null, expires_at: null }],
      ],
      [/FROM group_members m JOIN users u/, memberRows],
    ]);
    const result = await serviceOver(db).service.getGroup(USER_ID, GROUP_ID);
    expect(result.ok && result.group.invite).toBeNull();
  });

  it("un grupo del que el usuario no es integrante es NOT_FOUND sin leer integrantes", async () => {
    const { db } = fakeDb([[/FROM group_members me JOIN groups g/, []]]);
    expect(await serviceOver(db).service.getGroup(USER_ID, GROUP_ID)).toStrictEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("regenerateInvite", () => {
  const ADMIN_LOCK = /FROM groups g JOIN group_members m .* FOR UPDATE OF g$/;

  it("el administrador reemplaza la invitación con el reloj, con el grupo bloqueado", async () => {
    const { db, tx } = fakeDb([[ADMIN_LOCK, [{ is_admin: true }]]]);
    const { service } = serviceOver(db);

    expect(await service.regenerateInvite(USER_ID, GROUP_ID)).toStrictEqual({ ok: true });
    expect(paramsOf(tx.$queryRaw.mock.calls[0])).toStrictEqual([USER_ID, GROUP_ID]);
    const upsert = tx.$executeRaw.mock.calls[0];
    expect(sqlOf(upsert)).toMatch(
      /^INSERT INTO group_invites .* ON CONFLICT \(group_id\) DO UPDATE/,
    );
    expect(paramsOf(upsert)).toStrictEqual([
      GROUP_ID,
      `hash(${NEW_TOKEN})`,
      `sealed(${NEW_TOKEN}|${GROUP_ID})`,
      NOW,
      new Date(NOW.getTime() + INVITE_TTL_MS),
    ]);
  });

  it("un integrante común es NOT_ADMIN y un no integrante NOT_FOUND, sin escribir", async () => {
    const common = fakeDb([[ADMIN_LOCK, [{ is_admin: false }]]]);
    expect(await serviceOver(common.db).service.regenerateInvite(USER_ID, GROUP_ID)).toStrictEqual({
      ok: false,
      code: "NOT_ADMIN",
    });
    expect(common.tx.$executeRaw).not.toHaveBeenCalled();

    const stranger = fakeDb([[ADMIN_LOCK, []]]);
    expect(
      await serviceOver(stranger.db).service.regenerateInvite(USER_ID, GROUP_ID),
    ).toStrictEqual({ ok: false, code: "NOT_FOUND" });
    expect(stranger.tx.$executeRaw).not.toHaveBeenCalled();
  });
});

describe("getInvitePreview", () => {
  const PREVIEW = /FROM group_invites i JOIN groups g .* WHERE i\.token_hash = \$$/;
  const valid = {
    id: GROUP_ID,
    name: "Los del Lolla",
    expires_at: new Date(NOW.getTime() + 60_000),
    member_count: 3,
    already_member: false,
  };

  it("con un link vigente devuelve nombre y cantidad, buscando por el hash", async () => {
    const { db } = fakeDb([[PREVIEW, [valid]]]);
    const { service } = serviceOver(db);
    expect(await service.getInvitePreview(USER_ID, TOKEN)).toStrictEqual({
      ok: true,
      groupId: GROUP_ID,
      name: "Los del Lolla",
      memberCount: 3,
      alreadyMember: false,
    });
    expect(paramsOf(db.$queryRaw.mock.calls[0])).toStrictEqual([USER_ID, `hash(${TOKEN})`]);
  });

  it("un link vencido o desconocido es INVALID_INVITE salvo para un integrante", async () => {
    const expired = { ...valid, expires_at: NOW };
    const { service: expiredService } = serviceOver(fakeDb([[PREVIEW, [expired]]]).db);
    expect(await expiredService.getInvitePreview(USER_ID, TOKEN)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });

    const { service: unknownService } = serviceOver(fakeDb([[PREVIEW, []]]).db);
    expect(await unknownService.getInvitePreview(USER_ID, TOKEN)).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });

    const member = { ...expired, already_member: true };
    const { service: memberService } = serviceOver(fakeDb([[PREVIEW, [member]]]).db);
    expect(await memberService.getInvitePreview(USER_ID, TOKEN)).toStrictEqual({
      ok: true,
      groupId: GROUP_ID,
      name: "Los del Lolla",
      memberCount: 3,
      alreadyMember: true,
    });
  });
});

describe("joinGroup", () => {
  const HASH = `hash(${TOKEN})`;

  function joinRules(overrides: Partial<Record<string, unknown[]>> = {}): Rule[] {
    return [
      [INVITE_BY_HASH, overrides.byHash ?? [{ group_id: GROUP_ID }]],
      [USER_LOCK, overrides.userLock ?? [{ id: USER_ID }]],
      [GROUP_LOCK, overrides.groupLock ?? [{ id: GROUP_ID }]],
      [MEMBERSHIP, overrides.membership ?? []],
      [
        INVITE_BY_GROUP,
        overrides.byGroup ?? [{ token_hash: HASH, expires_at: new Date(NOW.getTime() + 1) }],
      ],
      [GROUP_COUNT, overrides.groupCount ?? [{ count: 19 }]],
      [USER_COUNT, overrides.userCount ?? [{ count: 9 }]],
    ];
  }

  it("bloquea usuario y después grupo, revalida el link y suma al usuario", async () => {
    const { db, tx } = fakeDb(joinRules());
    const { service } = serviceOver(db);

    expect(await service.joinGroup(USER_ID, TOKEN)).toStrictEqual({
      ok: true,
      groupId: GROUP_ID,
      alreadyMember: false,
    });
    const order = tx.$queryRaw.mock.calls.map((call) => sqlOf(call));
    const userLock = order.findIndex((sql) => USER_LOCK.test(sql));
    const groupLock = order.findIndex((sql) => GROUP_LOCK.test(sql));
    const recheck = order.findIndex((sql) => INVITE_BY_GROUP.test(sql));
    expect(userLock).toBeGreaterThan(-1);
    expect(groupLock).toBeGreaterThan(userLock);
    expect(recheck).toBeGreaterThan(groupLock);
    const insert = tx.$executeRaw.mock.calls[0];
    expect(sqlOf(insert)).toMatch(
      /^INSERT INTO group_members \(group_id, user_id, is_admin, joined_at\)/,
    );
    expect(paramsOf(insert)).toStrictEqual([GROUP_ID, USER_ID, false, NOW]);
  });

  it("lee el reloj una sola vez: el mismo instante decide el vencimiento y es el joined_at", async () => {
    const { db, tx } = fakeDb(joinRules());
    let ticks = 0;
    // A clock that advances 1 ms on every read.
    const now = vi.fn(() => new Date(NOW.getTime() + ticks++));
    const service = createGroupsService({
      db: db as unknown as GroupsDb,
      now,
      log: vi.fn(),
      ...cryptoFakes(),
    });

    expect((await service.joinGroup(USER_ID, TOKEN)).ok).toBe(true);
    expect(now).toHaveBeenCalledTimes(1);
    expect(paramsOf(tx.$executeRaw.mock.calls[0])).toStrictEqual([GROUP_ID, USER_ID, false, NOW]);
  });

  it("un integrante no se duplica", async () => {
    const { db, tx } = fakeDb(joinRules({ membership: [{ member: 1 }] }));
    expect(await serviceOver(db).service.joinGroup(USER_ID, TOKEN)).toStrictEqual({
      ok: true,
      groupId: GROUP_ID,
      alreadyMember: true,
    });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("rechaza cada caso sin escribir", async () => {
    const cases: [Partial<Record<string, unknown[]>>, string][] = [
      [{ byHash: [] }, "INVALID_INVITE"],
      [{ groupLock: [] }, "INVALID_INVITE"],
      [{ byGroup: [] }, "INVALID_INVITE"],
      [
        { byGroup: [{ token_hash: "hash(other)", expires_at: new Date(NOW.getTime() + 1) }] },
        "INVALID_INVITE",
      ],
      [{ byGroup: [{ token_hash: HASH, expires_at: NOW }] }, "INVALID_INVITE"],
      [{ groupCount: [{ count: 20 }] }, "GROUP_FULL"],
      [{ userCount: [{ count: 10 }] }, "USER_GROUP_LIMIT"],
      [{ userLock: [] }, "SERVICE_UNAVAILABLE"],
    ];
    for (const [overrides, code] of cases) {
      const { db, tx } = fakeDb(joinRules(overrides));
      expect(await serviceOver(db).service.joinGroup(USER_ID, TOKEN)).toStrictEqual({
        ok: false,
        code,
      });
      expect(tx.$executeRaw).not.toHaveBeenCalled();
    }
  });
});

describe("errors", () => {
  it("groups: con la base caída devuelve SERVICE_UNAVAILABLE y registra solo el código", async () => {
    const { service, log } = serviceOver(brokenDb());
    const results = [
      await service.createGroup(USER_ID, "Los del Lolla"),
      await service.listGroups(USER_ID),
      await service.getGroup(USER_ID, GROUP_ID),
      await service.regenerateInvite(USER_ID, GROUP_ID),
      await service.getInvitePreview(USER_ID, TOKEN),
      await service.joinGroup(USER_ID, TOKEN),
      await service.listGroupPicks(USER_ID),
    ];
    for (const result of results) {
      expect(result).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    }
    expect(log).toHaveBeenCalledTimes(7);
    for (const [line] of log.mock.calls) {
      expect(line).toBe(LOG_LINE);
      expect(line).not.toContain("hunter2");
    }
  });

  it("un fallo del cifrado al crear o regenerar también es SERVICE_UNAVAILABLE", async () => {
    const sealToken = vi.fn((): string => {
      throw new Error("BETTER_AUTH_SECRET falta");
    });
    const create = fakeDb([
      [USER_LOCK, [{ id: USER_ID }]],
      [USER_COUNT, [{ count: 0 }]],
    ]);
    const { service, log } = serviceOver(create.db, { sealToken });
    expect(await service.createGroup(USER_ID, "Los del Lolla")).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(log).toHaveBeenCalledWith(LOG_LINE);
  });
});

describe("shared functions", () => {
  it("usan el cliente compartido y responden con el código genérico si la base falla", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    sharedDb.$transaction.mockImplementation(async () => {
      throw new Error(PG_SECRET);
    });

    expect(await listGroups(USER_ID)).toStrictEqual({ ok: false, code: "SERVICE_UNAVAILABLE" });
    expect(await listGroupPicks(USER_ID)).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(await createGroup(USER_ID, "")).toStrictEqual({ ok: false, code: "INVALID_NAME" });
    expect(await createGroup(USER_ID, "Los del Lolla")).toStrictEqual({
      ok: false,
      code: "SERVICE_UNAVAILABLE",
    });
    expect(await getGroup(USER_ID, "x")).toStrictEqual({ ok: false, code: "NOT_FOUND" });
    expect(await regenerateInvite(USER_ID, "x")).toStrictEqual({ ok: false, code: "NOT_FOUND" });
    expect(await getInvitePreview(USER_ID, "x")).toStrictEqual({
      ok: false,
      code: "INVALID_INVITE",
    });
    expect(await joinGroup(USER_ID, "x")).toStrictEqual({ ok: false, code: "INVALID_INVITE" });
    expect(getDb).toHaveBeenCalled();
    for (const [line] of errors.mock.calls) {
      expect(String(line)).toMatch(
        /^\[groups\] SERVICE_UNAVAILABLE at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    }
    expect(errors).toHaveBeenCalledTimes(3);
  });
});
