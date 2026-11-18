import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearPending,
  clearSnapshot,
  readGroupChoice,
  readPending,
  readSnapshot,
  writeGroupChoice,
  writePending,
  writeSnapshot,
} from "@/components/device-store";
import { groupChoiceKey } from "@/lib/group-picks";
import {
  type DeviceSnapshot,
  pendingKey,
  type PendingSelection,
  SNAPSHOT_KEY,
} from "@/lib/offline-selection";

import { SCHEDULE } from "./schedule-fixture";

afterEach(() => {
  vi.restoreAllMocks();
});

const SNAPSHOT: DeviceSnapshot = {
  version: 1,
  userId: "user-a",
  userName: "Ana",
  schedule: SCHEDULE,
  savedShowIds: ["fri-flow-1800"],
  groups: [
    {
      id: "0b6f3c1e-8a2d-4f7b-9c3e-1d2a3b4c5d6e",
      name: "Los del viernes",
      friends: [{ name: "Ana Pérez", initials: "AP", showIds: ["fri-flow-1800"] }],
    },
  ],
};

function pendingOf(userId: string, showIds: string[]): PendingSelection {
  return { version: 1, userId, showIds, savedAt: "2026-03-13T21:15:00.000Z" };
}

function quotaExceeded(): never {
  throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
}

describe("device-store", () => {
  it("test-device-store-pending-by-user: las pendientes de A y B quedan en claves distintas y clearPending(A) no toca la de B", () => {
    const a = pendingOf("user-a", ["fri-flow-1800"]);
    const b = pendingOf("user-b", ["sat-flow-1800"]);

    expect(writePending(a)).toEqual({ ok: true });
    expect(writePending(b)).toEqual({ ok: true });

    expect(localStorage.getItem(pendingKey("user-a"))).not.toBeNull();
    expect(localStorage.getItem(pendingKey("user-b"))).not.toBeNull();
    expect(readPending("user-a")).toEqual(a);
    expect(readPending("user-b")).toEqual(b);

    expect(clearPending("user-a")).toEqual({ ok: true });

    expect(readPending("user-a")).toBeNull();
    expect(readPending("user-b")).toEqual(b);
  });

  it("test-device-store-persists: lo escrito con writePending se lee igual en una lectura nueva", () => {
    const pending = pendingOf("user-a", ["fri-samsung-1700", "fri-flow-1800"]);
    writePending(pending);

    // A fresh read goes back to storage: the stored JSON is what comes back, not a cached object.
    const stored = localStorage.getItem(pendingKey("user-a"));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "null")).toEqual(pending);
    expect(readPending("user-a")).toEqual(pending);
    expect(readPending("user-a")).not.toBe(readPending("user-a"));
  });

  it("test-device-store-persists: la copia se escribe, se lee y se borra sin tocar las pendientes", () => {
    const pending = pendingOf("user-a", ["fri-flow-1800"]);
    writePending(pending);

    expect(readSnapshot()).toBeNull();
    expect(writeSnapshot(SNAPSHOT)).toEqual({ ok: true });
    expect(localStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();
    expect(readSnapshot()).toEqual(SNAPSHOT);

    expect(clearSnapshot()).toEqual({ ok: true });

    expect(readSnapshot()).toBeNull();
    expect(readPending("user-a")).toEqual(pending);
  });

  it("test-device-store-persists: lo guardado inválido se lee como null", () => {
    writeSnapshot(SNAPSHOT);
    expect(readSnapshot()).toEqual(SNAPSHOT);

    localStorage.setItem(SNAPSHOT_KEY, "{broken");
    localStorage.setItem(pendingKey("user-a"), JSON.stringify(pendingOf("user-b", [])));

    expect(readSnapshot()).toBeNull();
    expect(readPending("user-a")).toBeNull();
  });

  it("test-device-store-unavailable-error: con setItem que lanza QuotaExceededError, las escrituras devuelven STORAGE_UNAVAILABLE", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(quotaExceeded);

    expect(writePending(pendingOf("user-a", ["fri-flow-1800"]))).toEqual({
      ok: false,
      code: "STORAGE_UNAVAILABLE",
    });
    expect(writeSnapshot(SNAPSHOT)).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
  });

  it("test-device-store-unavailable-error: con getItem que lanza, las lecturas devuelven null", () => {
    writePending(pendingOf("user-a", ["fri-flow-1800"]));
    writeSnapshot(SNAPSHOT);
    // Both read back before storage breaks, so the `null` below is the thrown read.
    expect(readPending("user-a")).not.toBeNull();
    expect(readSnapshot()).not.toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    expect(readPending("user-a")).toBeNull();
    expect(readSnapshot()).toBeNull();
  });

  it("test-device-store-unavailable-error: con removeItem que lanza, los borrados devuelven STORAGE_UNAVAILABLE", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    expect(clearPending("user-a")).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
    expect(clearSnapshot()).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
  });
});

describe("device-store y la elección de grupo", () => {
  const GROUP_ID = "0b6f3c1e-8a2d-4f7b-9c3e-1d2a3b4c5d6e";

  it("test-picker-remembers: la elección se guarda con su dueño bajo su clave y se lee igual, también Sin grupo", () => {
    expect(readGroupChoice("user-a")).toBeUndefined();

    expect(writeGroupChoice("user-a", GROUP_ID)).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(groupChoiceKey("user-a")) ?? "null")).toStrictEqual({
      version: 1,
      userId: "user-a",
      groupId: GROUP_ID,
    });
    expect(readGroupChoice("user-a")).toStrictEqual({ groupId: GROUP_ID });

    // "Sin grupo" is a choice too, not "never chose".
    expect(writeGroupChoice("user-a", null)).toEqual({ ok: true });
    expect(readGroupChoice("user-a")).toStrictEqual({ groupId: null });
  });

  it("la elección de otra cuenta no se lee, ni bajo su clave ni copiada bajo la propia (R-05)", () => {
    writeGroupChoice("user-b", GROUP_ID);

    expect(readGroupChoice("user-a")).toBeUndefined();
    expect(readGroupChoice("user-b")).toStrictEqual({ groupId: GROUP_ID });

    // B's value pasted under A's key: the owner inside does not match.
    localStorage.setItem(groupChoiceKey("user-a"), localStorage.getItem(groupChoiceKey("user-b"))!);
    expect(readGroupChoice("user-a")).toBeUndefined();

    localStorage.setItem(groupChoiceKey("user-a"), "{broken");
    expect(readGroupChoice("user-a")).toBeUndefined();
  });

  it("test-store-choice-unavailable: writeGroupChoice con localStorage no disponible devuelve STORAGE_UNAVAILABLE", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(quotaExceeded);

    expect(writeGroupChoice("user-a", GROUP_ID)).toEqual({
      ok: false,
      code: "STORAGE_UNAVAILABLE",
    });
    expect(writeGroupChoice("user-a", null)).toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
  });

  it("con getItem que lanza, la elección se lee como nunca elegida", () => {
    writeGroupChoice("user-a", GROUP_ID);
    expect(readGroupChoice("user-a")).toStrictEqual({ groupId: GROUP_ID });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    expect(readGroupChoice("user-a")).toBeUndefined();
  });
});
