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

import { renderEmailLayout } from "./email-layout.ts";

export function formatGameOffEmail(params: {
  /** The organizer as the app names people (`personOptionLabel`). The layout escapes it. */
  organizerLabel: string;
  /** The skipped game's full date and time (`formatSlotWhen`). */
  slotWhen: string;
  /** Its day alone, for the subject: "Tue, Oct 13". */
  shortDay: string;
  gamesUrl: string;
  /** False once the Standing Game has ended, when there is no next week to promise. */
  weeklyGameContinues: boolean;
}): { subject: string; html: string } {
  const paragraphs = [
    `${params.organizerLabel} skipped this week, so there's no game. You're getting this because you'd said yes or maybe.`,
  ];
  if (params.weeklyGameContinues) {
    paragraphs.push("Next week's game goes up as usual.");
  }

  return {
    subject: `This week's game is off (${params.shortDay})`,
    html: renderEmailLayout({
      heading: "This week's game is off",
      emphasis: params.slotWhen,
      paragraphs,
      primaryAction: { label: "See your games", url: params.gamesUrl },
    }),
  };
}
