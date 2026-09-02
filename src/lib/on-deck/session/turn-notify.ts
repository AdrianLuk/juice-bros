/**
 * The opt-in turn notification (issue #260), decision half.
 *
 * A Player may turn on a single push — "you're up, Court 5" — fired when their
 * Foursome enters **On Deck** or is assigned a **Court**. It exists because a
 * `self-serve` Session has no Volunteer calling names (ADR 0005), so a Player
 * would otherwise have to keep watching the Display.
 *
 * This module is the pure part: given the folded `SessionState` *before* an
 * event and the state *after* it, `turnTransitions` returns the moments worth a
 * buzz — a Player who is newly On Deck, or newly on a Court. It is what the
 * sender (`turn-notify-run.ts`, then `actions/turn-notify.ts`) keys off, so the
 * "which transitions fire a push" question is answered by the fold, unit
 * tested here, not scattered through the I/O.
 *
 * Relative imports only — `node --test` can't resolve the `@/` alias, same as
 * every other module in this folder.
 *
 * The rules, straight from the acceptance criteria:
 *
 *   - **On Deck and Court, nothing else.** A queue-position change short of On
 *     Deck (moving from #7 to #5) is not a transition.
 *   - **One buzz per step.** Entering On Deck is one transition; later being
 *     assigned the Court is a second. `turnTransitions` reports each once, at
 *     the moment it happens — the caller's idempotency log makes a re-fold or a
 *     replay safe.
 *   - **A Player who skips On Deck** (walked straight onto a Court from a thin
 *     Queue, or swapped in for a no-show) gets one `court` transition, not a
 *     phantom `on-deck` one.
 */

import type { SessionState } from "./types.ts";

/** One moment worth notifying a Player about. */
export interface TurnTransition {
  /** The Player's device token — their id within this Session. */
  playerId: string;
  /**
   * `on-deck` — the Player's Foursome was just committed to On Deck (they
   * should head to the courts). `court` — the Player was just seated on a
   * Court (they're up now).
   */
  kind: "on-deck" | "court";
  /**
   * The 1-based Court number. For `court` it is where they were seated; for
   * `on-deck` it is null (an On Deck Foursome has no Court yet).
   */
  court: number | null;
  /**
   * A stable id for *this* turn instance, used as the idempotency key
   * (`on_deck_turn_notification_sends.transition`). It is **not** just the
   * `kind`: a Player rotates through many Games in a 2-hour Session, and each
   * fresh On Deck commitment or Court seating is its own buzz. Keying only on
   * `kind` would silence every notification after the Player's first Game.
   *
   *   - `court`: `court:<number>:<since>` — the Court and when the Game was
   *     seated. A no-show swap onto an in-progress Game reuses the existing
   *     `since`, so the swapped-in Player's key is distinct from the four who
   *     started that Game only if they weren't already on it — which they
   *     weren't (they were waiting). Good enough: the swapped-in Player is
   *     seated at a `since` they were never previously keyed against.
   *   - `on-deck`: `on-deck:<committedAt>` — when the Foursome was committed.
   *     A Foursome that tops up keeps its `committedAt`, so a Player already
   *     buzzed for it isn't re-buzzed when a later join fills the fourth seat.
   */
  turnKey: string;
}

/** Every device token currently on a Court in this state. */
function tokensOnCourt(state: SessionState): Set<string> {
  return new Set(state.courts.flatMap((c) => c.foursome));
}

/** Every device token currently committed to an On Deck Foursome. */
function tokensOnDeck(state: SessionState): Set<string> {
  return new Set(state.onDeck.flatMap((f) => f.players));
}

/** The Court a token sits on, or null. */
function courtSlotOf(state: SessionState, token: string) {
  return state.courts.find((c) => c.foursome.includes(token)) ?? null;
}

/** The committed On Deck Foursome a token belongs to, or null. */
function onDeckFoursomeOf(state: SessionState, token: string) {
  return state.onDeck.find((f) => f.players.includes(token)) ?? null;
}

/**
 * The turn transitions between two folded states — `before` is the state prior
 * to the event(s) just applied, `after` is the state now.
 *
 * A Player produces a `court` transition when they are on a Court in `after`
 * but were not in `before` — however they got there (promoted from On Deck,
 * seated straight from a thin Queue, swapped in for a no-show). They produce an
 * `on-deck` transition when they are committed to an On Deck Foursome in
 * `after`, were not On Deck in `before`, and did not just go on a Court (the
 * Court transition supersedes it — "one buzz").
 *
 * Order: `court` transitions first, then `on-deck`, each in roster order, so a
 * caller iterating the list sends the more urgent buzz first.
 */
export function turnTransitions(
  before: SessionState,
  after: SessionState,
): TurnTransition[] {
  const wasOnCourt = tokensOnCourt(before);
  const wasOnDeck = tokensOnDeck(before);
  const nowOnCourt = tokensOnCourt(after);
  const nowOnDeck = tokensOnDeck(after);

  const courtTransitions: TurnTransition[] = [];
  const onDeckTransitions: TurnTransition[] = [];

  for (const player of after.roster) {
    const token = player.id;

    if (nowOnCourt.has(token) && !wasOnCourt.has(token)) {
      const slot = courtSlotOf(after, token);
      courtTransitions.push({
        playerId: token,
        kind: "court",
        court: slot ? slot.number : null,
        turnKey: `court:${slot?.number ?? "?"}:${slot?.since ?? 0}`,
      });
      continue;
    }

    if (
      nowOnDeck.has(token) &&
      !wasOnDeck.has(token) &&
      !wasOnCourt.has(token)
    ) {
      const foursome = onDeckFoursomeOf(after, token);
      onDeckTransitions.push({
        playerId: token,
        kind: "on-deck",
        court: null,
        turnKey: `on-deck:${foursome?.committedAt ?? 0}`,
      });
    }
  }

  return [...courtTransitions, ...onDeckTransitions];
}

/**
 * Title, body, and target URL for one turn-notification push — pure string
 * assembly, no I/O, mirroring Booking Buddy's `formatReminderPush`. The service
 * worker reads `title`/`body`/`url` off the payload.
 *
 * `court` transition — "You're up, Court 5", the same words the Player's own
 * status line already shows. `on-deck` transition — "Head to the courts",
 * matching the "you're up next" language on that line.
 */
export function formatTurnPush(params: {
  transition: Pick<TurnTransition, "kind" | "court">;
  venueName: string;
  sessionUrl: string;
}): { title: string; body: string; url: string } {
  const { transition, venueName, sessionUrl } = params;
  if (transition.kind === "court") {
    return {
      title: "You're up",
      body:
        transition.court != null
          ? `Head to Court ${transition.court} — you're on now.`
          : "Head to the courts — you're on now.",
      url: sessionUrl,
    };
  }
  return {
    title: "You're up next",
    body: `Head to the courts at ${venueName} — your foursome is on deck.`,
    url: sessionUrl,
  };
}
