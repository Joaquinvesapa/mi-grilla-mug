import { createElement, type PointerEvent as ReactPointerEvent } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePressed, type PressHandlers } from "@/components/pressable";

function PressTarget(props: PressHandlers<HTMLButtonElement>) {
  const pressed = usePressed<HTMLButtonElement>(props);
  return createElement("button", { type: "button", ...pressed }, "Tocar");
}

function renderTarget(props: PressHandlers<HTMLButtonElement> = {}) {
  render(createElement(PressTarget, props));
  return screen.getByRole("button", { name: "Tocar" });
}

afterEach(cleanup);

describe("usePressed", () => {
  it('sets data-pressed="true" on pointerdown', () => {
    const button = renderTarget();
    expect(button).not.toHaveAttribute("data-pressed");

    fireEvent.pointerDown(button);

    expect(button).toHaveAttribute("data-pressed", "true");
  });

  it("removes data-pressed on pointerup", () => {
    const button = renderTarget();

    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-pressed", "true");
    fireEvent.pointerUp(button);

    expect(button).not.toHaveAttribute("data-pressed");
  });

  it("removes data-pressed on pointercancel (cancelled touch) without throwing", () => {
    const button = renderTarget();

    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-pressed", "true");
    expect(() => fireEvent.pointerCancel(button)).not.toThrow();

    expect(button).not.toHaveAttribute("data-pressed");
  });

  it("removes data-pressed on pointerleave", () => {
    const button = renderTarget();

    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-pressed", "true");
    fireEvent.pointerLeave(button);

    expect(button).not.toHaveAttribute("data-pressed");
  });

  it("survives a stray pointercancel before any press and still reacts to the next one", () => {
    const button = renderTarget();

    expect(() => fireEvent.pointerCancel(button)).not.toThrow();
    expect(button).not.toHaveAttribute("data-pressed");

    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute("data-pressed", "true");
  });

  it("still calls the handlers the caller passed in", () => {
    const onPointerDown = vi.fn<(event: ReactPointerEvent<HTMLButtonElement>) => void>();
    const onPointerUp = vi.fn<(event: ReactPointerEvent<HTMLButtonElement>) => void>();
    const onPointerCancel = vi.fn<(event: ReactPointerEvent<HTMLButtonElement>) => void>();
    const onPointerLeave = vi.fn<(event: ReactPointerEvent<HTMLButtonElement>) => void>();
    const button = renderTarget({ onPointerDown, onPointerUp, onPointerCancel, onPointerLeave });

    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    fireEvent.pointerCancel(button);
    fireEvent.pointerLeave(button);

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
    expect(onPointerCancel).toHaveBeenCalledTimes(1);
    expect(onPointerLeave).toHaveBeenCalledTimes(1);
  });
});
