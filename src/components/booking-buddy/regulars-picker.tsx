"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/booking-buddy/action-error";
import { FRIENDS_PATH } from "@/lib/booking-buddy/routes";
import {
  REGULAR_IDS_FIELD,
  withGroupMembers,
  type RegularChoices,
} from "@/lib/booking-buddy/regulars";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import { setStandingGameRegulars } from "@/lib/booking-buddy/actions/regulars";

const EMPTY: ActionResult = {};

function regularsCountLabel(count: number): string {
  if (count === 0) {
    return "Nobody picked yet";
  }
  return `${count} regular${count === 1 ? "" : "s"}`;
}

/**
 * Pick a Standing Game's Regulars from the organizer's friends (issue #579).
 * Each ticked friend submits as one `regular_ids` value; a Friend Group adds
 * its members in one tap and is not linked, so editing the group later
 * changes nothing here.
 *
 * `initialRegularIds` seeds the ticks: the saved list on the Standing Game
 * page, or a prefill on the Post a game form ("Make this weekly", #581).
 */
export function RegularsPicker({
  choices,
  initialRegularIds = [],
  idPrefix,
  hideLegend = false,
}: {
  choices: RegularChoices;
  initialRegularIds?: readonly string[];
  /** Keeps checkbox ids unique when two pickers could share a page. */
  idPrefix: string;
  /** For a page whose own section heading already says "Regulars". */
  hideLegend?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(() => [...initialRegularIds]);

  if (choices.friends.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Regulars come from your friends.{" "}
        <Link href={FRIENDS_PATH} className="underline underline-offset-4">
          Add a friend
        </Link>{" "}
        and you can pick who hears about each week&apos;s game.
      </p>
    );
  }

  const toggle = (userId: string, checked: boolean) =>
    setSelected((current) =>
      checked ? withGroupMembers(current, [userId]) : current.filter((id) => id !== userId),
    );

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className={hideLegend ? "sr-only" : "text-sm font-medium"}>Regulars</legend>
      <p className={hideLegend ? "text-sm text-muted-foreground" : "-mt-1 text-xs text-muted-foreground"}>
        They get an email when each week&apos;s game goes up. Anyone who says
        yes to one joins the list on their own.
      </p>

      {choices.groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Fill from a group:</span>
          {choices.groups.map((group) => (
            <Button
              key={group.id}
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Add everyone in ${group.name}`}
              onClick={() =>
                setSelected((current) => withGroupMembers(current, group.memberIds))
              }
            >
              + {group.name}
            </Button>
          ))}
        </div>
      )}

      <ul className="bb-outline flex max-h-64 flex-col gap-1 overflow-y-auto p-3">
        {choices.friends.map((friend) => {
          const id = `${idPrefix}-regular-${friend.userId}`;
          return (
            <li key={friend.userId} className="flex items-center gap-2 py-1">
              <input
                id={id}
                type="checkbox"
                name={REGULAR_IDS_FIELD}
                value={friend.userId}
                checked={selected.includes(friend.userId)}
                onChange={(event) => toggle(friend.userId, event.target.checked)}
                className="h-5 w-5 shrink-0 rounded border-input accent-primary"
              />
              <label htmlFor={id} className="min-w-0 truncate text-sm">
                {friend.label}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {regularsCountLabel(selected.length)}
      </p>
    </fieldset>
  );
}

/** The Regulars section of a Standing Game's own page: the picker and its Save. */
export function StandingGameRegularsForm({
  standingGameId,
  choices,
  regularIds,
}: {
  standingGameId: string;
  choices: RegularChoices;
  regularIds: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(setStandingGameRegulars, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="standing_game_id" value={standingGameId} />
      {/* Who was on screen: only someone shown and unticked is removed, so a
          friend who joined by saying yes since the page loaded stays on. */}
      {choices.friends.map((friend) => (
        <input key={friend.userId} type="hidden" name="shown_regular_ids" value={friend.userId} />
      ))}

      {/* Keyed on the saved list so a save (or a yes that joined someone)
          re-seeds the ticks from the server. */}
      <RegularsPicker
        key={[...regularIds].sort().join(",")}
        choices={choices}
        initialRegularIds={regularIds}
        idPrefix="weekly"
        hideLegend
      />

      {choices.friends.length > 0 && (
        <div className="flex flex-col items-end gap-1">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save regulars"}
          </Button>
          {state.ok && (
            <p className="text-sm text-muted-foreground" role="status">
              Regulars saved.
            </p>
          )}
          <ActionError state={state} />
        </div>
      )}
    </form>
  );
}
