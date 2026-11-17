import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ForgetDeviceCopy } from "@/components/forget-device-copy";
import { pendingKey, SNAPSHOT_KEY } from "@/lib/offline-selection";

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
});
