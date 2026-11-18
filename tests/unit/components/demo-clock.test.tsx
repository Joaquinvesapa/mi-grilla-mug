import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  resetDemoClockForTests,
  useAppNow,
  useDemoClockBroadcast,
  useDemoNow,
} from "@/components/demo-clock";
import { DEMO_CLOCK_HELLO, DEMO_CLOCK_MESSAGE } from "@/lib/demo-clock";

// Viernes 13 de marzo de 2026, 23:29:30 en Argentina (UTC-3): la hora "real" de los tests.
const REAL_NOW = Date.parse("2026-03-13T23:29:30-03:00");
// Domingo 15 de marzo de 2026, 23:00: la hora que manda /demo.
const SUNDAY_23_00 = Date.parse("2026-03-15T23:00:00-03:00");
const FRIDAY_22_45 = Date.parse("2026-03-13T22:45:00-03:00");
const OTHER_ORIGIN = "https://otro-origen.example";

type FakeParent = { location: { pathname: string }; postMessage: Mock };

const ORIGINAL_PARENT = Object.getOwnPropertyDescriptor(window, "parent");

function setParent(parent: unknown) {
  Object.defineProperty(window, "parent", { configurable: true, get: () => parent });
}

function demoParent(pathname = "/demo"): FakeParent {
  return { location: { pathname }, postMessage: vi.fn() };
}

/** A parent of another origin: reading its `location` throws, like a real browser does. */
function crossOriginParent() {
  const postMessage = vi.fn();
  return {
    postMessage,
    get location(): never {
      throw new DOMException("Blocked a frame with another origin", "SecurityError");
    },
  };
}

function send(data: unknown, source: unknown, origin = window.location.origin) {
  act(() => {
    // `source` is a fake window: jsdom passes non-wrapper objects through untouched.
    window.dispatchEvent(
      new MessageEvent("message", { data, origin, source: source as MessageEventSource }),
    );
  });
}

function messageListenerCalls(spy: Mock) {
  return spy.mock.calls.filter(([type]) => type === "message");
}

/**
 * Control for the rejection tests: once the previous subscribers are gone, the same flow with a
 * real `/demo` parent does greet and listen, so what rejected the message was the channel itself.
 */
function expectAcceptedFromDemoParent() {
  cleanup();
  const parent = demoParent();
  setParent(parent);
  const { result } = renderHook(() => useDemoNow());
  expect(parent.postMessage).toHaveBeenCalledWith(
    { type: DEMO_CLOCK_HELLO },
    window.location.origin,
  );
  send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent);
  expect(result.current?.getTime()).toBe(SUNDAY_23_00);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(REAL_NOW);
});

