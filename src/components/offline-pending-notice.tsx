import { CloudOff } from "lucide-react";

import { OFFLINE_PENDING_BODY, OFFLINE_PENDING_TITLE } from "@/lib/selection-messages";

/**
 * The notice while the selection is saved only on this device (FR-04): a flat strip between the bar
 * and the days, one more row of the screen's flex, so the grid keeps the rest (mobile-native,
 * fix 3). It only informs: nothing to tap. The text wraps, with no fixed widths (NFR-02).
 */
export function OfflinePendingNotice() {
  return (
    <div
      role="status"
      className="flex shrink-0 items-start gap-3 border-y border-border bg-card px-4 py-3"
    >
      <CloudOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-semibold">{OFFLINE_PENDING_TITLE}</p>
        <p className="text-sm text-muted-foreground">{OFFLINE_PENDING_BODY}</p>
      </div>
    </div>
  );
}
