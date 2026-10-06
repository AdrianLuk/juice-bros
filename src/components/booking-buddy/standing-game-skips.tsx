"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ActionError } from "@/components/booking-buddy/action-error";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  skipPostedWeek,
  skipStandingGameDate,
  unskipStandingGameDate,
  type GameWeek,
  type StandingGameSkips,
} from "@/lib/booking-buddy/actions/standing-game-skips";

const EMPTY: ActionResult = {};

/**
 * "Skip this week", standing in for "Delete game" on a Standing Game's posted
 * game (#578). The confirm says who hears it's off; `notice` comes from
 * `skipWeekNotice`.
 */
export function SkipWeekButton({
  slotId,
  when,
  notice,
}: {
  slotId: string;
  when: string;
  notice: string;
}) {
  const [state, formAction, pending] = useActionState(skipPostedWeek, EMPTY);

  // The form lives inside the dialog so the confirm button is the only thing
  // that can submit it, the same shape as Delete game.
  const form = (
    <form
      action={formAction}
      className="flex flex-col items-stretch gap-1 sm:items-end"
    >
      <input type="hidden" name="slot_id" value={slotId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Skipping…" : "Skip this week"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Skip this week
      </DialogTrigger>
      <DialogContent className="bb-theme">
        <DialogHeader>
          <DialogTitle>Skip this week?</DialogTitle>
          <DialogDescription>
            {when}. The game comes down with its responses and invite link.
            Attached Bookings stay on your Bookings page.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">{notice}</p>
        <p className="text-sm text-muted-foreground">
          Only this week is skipped. The weekly game itself carries on.
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep this week
          </DialogClose>
          {form}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnskipButton({
  standingGameId,
  week,
}: {
  standingGameId: string;
  week: GameWeek;
}) {
  const [state, formAction, pending] = useActionState(
    unskipStandingGameDate,
    EMPTY,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="standing_game_id" value={standingGameId} />
      <input type="hidden" name="game_date" value={week.date} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Put ${week.label} back on`}
      >
        {pending ? "Putting back…" : "Put back on"}
      </Button>
      <ActionError state={state} />
    </form>
  );
}

/**
 * Skip a week ahead of time from the Standing Game page, and the skipped
 * weeks still to come, each of which can be put back on. A skipped week is
 * never posted and nobody is invited to it.
 */
export function SkipDatesPanel({
  standingGameId,
  skips,
}: {
  standingGameId: string;
  skips: StandingGameSkips;
}) {
  const [state, formAction, pending] = useActionState(
    skipStandingGameDate,
    EMPTY,
  );

  return (
    <div className="flex flex-col gap-6">
      {skips.skippable.length > 0 && (
        <form
          action={formAction}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="standing_game_id" value={standingGameId} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="skip-week-date">Week to skip</Label>
            <FormSelect
              id="skip-week-date"
              name="game_date"
              required
              defaultValue={skips.skippable[0]?.date}
            >
              {skips.skippable.map((week) => (
                <option key={week.date} value={week.date}>
                  {week.label}
                </option>
              ))}
            </FormSelect>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Skipping…" : "Skip that week"}
            </Button>
          </div>
        </form>
      )}
      <ActionError state={state} />

      <div>
        <h3 className="text-sm font-medium">Skipped</h3>
        {skips.skipped.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No weeks skipped. Every week goes up as usual.
          </p>
        ) : (
          <ul
            aria-label="Skipped weeks"
            className="mt-2 divide-y divide-border/60 overflow-hidden rounded-lg bg-muted/30"
          >
            {skips.skipped.map((week) => (
              <li
                key={week.date}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span>
                  <span className="line-through decoration-1">{week.label}</span>
                  <span className="ml-2 text-muted-foreground">Off</span>
                </span>
                <UnskipButton standingGameId={standingGameId} week={week} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
