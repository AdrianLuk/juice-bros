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
  updateNotificationPreferences,
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

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save reminder timing"}
        </Button>
        {state.ok && (
          <p className="text-sm text-muted-foreground" role="status">
            Saved.
          </p>
        )}
        <ActionError state={state} />
      </div>
    </form>
  );
}

function PreferenceCheckbox({
  id,
  name,
  defaultChecked,
  label,
}: {
  id: string;
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-5 w-5 rounded border-input accent-primary"
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

/**
 * The signed-in User's own email notification opt-ins — the Settings page's
 * "Notifications" card. Every toggle (the attendee Reminder from issue #11, the
 * Booking Window Reminder from #36, the friend-request email from #228, and the
 * "request accepted" email) is an independent preference with its own column,
 * but they share one Save button: the form submits every checkbox's current
 * state on each save, so flipping one and saving leaves the others exactly as
 * they sit.
 * Per-device push has its own control (`PushNotificationsForm`), which saves on
 * toggle and isn't part of this form.
 */
export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const [state, formAction, pending] = useActionState(
    updateNotificationPreferences,
    EMPTY,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <PreferenceCheckbox
          id="email-enabled"
          name="email_enabled"
          defaultChecked={preferences.emailEnabled}
          label="Email me a reminder before games I've said yes to, so I don't forget to show up"
        />
        <PreferenceCheckbox
          id="booking-window-email-enabled"
          name="booking_window_email_enabled"
          defaultChecked={preferences.bookingWindowEmailEnabled}
          label="Email me once a facility's booking window opens, so I don't forget to reserve a court"
        />
        <PreferenceCheckbox
          id="connection-request-email-enabled"
          name="connection_request_email_enabled"
          defaultChecked={preferences.connectionRequestEmailEnabled}
          label="Email me when someone sends me a friend request, so I can accept it right away"
        />
        <PreferenceCheckbox
          id="connection-accepted-email-enabled"
          name="connection_accepted_email_enabled"
          defaultChecked={preferences.connectionAcceptedEmailEnabled}
          label="Email me when someone accepts a friend request I sent, so I know we're connected"
        />
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
