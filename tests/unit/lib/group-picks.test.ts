import { describe, expect, it } from "vitest";

import {
  type FriendPicks,
  GROUP_CHOICE_KEY_PREFIX,
  groupChoiceKey,
  type GroupPicks,
  groupPicksOf,
  indicatorParts,
  parseGroupChoice,
  picksByShow,
  resolveGroupChoice,
} from "@/lib/group-picks";

const GROUP_A = "0b6f3c1e-8a2d-4f7b-9c3e-1d2a3b4c5d6e";
const GROUP_B = "1c7a4d2f-9b3e-4a8c-8d4f-2e3b4c5d6e7f";
const GROUP_GONE = "2d8b5e3a-0c4f-4b9d-ae5a-3f4c5d6e7f80";

const ANA: FriendPicks = { name: "Ana Pérez", initials: "AP", showIds: ["s1", "s2"] };
const BRUNO: FriendPicks = { name: "Bruno", initials: "BR", showIds: ["s2"] };
const CARLA: FriendPicks = { name: "Carla Díaz", initials: "CD", showIds: [] };

const GROUPS: GroupPicks[] = [
  { id: GROUP_A, name: "Los del viernes", friends: [ANA, BRUNO, CARLA] },
  { id: GROUP_B, name: "Trabajo", friends: [] },
];

const KNOWN = new Set(["s1", "s2", "s3"]);

function friend(name: string): FriendPicks {
  return { name, initials: name.slice(0, 2).toUpperCase(), showIds: [] };
}

describe("picksByShow", () => {
  it("test-picks-by-show: arma, por show, los amigos que lo eligieron en orden de unión", () => {
    const map = picksByShow(GROUPS[0]);
    expect(map.get("s1")).toEqual([ANA]);
    expect(map.get("s2")).toEqual([ANA, BRUNO]);
    expect(map.has("s3")).toBe(false);
    expect(map.size).toBe(2);
  });

  it("test-picks-none: sin grupo devuelve un mapa vacío", () => {
    expect(picksByShow(undefined).size).toBe(0);
    expect(picksByShow(GROUPS[1]).size).toBe(0);
  });
});

describe("indicatorParts", () => {
  it("test-indicator-parts: con 5 amigos da 3 iniciales y extra 2; con 3, extra 0", () => {
    const five = [ANA, BRUNO, CARLA, friend("Dani"), friend("Eva")];
    expect(indicatorParts(five)).toEqual({ initials: ["AP", "BR", "CD"], extra: 2 });
    expect(indicatorParts([ANA, BRUNO, CARLA])).toEqual({
      initials: ["AP", "BR", "CD"],
      extra: 0,
    });
    expect(indicatorParts([BRUNO])).toEqual({ initials: ["BR"], extra: 0 });
    expect(indicatorParts([])).toEqual({ initials: [], extra: 0 });
  });
});

describe("resolveGroupChoice", () => {
  it('test-resolve-choice: respeta la elección guardada, "Sin grupo" y, sin elección, el grupo más reciente', () => {
    expect(resolveGroupChoice(GROUPS, { groupId: GROUP_B })).toBe(GROUP_B);
    expect(resolveGroupChoice(GROUPS, { groupId: null })).toBeNull();
    expect(resolveGroupChoice(GROUPS, undefined)).toBe(GROUP_A);
    expect(resolveGroupChoice([], undefined)).toBeUndefined();
    expect(resolveGroupChoice([], { groupId: null })).toBeUndefined();
    expect(resolveGroupChoice([], { groupId: GROUP_A })).toBeUndefined();
  });

  it("test-resolve-choice-stale: una elección de un grupo que ya no está es rechazada y se usa el más reciente", () => {
    expect(resolveGroupChoice(GROUPS, { groupId: GROUP_GONE })).toBe(GROUP_A);
  });
});

