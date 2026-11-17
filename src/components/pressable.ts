"use client";

import { useState, type PointerEventHandler } from "react";

export type PressHandlers<T extends Element> = {
  onPointerDown?: PointerEventHandler<T>;
  onPointerUp?: PointerEventHandler<T>;
  onPointerCancel?: PointerEventHandler<T>;
  onPointerLeave?: PointerEventHandler<T>;
};

export type PressedProps<T extends Element> = Required<PressHandlers<T>> & {
  "data-pressed": "true" | undefined;
};

/**
 * Touch feedback that does not depend on `:active`, which iOS Safari only applies to elements
 * with a touch listener and only after a delay. `data-pressed="true"` is set on `pointerdown`, the
 * moment the finger lands, and removed on `pointerup`, `pointercancel` (the touch became a scroll
 * or was interrupted) and `pointerleave`. Spread the result on the element; the caller's own
 * pointer handlers are passed in and still run.
 */
export function usePressed<T extends Element>({
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  onPointerLeave,
}: PressHandlers<T> = {}): PressedProps<T> {
  const [pressed, setPressed] = useState(false);

  return {
    "data-pressed": pressed ? "true" : undefined,
    onPointerDown: (event) => {
      onPointerDown?.(event);
      setPressed(true);
    },
    onPointerUp: (event) => {
      onPointerUp?.(event);
      setPressed(false);
    },
    onPointerCancel: (event) => {
      onPointerCancel?.(event);
      setPressed(false);
    },
    onPointerLeave: (event) => {
      onPointerLeave?.(event);
      setPressed(false);
    },
  };
}
