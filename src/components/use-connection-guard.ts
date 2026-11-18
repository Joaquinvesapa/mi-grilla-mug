// Stops the group actions without a connection (FR-04). No "use client" of its own: only client
// components import it. `navigator.onLine` is read when the person sends, as in
// schedule-screen.tsx; a signal that drops the request is caught when the action rejects.
import { unstable_rethrow } from "next/navigation";
import { type FormEvent, useState } from "react";

import { groupMessageFor, OFFLINE_ACTION } from "@/lib/group-messages";

export type ConnectionGuard = {
  /** The guard's own notice; when set it wins over the action's error (spec, W7). */
  message: string | null;
  /** The form's `onSubmit`: offline it cancels the send, so React never runs the `action`. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** Wraps a `useActionState` action: a rejection keeps the previous state and sets `message`. */
  guard: <S, P>(action: (prev: S, payload: P) => Promise<S>) => (prev: S, payload: P) => Promise<S>;
};

/**
 * The notice is not a disabled button: it shows on the attempt (AC-28) and the next send with a
 * connection clears it. A rejected action says "no connection" if the browser is offline by then,
 * otherwise the catalog's generic text — never the rejection's own message. Next's `redirect` and
 * `notFound` also arrive as rejections, and are thrown again so they keep navigating.
 */
export function useConnectionGuard(): ConnectionGuard {
  const [message, setMessage] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!navigator.onLine) {
      event.preventDefault();
      setMessage(OFFLINE_ACTION);
      return;
    }
    setMessage(null);
  }

  function guard<S, P>(action: (prev: S, payload: P) => Promise<S>) {
    return async (prev: S, payload: P): Promise<S> => {
      try {
        return await action(prev, payload);
      } catch (error) {
        unstable_rethrow(error);
        setMessage(navigator.onLine ? groupMessageFor("SERVICE_UNAVAILABLE") : OFFLINE_ACTION);
        return prev;
      }
    };
  }

  return { message, onSubmit, guard };
}
