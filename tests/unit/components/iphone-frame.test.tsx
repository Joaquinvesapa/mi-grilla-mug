import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeFrameScale,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  IphoneFrame,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from "@/components/iphone-frame";

describe("computeFrameScale", () => {
  it("con 800 px disponibles escala a menos de 1 y el marco entra", () => {
    const scale = computeFrameScale(800, FRAME_HEIGHT);

    expect(FRAME_HEIGHT).toBeGreaterThan(800);
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0);
    expect(FRAME_HEIGHT * scale).toBeLessThanOrEqual(800);
  });

  it("con 1200 px disponibles la escala es 1 (nunca agranda)", () => {
    expect(computeFrameScale(1200, FRAME_HEIGHT)).toBe(1);
  });

  it("con exactamente la altura del marco la escala es 1", () => {
    expect(computeFrameScale(FRAME_HEIGHT, FRAME_HEIGHT)).toBe(1);
  });

  it.each([0, -1, -800, Number.NaN, Number.NEGATIVE_INFINITY])(
    "una altura disponible inválida (%s) devuelve 1 sin error",
    (available) => {
      expect(() => computeFrameScale(available, FRAME_HEIGHT)).not.toThrow();
      expect(computeFrameScale(available, FRAME_HEIGHT)).toBe(1);
    },
  );

  it.each([0, -852, Number.NaN])("una altura de marco inválida (%s) devuelve 1", (frame) => {
    expect(computeFrameScale(800, frame)).toBe(1);
  });
});

type ObserverCallback = (entries: { contentRect: { height: number } }[]) => void;

describe("IphoneFrame", () => {
  const observers: { callback: ObserverCallback; observed: Element[]; disconnected: boolean }[] =
    [];

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        private readonly record;
        constructor(callback: ObserverCallback) {
          this.record = { callback, observed: [] as Element[], disconnected: false };
          observers.push(this.record);
        }
        observe(target: Element) {
          this.record.observed.push(target);
        }
        unobserve() {}
        disconnect() {
          this.record.disconnected = true;
        }
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    observers.length = 0;
  });

  function resize(height: number) {
    const observer = observers.at(-1);
    expect(observer, "no se creó un ResizeObserver").toBeDefined();
    act(() => observer!.callback([{ contentRect: { height } }]));
  }

  function scaledFrame(): HTMLElement {
    return screen.getByTestId("iphone-frame");
  }

  function cssNumber(value: string): number {
    const match = /-?\d+(\.\d+)?/.exec(value);
    expect(match, `"${value}" no tiene un número`).not.toBeNull();
    return Number(match![0]);
  }

  it("embebe / en un iframe de 393 × 852 con el título Mi Grilla y sin allow", () => {
    render(<IphoneFrame />);

    const iframe = screen.getByTitle("Mi Grilla");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("src")).toBe("/");
    expect(iframe.getAttribute("width")).toBe(String(SCREEN_WIDTH));
    expect(iframe.getAttribute("height")).toBe(String(SCREEN_HEIGHT));
    expect([SCREEN_WIDTH, SCREEN_HEIGHT]).toEqual([393, 852]);
    expect(iframe.hasAttribute("allow")).toBe(false);
  });

  it("arranca en escala 1 y escala con la altura que informa el ResizeObserver", () => {
    render(<IphoneFrame />);
    expect(scaledFrame().style.transform).toBe("scale(1)");

    resize(700);

    const expected = computeFrameScale(700, FRAME_HEIGHT);
    expect(expected).toBeLessThan(1);
    // jsdom serializes CSS numbers to 6 decimals.
    expect(cssNumber(scaledFrame().style.transform)).toBeCloseTo(expected, 5);
    // The layout box takes the scaled size, so nothing overflows the page.
    const box = scaledFrame().parentElement!;
    expect(cssNumber(box.style.width)).toBeCloseTo(FRAME_WIDTH * expected, 3);
    expect(cssNumber(box.style.height)).toBeCloseTo(FRAME_HEIGHT * expected, 3);
  });

  it("con altura 0 (antes del primer layout) se queda en escala 1 sin error", () => {
    render(<IphoneFrame />);

    expect(() => resize(0)).not.toThrow();
    expect(scaledFrame().style.transform).toBe("scale(1)");

    resize(5000);
    expect(scaledFrame().style.transform).toBe("scale(1)");
  });

  it("deja de observar al desmontarse", () => {
    const { unmount } = render(<IphoneFrame />);
    const observer = observers.at(-1);
    expect(observer, "no se creó un ResizeObserver").toBeDefined();
    expect(observer!.observed).toHaveLength(1);

    unmount();

    expect(observer!.disconnected).toBe(true);
  });

  it("la pantalla es concéntrica al marco: su radio es el exterior menos el bisel", () => {
    render(<IphoneFrame />);

    const outer = scaledFrame();
    const screenBox = screen.getByTitle("Mi Grilla").parentElement!;
    const outerRadius = cssNumber(outer.style.borderRadius);
    const bezel = cssNumber(outer.style.padding);

    expect(outerRadius).toBeGreaterThan(bezel);
    expect(cssNumber(screenBox.style.borderRadius)).toBe(outerRadius - bezel);
  });

  it("iphone-frame: pasa iframeRef y onIframeLoad al iframe", () => {
    const iframeRef = createRef<HTMLIFrameElement>();
    const onIframeLoad = vi.fn();
    render(<IphoneFrame iframeRef={iframeRef} onIframeLoad={onIframeLoad} />);

    const iframe = screen.getByTitle("Mi Grilla");
    expect(iframeRef.current).toBe(iframe);
    expect(onIframeLoad).not.toHaveBeenCalled();

    fireEvent.load(iframe);

    expect(onIframeLoad).toHaveBeenCalledTimes(1);
  });

  it("sin iframeRef ni onIframeLoad el iframe carga sin error", () => {
    render(<IphoneFrame />);

    expect(() => fireEvent.load(screen.getByTitle("Mi Grilla"))).not.toThrow();
  });
});
