import { describe, expect, it } from "vitest";

import {
  type DeviceSnapshot,
  parsePending,
  parseSnapshot,
  pendingKey,
  type PendingSelection,
  SNAPSHOT_KEY,
} from "@/lib/offline-selection";

import { SCHEDULE } from "../components/schedule-fixture";

const SNAPSHOT: DeviceSnapshot = {
  version: 1,
  userId: "user-a",
  userName: "Ana",
  schedule: SCHEDULE,
  savedShowIds: ["fri-flow-1800", "sat-flow-1800"],
  groups: [
    {
      id: "0b6f3c1e-8a2d-4f7b-9c3e-1d2a3b4c5d6e",
      name: "Los del viernes",
      friends: [
        { name: "Ana Pérez", initials: "AP", showIds: ["fri-flow-1800", "fri-samsung-1700"] },
        { name: "Bruno", initials: "BR", showIds: [] },
      ],
    },
  ],
};

const PENDING: PendingSelection = {
  version: 1,
  userId: "user-a",
  showIds: ["fri-samsung-1700", "fri-flow-1800"],
  savedAt: "2026-03-13T21:15:00.000Z",
};

/** The snapshot serialized with `overrides` applied on top. */
function snapshotWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...SNAPSHOT, ...overrides });
}

function pendingWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({ ...PENDING, ...overrides });
}

describe("keys", () => {
  it("la copia vive en una sola clave y la pendiente en una por usuario", () => {
    expect(SNAPSHOT_KEY).toBe("mi-grilla:snapshot");
    expect(pendingKey("user-a")).toBe("mi-grilla:pending:user-a");
    expect(pendingKey("user-b")).not.toBe(pendingKey("user-a"));
  });
});

describe("parseSnapshot", () => {
  it("test-offline-snapshot-roundtrip: una copia válida serializada vuelve igual", () => {
    expect(parseSnapshot(JSON.stringify(SNAPSHOT))).toEqual(SNAPSHOT);
  });

  it("test-offline-snapshot-roundtrip: una copia sin shows elegidos también vuelve igual", () => {
    const empty = { ...SNAPSHOT, savedShowIds: [] };
    expect(parseSnapshot(JSON.stringify(empty))).toEqual(empty);
  });

  it("test-snapshot-groups-roundtrip: parseSnapshot conserva groups y una copia sin groups da []", () => {
    const parsed = parseSnapshot(JSON.stringify(SNAPSHOT));
    expect(parsed?.groups).toEqual(SNAPSHOT.groups);
    expect(parseSnapshot(snapshotWith({ groups: undefined }))).toEqual({ ...SNAPSHOT, groups: [] });
  });

  const group = SNAPSHOT.groups[0];
  const friend = group?.friends[0];
  it.each([
    ["un show desconocido", [{ ...group, friends: [{ ...friend, showIds: ["fri-flow-0000"] }] }]],
    ["más de 10 grupos", Array.from({ length: 11 }, () => group)],
    ["un nombre faltante", [{ ...group, name: undefined }]],
    ["un valor que no es arreglo", "grupos"],
  ])(
    "test-snapshot-groups-invalid: groups con %s se descartan y la copia sigue valiendo",
    (_case, groups) => {
      expect(parseSnapshot(snapshotWith({ groups }))).toEqual({ ...SNAPSHOT, groups: [] });
    },
  );

  it.each([
    ["nada guardado", null],
    ["JSON inválido", "{not json"],
    ["un JSON que no es objeto", "[]"],
    ["version 2", snapshotWith({ version: 2 })],
    ["sin version", snapshotWith({ version: undefined })],
    ["un id con mayúsculas", snapshotWith({ savedShowIds: ["FRI-flow-1800"] })],
    ["un id repetido", snapshotWith({ savedShowIds: ["fri-flow-1800", "fri-flow-1800"] })],
    ["un id fuera de la grilla", snapshotWith({ savedShowIds: ["fri-flow-0000"] })],
    ["un id de 65 caracteres", snapshotWith({ savedShowIds: ["a".repeat(65)] })],
    ["un id que no es string", snapshotWith({ savedShowIds: [42] })],
    ["savedShowIds que no es arreglo", snapshotWith({ savedShowIds: "fri-flow-1800" })],
    ["userId vacío", snapshotWith({ userId: "" })],
    ["userId de 65 caracteres", snapshotWith({ userId: "u".repeat(65) })],
    ["userName vacío", snapshotWith({ userName: "" })],
    ["userName de 101 caracteres", snapshotWith({ userName: "n".repeat(101) })],
    ["sin schedule", snapshotWith({ schedule: undefined })],
    ["schedule sin días", snapshotWith({ schedule: { ...SCHEDULE, days: [] } })],
    ["schedule sin escenarios", snapshotWith({ schedule: { ...SCHEDULE, stages: [] } })],
    ["schedule sin shows", snapshotWith({ schedule: { ...SCHEDULE, shows: [] } })],
    [
      "un show sin id",
      snapshotWith({ schedule: { ...SCHEDULE, shows: [{ ...SCHEDULE.shows[0], id: 7 }] } }),
    ],
  ])("test-offline-snapshot-invalid: %s da null", (_case, raw) => {
    // The valid copy parses, so the `null` below comes from the one field this case breaks.
    expect(parseSnapshot(JSON.stringify(SNAPSHOT))).not.toBeNull();
    expect(parseSnapshot(raw)).toBeNull();
  });
});

describe("parsePending", () => {
  it("una pendiente válida de su dueño vuelve igual", () => {
    expect(parsePending(JSON.stringify(PENDING), "user-a")).toEqual(PENDING);
  });

  it("test-offline-pending-other-user-rejected: la pendiente de user-a leída como user-b da null", () => {
    const raw = JSON.stringify(PENDING);
    expect(parsePending(raw, "user-a")).toEqual(PENDING);
    expect(parsePending(raw, "user-b")).toBeNull();
  });

  it.each([
    ["nada guardado", null],
    ["JSON inválido", "nope"],
    ["version 2", pendingWith({ version: 2 })],
    ["un id con mayúsculas", pendingWith({ showIds: ["Fri-flow-1800"] })],
    ["un id repetido", pendingWith({ showIds: ["fri-flow-1800", "fri-flow-1800"] })],
    ["un id de 65 caracteres", pendingWith({ showIds: ["a".repeat(65)] })],
    ["showIds que no es arreglo", pendingWith({ showIds: null })],
    ["userId vacío", pendingWith({ userId: "" })],
    ["savedAt que no es fecha", pendingWith({ savedAt: "ayer" })],
    ["savedAt imposible", pendingWith({ savedAt: "2026-13-45T99:00:00.000Z" })],
    ["savedAt ausente", pendingWith({ savedAt: undefined })],
  ])("test-offline-snapshot-invalid: una pendiente con %s da null", (_case, raw) => {
    expect(parsePending(JSON.stringify(PENDING), "user-a")).not.toBeNull();
    expect(parsePending(raw, "user-a")).toBeNull();
  });
});
