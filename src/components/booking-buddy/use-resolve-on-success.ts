import { useEffect } from "react";

import type { ActionResult } from "@/lib/booking-buddy/actions/result";

/**
 * Runs `resolve` once a Server Action's state flips to `ok` — the shared
 * "drop this card from the review list on success" effect for the email and
 * feed review cards, now merged into the one "Sync bookings" section.
 *
 * `resolve` is expected to be idempotent, so a confirm and a dismiss each get
 * their own call rather than one effect watching both.
 */
export function useResolveOnSuccess(state: ActionResult, resolve: () => void) {
  useEffect(() => {
    if (state.ok) {
      resolve();
    }
    // Only the action state should re-trigger this — `resolve` closes over
    // values stable within one card's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