describe("parseGroupChoice", () => {
  const valid = (overrides: Record<string, unknown> = {}): string =>
    JSON.stringify({ version: 1, userId: "user-a", groupId: GROUP_A, ...overrides });

  it("la clave es por usuario", () => {
    expect(GROUP_CHOICE_KEY_PREFIX).toBe("mi-grilla:group-choice:");
    expect(groupChoiceKey("user-a")).toBe("mi-grilla:group-choice:user-a");
    expect(groupChoiceKey("user-b")).not.toBe(groupChoiceKey("user-a"));
  });

  it("una elección válida de su dueño vuelve con su groupId, también null", () => {
    expect(parseGroupChoice(valid(), "user-a")).toEqual({ groupId: GROUP_A });
    expect(parseGroupChoice(valid({ groupId: null }), "user-a")).toEqual({ groupId: null });
  });

  it.each([
    ["nada guardado", null],
    ["JSON inválido", "{nope"],
    ["un JSON que no es objeto", "[]"],
    ["version 2", valid({ version: 2 })],
    ["sin version", valid({ version: undefined })],
    ["otro userId", valid({ userId: "user-b" })],
    ["userId ausente", valid({ userId: undefined })],
    ["un groupId que no es un UUID", valid({ groupId: "grupo-1" })],
    ["un groupId en mayúsculas", valid({ groupId: GROUP_A.toUpperCase() })],
    ["groupId ausente", valid({ groupId: undefined })],
    ["un groupId que no es string", valid({ groupId: 7 })],
  ])("test-parse-choice-invalid: %s devuelve undefined", (_case, raw) => {
    expect(parseGroupChoice(valid(), "user-a")).toBeDefined();
    expect(parseGroupChoice(raw, "user-a")).toBeUndefined();
  });

  it("test-parse-choice-invalid: un userId pedido de más de 64 caracteres devuelve undefined", () => {
    const long = "u".repeat(65);
    expect(parseGroupChoice(valid({ userId: long }), long)).toBeUndefined();
  });
});

describe("groupPicksOf", () => {
  it("devuelve los grupos válidos tal cual", () => {
    expect(groupPicksOf(GROUPS, KNOWN)).toEqual(GROUPS);
    expect(groupPicksOf([], KNOWN)).toEqual([]);
  });

  it("acepta los límites exactos", () => {
    const groups = Array.from({ length: 10 }, (_unused, index) => ({
      id: `${index}b6f3c1e-8a2d-4f7b-9c3e-1d2a3b4c5d6e`,
      name: "ñ".repeat(39) + "😀",
      friends: Array.from({ length: 19 }, () => ({
        name: "n".repeat(100),
        initials: "👍🏽👍🏽AB",
        showIds: ["s1"],
      })),
    }));
    expect(groupPicksOf(groups, KNOWN)).toEqual(groups);
    const noInitials = [{ ...GROUPS[1], friends: [{ ...ANA, initials: "" }] }];
    expect(groupPicksOf(noInitials, KNOWN)).toEqual(noInitials);
  });

  const withGroup = (overrides: Record<string, unknown>): unknown => [
    { ...GROUPS[0], ...overrides },
  ];
  const withFriend = (overrides: Record<string, unknown>): unknown =>
    withGroup({ friends: [{ ...ANA, ...overrides }] });

  it.each([
    ["no es arreglo", { groups: GROUPS }],
    ["null", null],
    ["11 grupos", Array.from({ length: 11 }, () => GROUPS[1])],
    ["un grupo que no es objeto", ["grupo"]],
    ["un id que no es UUID", withGroup({ id: "grupo-1" })],
    ["sin nombre", withGroup({ name: undefined })],
    ["un nombre vacío", withGroup({ name: "" })],
    ["un nombre de 41 puntos de código", withGroup({ name: "ñ".repeat(40) + "😀" })],
    ["un nombre enorme", withGroup({ name: "n".repeat(1_000_000) })],
    ["un id de grupo repetido", [GROUPS[0], { ...GROUPS[1], id: GROUP_A }]],
    ["friends que no es arreglo", withGroup({ friends: null })],
    ["20 amigos", withGroup({ friends: Array.from({ length: 20 }, () => BRUNO) })],
    ["un amigo que no es objeto", withGroup({ friends: [7] })],
    ["un amigo sin nombre", withFriend({ name: "" })],
    ["un amigo con un nombre de 101 caracteres", withFriend({ name: "n".repeat(101) })],
    ["iniciales que no son string", withFriend({ initials: null })],
    ["iniciales de 5 graphemes", withFriend({ initials: "ABCDE" })],
    ["showIds que no es arreglo", withFriend({ showIds: "s1" })],
    ["un show desconocido", withFriend({ showIds: ["s1", "s9"] })],
    ["un show repetido", withFriend({ showIds: ["s1", "s1"] })],
    ["un show que no es string", withFriend({ showIds: [1] })],
  ])("test-snapshot-groups-invalid: %s da []", (_case, value) => {
    expect(groupPicksOf(GROUPS, KNOWN)).not.toEqual([]);
    expect(groupPicksOf(value, KNOWN)).toEqual([]);
  });

  it("test-snapshot-groups-invalid: un solo grupo inválido descarta todos, no una parte", () => {
    const value = [GROUPS[0], { ...GROUPS[1], id: "x" }];
    expect(groupPicksOf(value, KNOWN)).toEqual([]);
  });

  it("no devuelve campos de más que vinieran guardados", () => {
    const value = [{ ...GROUPS[1], extra: 1, friends: [{ ...BRUNO, userId: "u-1" }] }];
    expect(groupPicksOf(value, KNOWN)).toEqual([{ ...GROUPS[1], friends: [BRUNO] }]);
  });
});