afterEach(() => {
  cleanup();
  resetDemoClockForTests();
  if (ORIGINAL_PARENT) {
    Object.defineProperty(window, "parent", ORIGINAL_PARENT);
  } else {
    // `parent` lives on the prototype: dropping the own property restores jsdom's.
    delete (window as { parent?: unknown }).parent;
  }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("demo-clock channel", () => {
  it("demo-clock channel: dentro de /demo, useDemoNow devuelve la hora que manda el padre", () => {
    const parent = demoParent();
    setParent(parent);
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");

    const demo = renderHook(() => useDemoNow());
    const app = renderHook(() => useAppNow(true));
    expect(demo.result.current).toBeNull();
    expect(app.result.current.getTime()).toBe(REAL_NOW);

    // Un solo listener y un solo saludo, aunque haya dos suscriptores.
    expect(messageListenerCalls(addListener)).toHaveLength(1);
    expect(parent.postMessage).toHaveBeenCalledTimes(1);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: DEMO_CLOCK_HELLO },
      window.location.origin,
    );

    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent);
    expect(demo.result.current?.getTime()).toBe(SUNDAY_23_00);
    expect(app.result.current.getTime()).toBe(SUNDAY_23_00);

    // +15 min: llega la hora nueva.
    send({ type: DEMO_CLOCK_MESSAGE, at: FRIDAY_22_45 }, parent);
    expect(demo.result.current?.getTime()).toBe(FRIDAY_22_45);

    // El listener se va con el último suscriptor, y es el mismo que se registró.
    demo.unmount();
    expect(messageListenerCalls(removeListener)).toHaveLength(0);
    app.unmount();
    const [added] = messageListenerCalls(addListener);
    const removed = messageListenerCalls(removeListener);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.[1]).toBe(added?.[1]);

    // El store conserva la última hora entre pantallas.
    const again = renderHook(() => useDemoNow());
    expect(again.result.current?.getTime()).toBe(FRIDAY_22_45);
  });

  it("demo-clock channel: sin frame no registra listener ni manda saludo y useAppNow usa la hora real", () => {
    // jsdom: sin frame, window.parent === window.
    expect(window.parent).toBe(window);
    const addListener = vi.spyOn(window, "addEventListener");
    const postMessage = vi.spyOn(window, "postMessage");

    const demo = renderHook(() => useDemoNow());
    const app = renderHook(() => useAppNow(true));
    expect(messageListenerCalls(addListener)).toHaveLength(0);
    expect(postMessage).not.toHaveBeenCalled();

    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, window);
    expect(demo.result.current).toBeNull();
    expect(app.result.current.getTime()).toBe(REAL_NOW);

    // Sigue siendo useNow: avanza con la hora real.
    act(() => {
      vi.advanceTimersByTime(30_050);
    });
    expect(app.result.current.getTime()).toBe(Date.parse("2026-03-13T23:30:00-03:00") + 50);

    expectAcceptedFromDemoParent();
  });

  it("demo-clock channel: un padre con otra ruta es rechazado", () => {
    const parent = demoParent("/grupos");
    setParent(parent);
    const addListener = vi.spyOn(window, "addEventListener");

    const { result } = renderHook(() => useDemoNow());
    expect(messageListenerCalls(addListener)).toHaveLength(0);
    expect(parent.postMessage).not.toHaveBeenCalled();

    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent);
    expect(result.current).toBeNull();

    expectAcceptedFromDemoParent();
  });

  it("demo-clock channel: un padre de otro origen (location que lanza) es rechazado", () => {
    const parent = crossOriginParent();
    setParent(parent);
    const addListener = vi.spyOn(window, "addEventListener");

    const demo = renderHook(() => useDemoNow());
    const app = renderHook(() => useAppNow(true));
    expect(messageListenerCalls(addListener)).toHaveLength(0);
    expect(parent.postMessage).not.toHaveBeenCalled();

    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent);
    expect(demo.result.current).toBeNull();
    expect(app.result.current.getTime()).toBe(REAL_NOW);

    expectAcceptedFromDemoParent();
  });

  it("demo-clock channel: un mensaje de otra ventana o de otro origen es rechazado", () => {
    const parent = demoParent();
    setParent(parent);
    const { result } = renderHook(() => useDemoNow());

    // Otra ventana (otro frame, un popup), con el mismo origen.
    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, demoParent());
    expect(result.current).toBeNull();
    // Sin ventana de origen.
    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, null);
    expect(result.current).toBeNull();
    // El padre, pero desde otro origen.
    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent, OTHER_ORIGIN);
    expect(result.current).toBeNull();

    // El mismo mensaje del padre y del mismo origen sí pasa.
    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent);
    expect(result.current?.getTime()).toBe(SUNDAY_23_00);
  });

  it("demo-clock channel: un mensaje con forma inválida es rechazado", () => {
    const parent = demoParent();
    setParent(parent);
    const { result } = renderHook(() => useDemoNow());

    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent);
    expect(result.current?.getTime()).toBe(SUNDAY_23_00);

    const invalid: unknown[] = [
      "mi-grilla:demo-clock",
      null,
      { type: DEMO_CLOCK_HELLO },
      { type: "otro", at: FRIDAY_22_45 },
      { type: DEMO_CLOCK_MESSAGE, at: String(FRIDAY_22_45) },
      { type: DEMO_CLOCK_MESSAGE, at: Number.NaN },
      { type: DEMO_CLOCK_MESSAGE, at: Date.parse("2026-03-20T20:00:00-03:00") },
    ];
    for (const data of invalid) {
      send(data, parent);
      expect(result.current?.getTime()).toBe(SUNDAY_23_00);
    }
  });

  it("demo-clock channel: el render del servidor da null aunque el store tenga una hora de /demo", () => {
    const parent = demoParent();
    setParent(parent);
    const { result } = renderHook(() => useDemoNow());
    send({ type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 }, parent);
    // The store does hold a `/demo` time on the client.
    expect(result.current?.getTime()).toBe(SUNDAY_23_00);

    function Probe() {
      const demo = useDemoNow();
      const app = useAppNow(false);
      // One text node: React would put `<!-- -->` between several.
      return <p>{`${demo === null ? "null" : demo.getTime()}|${app.getTime()}`}</p>;
    }

    // On the server `useSyncExternalStore` reads `getServerSnapshot`: no simulated time, the real one.
    const html = renderToString(<Probe />);
    expect(html).toContain(`null|${REAL_NOW}`);
    expect(html).not.toContain(String(SUNDAY_23_00));
  });
});

