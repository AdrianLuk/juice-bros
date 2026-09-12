import type { Entrant } from "./types.ts";

/**
 * The roster as text, and back again.
 *
 * This is the handover format: the organizer copies it off one phone and the
 * next person pastes it into theirs. It therefore has to survive a trip
 * through a messaging app, be readable by the human forwarding it, and lose
 * nothing on the way — a list that quietly drops ticket counts would hand the
 * next runner a raffle where everyone who paid for five tickets now has one.
 *
 * Hence `Name x5` rather than JSON or a CSV: it reads as what it is in a chat
 * window, and it is the same thing a person would have written by hand.
 */

/** One ticket is the common case and says nothing, so it is left unwritten. */
export function formatRoster(entrants: readonly Entrant[]): string {
  return entrants
    .map((entrant) =>
      entrant.tickets === 1 ? entrant.name : `${entrant.name} x${entrant.tickets}`,
    )
    .join("\n");
}

export interface ParsedEntrant {
  readonly name: string;
  readonly tickets: number;
}

/**
 * Only a trailing `x<number>` counts, and only with the whole rest of the line
 * taken as the name. That is what keeps a name that happens to contain the
 * letter — "Alex", or a doubles pair written "Jess x Sam" — from being read as
 * a ticket count. A line with no count is one ticket, which makes a plain list
 * of names pasted from anywhere else still work.
 */
const WITH_COUNT = /^(.+?)\s+x\s*(\d+)$/i;

export function parseRoster(text: string): ParsedEntrant[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = WITH_COUNT.exec(line);
      if (!match) return { name: line, tickets: 1 };

      const name = match[1]!.trim();
      const tickets = Number(match[2]);

      // "x12" on its own is a name, not a count with nobody holding it.
      if (!name) return { name: line, tickets: 1 };

      return { name, tickets };
    });
}
