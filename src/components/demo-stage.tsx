"use client";

import { useRef, useState } from "react";

import { DemoClockControl } from "@/components/demo-clock-control";
import { useDemoClockBroadcast } from "@/components/demo-clock";
import { IphoneFrame } from "@/components/iphone-frame";
import { DEMO_CLOCK_START } from "@/lib/demo-clock";

/**
 * The stage of `/demo`: the clock control on a side panel and the iPhone next to it (FEAT-005b).
 * The simulated time lives only here, in memory: every visit starts on Friday 22:30 (FR-02), and
 * it reaches the app inside the iPhone by `postMessage` (ADR-007).
 */
export function DemoStage() {
  const [instant, setInstant] = useState(DEMO_CLOCK_START);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onIframeLoad = useDemoClockBroadcast(iframeRef, instant);

  return (
    // The row stretches: the phone's area takes the full height left by the header and scales the
    // frame to it, so the page never scrolls at 1280×800.
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 gap-10">
      <aside className="w-72 shrink-0 self-center">
        <DemoClockControl value={instant} onChange={setInstant} />
      </aside>
      <IphoneFrame iframeRef={iframeRef} onIframeLoad={onIframeLoad} />
    </div>
  );
}
