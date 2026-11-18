import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { useNow } from "@/components/use-now";

// Viernes 13 de marzo de 2026, 23:29:30 en Argentina (UTC-3).
const FRIDAY_23_29_30 = Date.parse("2026-03-13T23:29:30-03:00");
const FRIDAY_23_30 = Date.parse("2026-03-13T23:30:00-03:00");

let visibility: DocumentVisibilityState = "visible";

function setVisibility(value: DocumentVisibilityState) {
  visibility = value;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FRIDAY_23_29_30);
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("useNow", () => {
  it("use-now: con el panel abierto, de 23:29:30 a 23:30 se actualiza en ≤ 60 s", () => {
    const { result } = renderHook(() => useNow(true));
    expect(result.current.getTime()).toBe(FRIDAY_23_29_30);

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current.getTime()).toBe(FRIDAY_23_29_30);

    act(() => {
      vi.advanceTimersByTime(1_000 + 50);
    });
    expect(result.current.getTime()).toBeGreaterThanOrEqual(FRIDAY_23_30);
    expect(result.current.getTime()).toBeLessThan(FRIDAY_23_30 + 60_000);
    expect(new Date(result.current).getUTCMinutes()).toBe(30);

    // Re-agenda: un minuto después vuelve a cambiar.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.getTime()).toBeGreaterThanOrEqual(FRIDAY_23_30 + 60_000);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("use-now: agenda al minuto siguiente con 50 ms de margen", () => {
    const { result } = renderHook(() => useNow(true));
    act(() => {
      vi.advanceTimersByTime(30_049);
    });
    expect(result.current.getTime()).toBe(FRIDAY_23_29_30);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.getTime()).toBe(FRIDAY_23_30 + 50);
  });

  it("use-now: al activarse relee la hora", () => {
    const { result, rerender } = renderHook(({ active }) => useNow(active), {
      initialProps: { active: false },
    });
    vi.setSystemTime(FRIDAY_23_30 + 5_000);
    rerender({ active: true });
    expect(result.current.getTime()).toBe(FRIDAY_23_30 + 5_000);
  });

  it("use-now: inactivo no agenda temporizadores", () => {
    const addListener = vi.spyOn(document, "addEventListener");
    const { result } = renderHook(() => useNow(false));
    expect(result.current.getTime()).toBe(FRIDAY_23_29_30);
    expect(vi.getTimerCount()).toBe(0);
    expect(addListener.mock.calls.some(([type]) => type === "visibilitychange")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(result.current.getTime()).toBe(FRIDAY_23_29_30);
  });

  it("use-now: al desactivar o desmontar no quedan temporizadores", () => {
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = renderHook(({ active }) => useNow(active), {
      initialProps: { active: true },
    });
    expect(vi.getTimerCount()).toBe(1);

    rerender({ active: false });
    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true);

    rerender({ active: true });
    expect(vi.getTimerCount()).toBe(1);

    removeListener.mockClear();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeListener.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true);

    // Se sacó el mismo listener: volver visible ya no agenda nada.
    act(() => {
      setVisibility("visible");
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("use-now: al volver visible relee la hora", () => {
    const { result } = renderHook(() => useNow(true));

    // El temporizador no corrió (el sistema lo suspendió) pero el reloj avanzó.
    vi.setSystemTime(FRIDAY_23_30 + 10 * 60_000);
    act(() => {
      setVisibility("hidden");
    });
    expect(result.current.getTime()).toBe(FRIDAY_23_29_30);

    act(() => {
      setVisibility("visible");
    });
    expect(result.current.getTime()).toBe(FRIDAY_23_30 + 10 * 60_000);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("use-now: la misma hora devuelve el mismo Date entre renders", () => {
    const { result, rerender } = renderHook(() => useNow(true));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("use-now: solo la hora real, sin forma de cambiarla", () => {
    // El hook solo recibe si está activo: no hay parámetro para otra hora.
    expectTypeOf(useNow).parameters.toEqualTypeOf<[boolean]>();

    // Ni la URL ni el almacenamiento del navegador la cambian.
    window.history.replaceState(null, "", "/?now=2026-03-14T20:00:00-03:00&clock=demo");
    window.localStorage.setItem("now", "2026-03-14T20:00:00-03:00");
    window.localStorage.setItem("simulatedClock", "2026-03-14T20:00:00-03:00");

    const { result } = renderHook(() => useNow(true));
    expect(result.current).toBeInstanceOf(Date);
    expect(result.current.getTime()).toBe(Date.now());
    expect(result.current.getTime()).toBe(FRIDAY_23_29_30);
  });
});
