/**
 * The "it's off" email (issue #578): sent when an organizer skips a week of a
 * Standing Game that was already posted, to everyone who had answered yes or
 * maybe. Particular to Standing Games; deleting an ordinary game still tells
 * nobody (CONTEXT.md).
 *
 * The game it was about is gone by the time this is read, so its one button
 * goes to the Games page rather than the game.
 *
 * Pure string assembly through the shared layout, relative imports only, so
 * it runs under `node --test`.
 */

import { formatShortDateLabel } from "./datetime.ts";
import { renderEmailLayout } from "./email-layout.ts";

export function formatGameOffEmail(params: {
  /** The organizer as the app names people (`personOptionLabel`). The layout escapes it. */
  organizerLabel: string;
  /** The skipped game's full date and time (`formatSlotWhen`). */
  slotWhen: string;
  /**
   * The skipped week's date (`YYYY-MM-DD`). Named outright, since with a long
   * Booking Window the game can be two weeks out and the week after it
   * already posted: "this week" and "next week" would both be wrong.
   */
  gameDate: string;
  gamesUrl: string;
  /** False once the Standing Game has ended, when there is nothing to carry on. */
  weeklyGameContinues: boolean;
}): { subject: string; html: string } {
  const day = formatShortDateLabel(params.gameDate);
  const paragraphs = [
    `${params.organizerLabel} skipped the weekly game on ${day}. You're getting this because you'd said yes or maybe.`,
  ];
  if (params.weeklyGameContinues) {
    paragraphs.push("Only that week is off. The weekly game itself carries on.");
  }

  return {
    subject: `The game on ${day} is off`,
    html: renderEmailLayout({
      heading: `The game on ${day} is off`,
      emphasis: params.slotWhen,
      paragraphs,
      primaryAction: { label: "See your games", url: params.gamesUrl },
    }),
  };
}
