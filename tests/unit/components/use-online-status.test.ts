import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOnlineStatus } from "@/components/use-online-status";

afterEach(() => {
  vi.restoreAllMocks();
});

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

describe("useOnlineStatus", () => {
  it("test-online-status: refleja navigator.onLine y cambia con offline y online", () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("arranca sin conexión si navigator.onLine ya es falso", () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("en el servidor se asume con conexión", () => {
    setOnline(false);
    function Probe() {
      return createElement("span", null, useOnlineStatus() ? "online" : "offline");
    }
    expect(renderToString(createElement(Probe))).toContain("online");
  });
});
