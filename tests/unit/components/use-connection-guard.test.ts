import { act, renderHook } from "@testing-library/react";
import { redirect } from "next/navigation";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useConnectionGuard } from "@/components/use-connection-guard";

const OFFLINE = "Necesitás conexión para hacer esto";
const GENERIC = "No pudimos guardar. Probá de nuevo en un rato.";

afterEach(() => {
  vi.restoreAllMocks();
});

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
}

/** A submit event as React hands it to `onSubmit`: only `preventDefault` is read. */
function submitEvent() {
  const preventDefault = vi.fn();
  return { event: { preventDefault } as unknown as FormEvent<HTMLFormElement>, preventDefault };
}

type State = { error: string | null };

describe("useConnectionGuard", () => {
  it("test-guard-offline-blocks: sin conexión onSubmit cancela el envío y deja el aviso", () => {
    setOnline(false);
    const { result } = renderHook(() => useConnectionGuard());
    const { event, preventDefault } = submitEvent();

    act(() => {
      result.current.onSubmit(event);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.message).toBe(OFFLINE);
  });

  it("test-guard-online-clears: con conexión onSubmit no cancela y limpia el aviso", () => {
    setOnline(false);
    const { result } = renderHook(() => useConnectionGuard());
    act(() => {
      result.current.onSubmit(submitEvent().event);
    });
    expect(result.current.message).toBe(OFFLINE);

    setOnline(true);
    const { event, preventDefault } = submitEvent();
    act(() => {
      result.current.onSubmit(event);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(result.current.message).toBeNull();
  });

  it("test-guard-rejected-offline: una acción rechazada sin conexión deja el aviso de conexión", async () => {
    const { result } = renderHook(() => useConnectionGuard());
    const prev: State = { error: null };
    const action = vi.fn(async (_prev: State, _payload: FormData): Promise<State> => {
      setOnline(false);
      throw new TypeError("Failed to fetch");
    });

    let answer: State | undefined;
    await act(async () => {
      answer = await result.current.guard(action)(prev, new FormData());
    });

    expect(answer).toBe(prev);
    expect(result.current.message).toBe(OFFLINE);
  });

  it("test-guard-rejected-online: una acción rechazada con conexión deja el genérico, nunca el mensaje del rechazo", async () => {
    setOnline(true);
    const { result } = renderHook(() => useConnectionGuard());
    const prev: State = { error: "lo anterior" };
    const action = vi.fn(async (): Promise<State> => {
      throw new Error("ECONNRESET 10.0.0.3:5432");
    });

    let answer: State | undefined;
    await act(async () => {
      answer = await result.current.guard(action)(prev, new FormData());
    });

    expect(answer).toBe(prev);
    expect(result.current.message).toBe(GENERIC);
    expect(result.current.message).not.toContain("ECONNRESET");
  });

  it("test-guard-redirect-rethrown: un redirect de Next se relanza y no deja aviso", async () => {
    setOnline(true);
    const { result } = renderHook(() => useConnectionGuard());
    const action = vi.fn(async (): Promise<State> => redirect("/grupos"));

    let thrown: unknown = null;
    await act(async () => {
      try {
        await result.current.guard(action)({ error: null }, new FormData());
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(result.current.message).toBeNull();
  });

  it("guard devuelve lo que responde la acción cuando no se rechaza", async () => {
    setOnline(true);
    const { result } = renderHook(() => useConnectionGuard());
    const next: State = { error: "Ya estás en 10 grupos, el máximo." };

    let answer: State | undefined;
    await act(async () => {
      answer = await result.current.guard(async (_prev: State, _payload: FormData) => next)(
        { error: null },
        new FormData(),
      );
    });

    expect(answer).toBe(next);
    expect(result.current.message).toBeNull();
  });
});
