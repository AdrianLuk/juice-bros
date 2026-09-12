/**
 * Drum Roll's vocabulary, kept deliberately clear of the other contexts'.
 *
 * An **Entrant** is a name holding some number of **Tickets**; it is not a
 * Player (which means three different things across Booking Buddy, On Deck and
 * Match Mixer) and not an attendee. A **Prize** is drawn for, once. The
 * **Bucket** is every Ticket currently eligible for the Prize in hand, and is
 * always derived, never stored.
 *
 * "Draw" is free to use here: Match Mixer's glossary gives its own output the
 * name Schedule precisely so the draw words stay available.
 */

export type EntrantId = string;
export type PrizeId = string;

export interface Entrant {
  readonly id: EntrantId;
  readonly name: string;
  /** Tickets in the bucket. Zero means present but not entered. */
  readonly tickets: number;
}

export interface Prize {
  readonly id: PrizeId;
  readonly name: string;
}

/** Why a drawn name did not take the Prize. Both go on the record. */
export type RedrawReason = "not-present" | "declined";

/**
 * The log. Everything the organizer does appends one of these, and the whole
 * screen is a fold over them, so Undo is dropping the last one and folding
 * again. Mirrors On Deck's session log and Pickle Point Pal's `reduceMatch`.
 *
 * No event carries a timestamp: nothing here is time-dependent, and a fold
 * that never reads the clock is a fold whose tests never flake.
 */
export type RaffleEvent =
  | { readonly type: "ENTRANT_ADDED"; readonly id: EntrantId; readonly name: string; readonly tickets: number }
  | { readonly type: "TICKETS_SET"; readonly id: EntrantId; readonly tickets: number }
  | { readonly type: "ENTRANT_REMOVED"; readonly id: EntrantId }
  | { readonly type: "PRIZE_ADDED"; readonly id: PrizeId; readonly name: string }
  | { readonly type: "PRIZE_REMOVED"; readonly id: PrizeId }
  | { readonly type: "DRAWN"; readonly prizeId: PrizeId; readonly entrantId: EntrantId; readonly seed: number }
  | { readonly type: "REDRAWN"; readonly prizeId: PrizeId; readonly entrantId: EntrantId; readonly reason: RedrawReason }
  | { readonly type: "ONE_PRIZE_PER_PERSON_SET"; readonly value: boolean };

/**
 * A Prize plus what has happened to it. `winnerId` is the last name drawn that
 * was not then sent back; `skipped` is everyone who was, in the order it
 * happened, so the Prize can show its own history on screen.
 */
export interface PrizeStanding extends Prize {
  readonly winnerId: EntrantId | null;
  /** The seed that produced `winnerId`, so the draw can be recomputed later. */
  readonly seed: number | null;
  readonly skipped: readonly EntrantId[];
}

export interface RaffleState {
  readonly entrants: readonly Entrant[];
  readonly prizes: readonly PrizeStanding[];
  /**
   * On by default: a name that has taken a Prize is out of the bucket for the
   * rest of the night. Off matches a physical bucket, where your other tickets
   * stay in and you can win twice. The draw screen prints whichever is active,
   * so the room knows the rule before a name comes out.
   */
  readonly onePrizePerPerson: boolean;
}
