"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { BoardCard } from "@/components/booking-buddy/bb/board-card";
import { ActionError } from "@/components/booking-buddy/action-error";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { OptionalOrgSelect } from "@/components/booking-buddy/org-select";
import {
  DurationPicker,
  useDurationInput,
} from "@/components/booking-buddy/duration-picker";
import {
  HourTimeSelect,
  WeekdaySelect,
} from "@/components/booking-buddy/slots";
import { formatTimeLabel } from "@/lib/booking-buddy/datetime";
import { DIVISIONS, DIVISION_LABEL } from "@/lib/booking-buddy/division";
import { MAX_ROTATION_BUFFER } from "@/lib/booking-buddy/capacity";
import {
  REMINDER_OFFSET_PRESETS,
  reminderOffsetLabel,
} from "@/lib/booking-buddy/reminders";
import { NOTES_MAX_LENGTH } from "@/lib/booking-buddy/slots";
import {
  WEEKDAY_NAMES,
  everyWeekdayLabel,
  hourClock,
  standingGameTimeLabel,
} from "@/lib/booking-buddy/standing-games";
import { slotPath, standingGamePath } from "@/lib/booking-buddy/routes";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  endStandingGame,
  updateStandingGame,
  type StandingGame,
  type StandingGameSummary,
} from "@/lib/booking-buddy/actions/standing-games";

const EMPTY: ActionResult = {};

/** "Tue, Oct 13" out of a posted game's full `when`. */
function shortDay(when: string): string {
  return when.split(" · ")[0]?.replace(/,\s*\d{4}$/, "") ?? when;
}

/**
 * One Standing Game in the Weekly games section: its day and hours, where,
 * the next game it has posted, and how many Regulars it has. Opens the Standing Game's own page.
 */
export function WeeklyGameRow({ game }: { game: StandingGameSummary }) {
  return (
    <li>
      <BoardCard
        as={Link}
        href={standingGamePath(game.id)}
        pin="info"
        pinLabel="Every week"
        pinAlign="left"
        pinned={false}
        interactive
        className="bb-slip block no-underline"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {everyWeekdayLabel(game.weekday)} · {standingGameTimeLabel(game)}
              {game.facilityName && ` · ${game.facilityName}`}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {game.nextGame
                ? `Next game ${shortDay(game.nextGame.when)}`
                : "Next game goes up within a day"}
              {` · ${game.regularsCount} regular${game.regularsCount === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
      </BoardCard>
    </li>
  );
}

function hoursBetween(startHour: number, endHour: number): number {
  return (endHour - startHour + 24) % 24 || 24;
}

/**
 * Edit every field of a live Standing Game. Saving only shapes weeks it
 * hasn't posted yet; the page says so beside the button.
 */
export function StandingGameEditForm({
  game,
  orgs,
}: {
  game: StandingGame;
  orgs: Org[];
}) {
  const [state, formAction, pending] = useActionState(
    updateStandingGame,
    EMPTY,
  );
  const duration = useDurationInput(
    hourClock(game.startHour),
    hoursBetween(game.startHour, game.endHour),
  );

  const reminderOptions = REMINDER_OFFSET_PRESETS.includes(
    game.reminderOffsetMinutes,
  )
    ? REMINDER_OFFSET_PRESETS
    : [game.reminderOffsetMinutes, ...REMINDER_OFFSET_PRESETS].sort(
        (a, b) => a - b,
      );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="standing_game_id" value={game.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="weekly-weekday">Day</Label>
          <WeekdaySelect id="weekly-weekday" defaultValue={game.weekday} />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="weekly-start">Start</Label>
          <HourTimeSelect
            id="weekly-start"
            name="start_time"
            value={duration.startTime}
            onChange={(event) => duration.setStartTime(event.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <Label>Duration</Label>
          <DurationPicker
            value={duration.durationChoice}
            onChange={duration.setDurationChoice}
          />
          {duration.durationChoice === "custom" && (
            <div className="flex items-center gap-2 pt-0.5">
              <Input
                aria-label="Custom duration in hours"
                type="number"
                inputMode="numeric"
                min={1}
                max={23}
                step={1}
                placeholder="Hours"
                value={duration.customHours}
                onChange={(event) =>
                  duration.setCustomHours(event.target.value)
                }
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="weekly-end">End</Label>
          <Input
            id="weekly-end"
            value={duration.endTime ? formatTimeLabel(duration.endTime) : "-"}
            disabled
            readOnly
          />
          {duration.endCrossesMidnight && (
            <p className="text-xs text-muted-foreground">Next day</p>
          )}
          <input
            type="hidden"
            name="end_time"
            value={duration.endTime ?? ""}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="weekly-division">Division</Label>
          <FormSelect
            id="weekly-division"
            name="division"
            defaultValue={game.division}
          >
            {DIVISIONS.map((division) => (
              <option key={division} value={division}>
                {DIVISION_LABEL[division]}
              </option>
            ))}
          </FormSelect>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="weekly-org">Facility</Label>
          <OptionalOrgSelect
            id="weekly-org"
            orgs={orgs}
            defaultValue={game.intendedOrgId ?? ""}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="weekly-buffer">Rotation buffer</Label>
          <Input
            id="weekly-buffer"
            name="rotation_buffer"
            type="number"
            min={0}
            max={MAX_ROTATION_BUFFER}
            step={1}
            defaultValue={game.rotationBuffer}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="weekly-reminder">Remind attendees</Label>
          <FormSelect
            id="weekly-reminder"
            name="reminder_offset_minutes"
            defaultValue={game.reminderOffsetMinutes}
          >
            {reminderOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {reminderOffsetLabel(minutes)}
              </option>
            ))}
          </FormSelect>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="weekly-notes">Notes (optional)</Label>
        <Textarea
          id="weekly-notes"
          name="notes"
          defaultValue={game.notes ?? ""}
          maxLength={NOTES_MAX_LENGTH}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button
          type="submit"
          disabled={pending || duration.endTime === null}
        >
          {pending ? "Saving…" : "Save weekly game"}
        </Button>
        {state.ok && (
          <p className="text-sm text-muted-foreground" role="status">
            Saved. Games already posted stay as they are.
          </p>
        )}
        <ActionError state={state} />
      </div>
    </form>
  );
}

/** End for good, behind a confirm. No restart, which the dialog says. */
export function EndStandingGameButton({ game }: { game: StandingGame }) {
  const [state, formAction, pending] = useActionState(endStandingGame, EMPTY);

  const form = (
    <form
      action={formAction}
      className="flex flex-col items-stretch gap-1 sm:items-end"
    >
      <input type="hidden" name="standing_game_id" value={game.id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Ending…" : "End weekly game"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        End weekly game
      </DialogTrigger>
      <DialogContent className="bb-theme">
        <DialogHeader>
          <DialogTitle>End this weekly game?</DialogTitle>
          <DialogDescription>
            No more {WEEKDAY_NAMES[game.weekday]} games get posted. Games already posted stay on, and you can&apos;t
            restart it later. Set up a new one instead.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep it going
          </DialogClose>
          {form}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The posted games still to come, each opening its own page. */
export function PostedGamesList({
  games,
}: {
  games: { id: string; when: string }[];
}) {
  if (games.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing posted right now. The next game goes up within a day.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-lg bg-muted/30">
      {games.map((posted) => (
        <li key={posted.id}>
          <Link
            href={slotPath(posted.id)}
            className="block px-4 py-3 text-sm underline-offset-4 hover:underline"
          >
            {posted.when}
          </Link>
        </li>
      ))}
    </ul>
  );
}