describe("demo-clock broadcast", () => {
  function mountIframe() {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const target = iframe.contentWindow;
    if (!target) throw new Error("jsdom: el iframe no tiene contentWindow");
    const postMessage = vi.spyOn(target, "postMessage").mockImplementation(() => {});
    const ref: { current: HTMLIFrameElement | null } = { current: iframe };
    return { iframe, target, postMessage, ref };
  }

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("demo-clock broadcast: responde el saludo solo de su iframe y con targetOrigin propio", () => {
    const { target, postMessage, ref } = mountIframe();
    const instant = new Date(SUNDAY_23_00);
    renderHook(() => useDemoClockBroadcast(ref, instant));
    postMessage.mockClear();

    // Saludo de otra ventana.
    send({ type: DEMO_CLOCK_HELLO }, demoParent());
    // Saludo de su iframe, pero de otro origen.
    send({ type: DEMO_CLOCK_HELLO }, target, OTHER_ORIGIN);
    // Otra cosa que no es un saludo, de su iframe.
    send({ type: DEMO_CLOCK_MESSAGE, at: FRIDAY_22_45 }, target);
    send("hola", target);
    expect(postMessage).not.toHaveBeenCalled();

    send({ type: DEMO_CLOCK_HELLO }, target);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      { type: DEMO_CLOCK_MESSAGE, at: SUNDAY_23_00 },
      window.location.origin,
    );
    for (const call of postMessage.mock.calls) {
      expect(call[1]).not.toBe("*");
    }
  });

  it("demo-clock broadcast: reenvía la hora al cambiar y en el onLoad del iframe", () => {
    const { postMessage, ref } = mountIframe();
    const { result, rerender } = renderHook(({ instant }) => useDemoClockBroadcast(ref, instant), {
      initialProps: { instant: new Date(Date.parse("2026-03-13T22:30:00-03:00")) },
    });
    postMessage.mockClear();

    rerender({ instant: new Date(FRIDAY_22_45) });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: DEMO_CLOCK_MESSAGE, at: FRIDAY_22_45 },
      window.location.origin,
    );

    // Un Date nuevo con la misma hora no reenvía.
    rerender({ instant: new Date(FRIDAY_22_45) });
    expect(postMessage).toHaveBeenCalledTimes(1);

    act(() => {
      result.current();
    });
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: DEMO_CLOCK_MESSAGE, at: FRIDAY_22_45 },
      window.location.origin,
    );

    // Sin iframe montado, onLoad no hace nada ni rompe.
    ref.current = null;
    act(() => {
      result.current();
    });
    expect(postMessage).toHaveBeenCalledTimes(2);
  });
});
