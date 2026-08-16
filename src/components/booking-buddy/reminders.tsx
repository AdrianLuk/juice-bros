"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_REMINDER_OFFSET_MINUTES,
  MIN_REMINDER_OFFSET_MINUTES,
} from "@/lib/booking-buddy/reminders";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
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
    <p className="text-xs text-red-600" role="alert">
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

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="reminder-offset">Remind attendees</Label>
        <div className="flex items-center gap-2">
          <Input
            id="reminder-offset"
            name="reminder_offset_minutes"
            type="number"
            min={MIN_REMINDER_OFFSET_MINUTES}
            max={MAX_REMINDER_OFFSET_MINUTES}
            step={1}
            defaultValue={reminderOffsetMinutes}
            className="sm:max-w-32"
          />
          <span className="text-sm text-muted-foreground">minutes before it starts</span>
        </div>
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
          className="h-4 w-4 rounded border-input accent-foreground"
        />
        <Label htmlFor="email-enabled" className="font-normal">
          Email me a reminder before slots I&apos;m in
        </Label>
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
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
