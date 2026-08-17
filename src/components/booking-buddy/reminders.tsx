"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import {
  REMINDER_OFFSET_PRESETS,
  reminderOffsetLabel,
} from "@/lib/booking-buddy/reminders";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  updateBookingWindowRemindersEnabled,
  updateEmailRemindersEnabled,
  updateReminderOffset,
  type NotificationPreferences,
} from "@/lib/booking-buddy/actions/reminders";

const EMPTY: ActionResult = {};

function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}

/**
 * The Slot owner's control over when "yes" Responders get a Reminder
 * (issue #11's "configurable per Slot" acceptance criterion).
 */
export function ReminderOffsetForm({
  slotId,
  reminderOffsetMinutes,
}: {
  slotId: string;
  reminderOffsetMinutes: number;
}) {
  const [state, formAction, pending] = useActionState(updateReminderOffset, EMPTY);

  // The current value is always an option, even if it isn't one of the
  // presets — a value set before this list existed (or some other way)
  // shouldn't silently change the moment the page renders.
  const options = REMINDER_OFFSET_PRESETS.includes(reminderOffsetMinutes)
    ? REMINDER_OFFSET_PRESETS
    : [reminderOffsetMinutes, ...REMINDER_OFFSET_PRESETS].sort((a, b) => a - b);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="reminder-offset">Remind attendees</Label>
        {/* Keyed on the saved value so a successful save remounts the
            select — see the note on BookingWindowForm in orgs.tsx. */}
        <FormSelect
          key={reminderOffsetMinutes}
          id="reminder-offset"
          name="reminder_offset_minutes"
          defaultValue={reminderOffsetMinutes}
          className="sm:max-w-56"
        >
          {options.map((minutes) => (
            <option key={minutes} value={minutes}>
              {reminderOffsetLabel(minutes)}
            </option>
          ))}
        </FormSelect>
        <p className="text-xs text-muted-foreground">
          Only Users with a &ldquo;yes&rdquo; response get one, and only once
          a court is attached.
        </p>
      </div>

      <div className="flex flex-col items-start gap-1">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save reminder timing"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

/** The signed-in User's own opt-in for email Reminders — Settings-page control. */
export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const [state, formAction, pending] = useActionState(updateEmailRemindersEnabled, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          id="email-enabled"
          name="email_enabled"
          type="checkbox"
          defaultChecked={preferences.emailEnabled}
          className="h-5 w-5 rounded border-input accent-primary"
        />
        <Label htmlFor="email-enabled" className="font-normal">
          Email me a reminder before slots I&apos;m in
        </Label>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-sm text-muted-foreground" role="status">
          Saved.
        </p>
      )}

      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

/**
 * The signed-in User's own opt-in for Booking Window Reminders — a separate
 * preference from `NotificationPreferencesForm` above (issue #36's own
 * acceptance criterion), not a second control over the same setting.
 */
export function BookingWindowPreferenceForm({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const [state, formAction, pending] = useActionState(
    updateBookingWindowRemindersEnabled,
    EMPTY,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          id="booking-window-email-enabled"
          name="booking_window_email_enabled"
          type="checkbox"
          defaultChecked={preferences.bookingWindowEmailEnabled}
          className="h-5 w-5 rounded border-input accent-primary"
        />
        <Label htmlFor="booking-window-email-enabled" className="font-normal">
          Email me when it&apos;s time to book a court
        </Label>
      </div>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-sm text-muted-foreground" role="status">
          Saved.
        </p>
      )}

      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
