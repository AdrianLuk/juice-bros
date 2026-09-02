import type { ActionResult } from "@/lib/booking-buddy/actions/result";

/**
 * Renders a Server Action's `state.error` as a small destructive alert under a
 * form, or nothing when the last run didn't fail.
 *
 * This was copy-pasted byte-for-byte into a dozen Booking Buddy components
 * before it earned its own file. Same markup everywhere — the `role="alert"`
 * matters, some e2e specs assert on it.
 */
export function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}
