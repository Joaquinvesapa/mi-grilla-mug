"use client";

import { useEffect, useRef, useState, type Ref } from "react";

/** iPhone 15 screen, in CSS px: the size the app is laid out at inside the frame. */
export const SCREEN_WIDTH = 393;
export const SCREEN_HEIGHT = 852;

const BEZEL = 12;
/** Corner radius of the phone body. The screen's is this minus the bezel, so both stay concentric. */
const OUTER_RADIUS = 67;
const SCREEN_RADIUS = OUTER_RADIUS - BEZEL;

/** The whole phone, bezel included, before scaling. */
export const FRAME_WIDTH = SCREEN_WIDTH + BEZEL * 2;
export const FRAME_HEIGHT = SCREEN_HEIGHT + BEZEL * 2;

/**
 * How much the phone shrinks to fit `availableHeight`. Never above 1: the frame is shown at real
 * size or smaller, never blown up. A height that is not a positive number (0 before the first
 * layout, a negative or NaN value) leaves it at 1; the next resize computes it again.
 */
export function computeFrameScale(availableHeight: number, frameHeight: number): number {
  if (!(availableHeight > 0) || !(frameHeight > 0) || !Number.isFinite(frameHeight)) return 1;
  return Math.min(1, availableHeight / frameHeight);
}

export type IphoneFrameProps = {
  /** The app's iframe, for `/demo` to post its clock to (FEAT-005b, ADR-007). */
  iframeRef?: Ref<HTMLIFrameElement>;
  /** Called when the app's iframe loads. */
  onIframeLoad?: () => void;
};

/**
 * The app running inside a CSS iPhone: bezel, Dynamic Island and the real app in an iframe of the
 * iPhone 15 screen size. It fills the space its parent gives it and scales down to fit its height.
 */
export function IphoneFrame({ iframeRef, onIframeLoad }: IphoneFrameProps = {}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setScale(computeFrameScale(height, FRAME_HEIGHT));
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={areaRef}
      className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden"
    >
      {/* Takes the scaled size in the layout: a transform alone would leave the full-size box. */}
      <div style={{ width: `${FRAME_WIDTH * scale}px`, height: `${FRAME_HEIGHT * scale}px` }}>
        <div
          data-testid="iphone-frame"
          className="relative bg-black shadow-2xl ring-1 ring-rp-highlight-high"
          style={{
            width: `${FRAME_WIDTH}px`,
            height: `${FRAME_HEIGHT}px`,
            padding: `${BEZEL}px`,
            borderRadius: `${OUTER_RADIUS}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div
            className="relative size-full overflow-hidden bg-background"
            style={{ borderRadius: `${SCREEN_RADIUS}px` }}
          >
            <iframe
              ref={iframeRef}
              onLoad={onIframeLoad}
              src="/"
              title="Mi Grilla"
              width={SCREEN_WIDTH}
              height={SCREEN_HEIGHT}
              className="block border-0"
            />
            {/* Dynamic Island: drawn over the screen, as on the phone; taps go through it. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-2.5 left-1/2 h-[30px] w-[112px] -translate-x-1/2 rounded-full bg-black"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
