import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { readSnapshot, writeSnapshot } from "@/components/device-store";
import { ForgetDeviceCopy } from "@/components/forget-device-copy";
import { groupChoiceKey } from "@/lib/group-picks";
import { pendingKey, SNAPSHOT_KEY } from "@/lib/offline-selection";

import { SCHEDULE } from "./schedule-fixture";

afterEach(cleanup);

describe("ForgetDeviceCopy", () => {
  it("test-forget-device-copy: al montar borra la copia del dispositivo y conserva las pendientes", () => {
    localStorage.setItem(SNAPSHOT_KEY, "{}");
    localStorage.setItem(pendingKey("user-a"), "pending-a");

    const { container } = render(<ForgetDeviceCopy />);

    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
    expect(localStorage.getItem(pendingKey("user-a"))).toBe("pending-a");
  });

  it("test-logout-clears-groups: /login borra la copia con los grupos de los amigos y conserva la elección de grupo (R-03, ADR-008)", () => {
    const groupId = "11111111-1111-4111-8111-111111111111";
    const choice = JSON.stringify({ version: 1, userId: "user-a", groupId });
    writeSnapshot({
      version: 1,
      userId: "user-a",
      userName: "Ana",
      schedule: SCHEDULE,
      savedShowIds: [],
      groups: [
        {
          id: groupId,
          name: "Los del colegio",
          friends: [{ name: "Beto Gómez", initials: "BG", showIds: ["fri-flow-1800"] }],
        },
      ],
    });
    localStorage.setItem(groupChoiceKey("user-a"), choice);
    // Guard: the copy is a valid one, groups included.
    expect(readSnapshot()?.groups).toHaveLength(1);

    render(<ForgetDeviceCopy />);

    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
    expect(readSnapshot()).toBeNull();
    expect(localStorage.getItem(groupChoiceKey("user-a"))).toBe(choice);
  });
});
