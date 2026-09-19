import { Fragment, useRef, type CSSProperties } from "react";

import {
  describeItinerary,
  itinerary,
  type ItineraryEntry,
} from "@/components/apps/match-mixer/lib/engine/itinerary";
import { pairIndexOf } from "@/components/apps/match-mixer/lib/engine/format";
import { FREE_OPPONENT_MEETINGS } from "@/components/apps/match-mixer/lib/engine/scorer";
import type {
  Game,
  PlayerIndex,
  Roster,
  Schedule,
  ScorerResult,
  Side as GameSide,
} from "@/components/apps/match-mixer/lib/engine/types";

/**
 * The ruled field of the board: rounds run down, courts run across, the way
 * the desk reads it out. Each pair is a name plate; the round numerals and the
 * column rails are the board's own applied furniture. Below the `sm` breakpoint
 * the same table restyles into one round at a time, so there is only ever one
 * copy of the schedule in the DOM — which is what lets the print stylesheet be
 * pure CSS.
 *
 * The field answers "what is the whole night". Find-me is the other question
 * asked of the same grid: every name is its own control carrying its Roster
 * index, and picking one holds the rest of the board back so one Player's
 * evening is left standing in it. The dimming is decoration on top of the
 * itinerary line above, which says the same thing in words.
 */

/**
 * One name, addressable on its own. Selection keys on the Roster index and
 * never on the name, so two Players called Mike stay distinct and each get
 * their own evening.
 *
 * A `button` when the board is selectable and a plain `span` when it is not —
 * the zero state's specimen has no business being tabbed through, and this is
 * what keeps it out rather than an `inert` that has to be remembered.
 */
function PlayerName({
  roster,
  index,
  selected,
  onSelect,
}: {
  roster: Roster;
  index: PlayerIndex;
  selected: PlayerIndex | null;
  onSelect?: (player: PlayerIndex) => void;
}) {
  const name = roster[index].name;
  if (!onSelect) return <span className="mm-name">{name}</span>;

  return (
    <button
      type="button"
      className="mm-name"
      // Marked, not merely left undimmed: a reader who cannot perceive the
      // dimming still has the label, and so does one looking at the board from
      // across a court.
      data-me={selected === index ? "true" : undefined}
      aria-pressed={selected === index}
      onClick={() => onSelect(index)}
    >
      {name}
    </button>
  );
}

/**
 * How much of the room has met. Distinct from the repeat verdict beside it:
 * that one says nothing went wrong, this one says how far through the roster
 * the evening got, which is what decides whether another round is worth
 * playing. A schedule with nothing left to give says so, rather than making
 * the organizer compare two numbers to notice.
 *
 * What is being counted follows the Format, because what the night is working
 * through does. Rotating works through partnerships; fixed partners has none
 * left to work through after round one, and works through matchups between
 * pairs instead; singles never had any, and works through matchups between
 * people.
 *
 * The same noun for both matchup Formats, over two different denominators: a
 * fixed-partner matchup is between Pairings and a singles one is between
 * Players, which is exactly the distinction the Scorer's union keeps so that
 * nothing here has to. What the figure answers is the same question in both —
 * how much of the room is left.
 */
function coverage(score: ScorerResult): string | null {
  const [played, possible, noun] =
    score.format === "rotating"
      ? [score.pairingsPlayed, score.pairingsPossible, "pairing"]
      : [score.meetingsPlayed, score.meetingsPossible, "matchup"];

  if (possible === 0) return null;
  if (played === possible) return `every possible ${noun} has played`;
  return `${played} of ${possible} possible ${noun}s`;
}

/**
 * The repeat mark: a marker stroke drawn round a name plate, the way someone
 * standing at the board would ring a pair they had already seen.
 *
 * Drawn rather than bordered because this is the one place a hand touches an
 * otherwise manufactured object — every other line on the board is applied
 * vinyl, so a tidy rectangle here would read as more furniture and stop
 * registering as a mark. The path overshoots its own start, which is what a
 * hand does coming back round to where it began.
 *
 * `preserveAspectRatio="none"` lets the ellipse stretch to whatever width the
 * pair's names give it; `vector-effect` is what keeps the stroke an even
 * weight while it does, instead of the sides going thin.
 */
function RepeatRing() {
  return (
    <svg
      className="mm-ring"
      viewBox="0 0 200 44"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M195 19 C196 8 152 3 100 3 C46 3 5 8 5 20 C5 33 47 41 100 41 C155 41 197 34 194 20 C192 12 180 8 168 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * One side of a Game, on its own name plate — two names in doubles, one in
 * singles. Same plate either way: it is cut to what is printed on it, so a
 * singles plate is simply a shorter one and not a different object.
 *
 * In rotating doubles a pair who partnered more than once is marked here, on
 * the side it belongs to rather than on the Game or in a grid of its own,
 * because naming the pair without showing which Rounds they are in leaves the
 * organizer to find them by hand. The mark is spelled out for screen readers,
 * which have no ring to see.
 *
 * Whether this side repeated is the caller's to decide, not this component's.
 * In fixed partners it never does — the pair is the whole point — and in
 * singles there is no pair to repeat; what repeats in both is the Game, which
 * is marked a level up.
 */
function Side({
  roster,
  side,
  repeat,
  selected,
  onSelect,
}: {
  roster: Roster;
  side: GameSide;
  repeat: boolean;
  selected: PlayerIndex | null;
  onSelect?: (player: PlayerIndex) => void;
}) {
  return (
    <span className="mm-side" data-repeat={repeat ? "true" : undefined}>
      {side.map((player, seat) => (
        <Fragment key={player}>
          {/* The stroke between two partners is furniture, not a word — and
              with nobody to be between, there is nothing for it to do. */}
          {seat > 0 ? (
            <span className="mm-join" aria-hidden="true">
              {" / "}
            </span>
          ) : null}
          <PlayerName
            roster={roster}
            index={player}
            selected={selected}
            onSelect={onSelect}
          />
        </Fragment>
      ))}
      {repeat ? (
        <>
          <RepeatRing />
          <span className="sr-only"> (repeat partners)</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * One Game, and the one place that decides what a repeat *is* on this board.
 *
 * In rotating doubles the failure is a pair partnering twice, so the mark goes
 * round the side it belongs to. In fixed partners every side repeats by
 * construction and marking them would bury the board in rings that all mean
 * "as requested"; what can go wrong there is two Pairings meeting again, which
 * is a fact about the Game. Singles has no side to mark at all, and the thing
 * that can go wrong is again a fact about the Game — two people meeting twice.
 * So in both the same marker stroke is drawn round the whole Game: the mark
 * follows the failure rather than the element, and in singles the Game *is*
 * the pairing.
 *
 * `data-solo` is what lets the two plates of a singles Game sit side by side
 * rather than stacked. It is on the Game because that is where the layout
 * decision belongs — a side has no idea what is opposite it.
 */
function GameCell({
  roster,
  score,
  game,
  selected,
  onSelect,
}: {
  roster: Roster;
  score: ScorerResult;
  game: Game;
  selected: PlayerIndex | null;
  onSelect?: (player: PlayerIndex) => void;
}) {
  const [left, right] = game.sides;

  const rematch =
    score.format === "fixed"
      ? score.meetingMatrix[pairIndexOf(left[0])][pairIndexOf(right[0])] > 1
      : score.format === "singles" &&
        // The opponent matrix is the meeting count itself in singles: one
        // Player on each side, so a Game bumps exactly one cell of it.
        score.opponentMatrix[left[0]][right[0]] > 1;

  const sideRepeats = (side: GameSide) =>
    score.format === "rotating" &&
    side.length === 2 &&
    score.partnerMatrix[side[0]][side[1]] > 1;

  return (
    <span
      className="mm-game"
      data-solo={score.format === "singles" ? "true" : undefined}
      data-repeat={rematch ? "true" : undefined}
    >
      <Side
        roster={roster}
        side={left}
        repeat={sideRepeats(left)}
        selected={selected}
        onSelect={onSelect}
      />
      <span className="mm-versus">vs</span>
      <Side
        roster={roster}
        side={right}
        repeat={sideRepeats(right)}
        selected={selected}
        onSelect={onSelect}
      />
      {rematch ? (
        <>
          <RepeatRing />
          <span className="sr-only">
            {score.format === "singles"
              ? " (these two have played before)"
              : " (these two pairs have met before)"}
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * The answer to "what is *my* night", in words, above the board it was read
 * off. The sentence comes from the engine rather than being assembled here:
 * the dimming below is decoration on top of text that already says it, which
 * is what makes find-me work with no pointer and no sight of the board.
 *
 * The slot is always in the DOM so that the line arriving in it is announced,
 * and it carries the way out — one action, reachable without hunting for the
 * name that was tapped.
 */
function FoundLine({
  roster,
  selected,
  evening,
  onClear,
}: {
  roster: Roster;
  selected: PlayerIndex | null;
  evening: readonly ItineraryEntry[] | null;
  onClear: () => void;
}) {
  return (
    <div className="mm-found" data-found={evening ? "true" : undefined}>
      <p className="mm-found-line" role="status">
        {selected !== null && evening !== null ? (
          <>
            <b className="mm-found-name">{roster[selected].name}</b>
            {/* A real space, not the margin under the label: this is one
                string to a screen reader and to anyone who copies the line. */}
            {" "}
            {describeItinerary(evening)}
          </>
        ) : null}
      </p>
      {evening ? (
        <button type="button" className="mm-quiet" onClick={onClear}>
          Show everyone
        </button>
      ) : null}
    </div>
  );
}

/**
 * The clause the organizer is scanning for, pulled out of the run so the board
 * can carry it in marker green or red. It is the one clause with a pass and a
 * fail; the rest are figures.
 *
 * What counts as the failure is the Format's question. Rotating fails by
 * partnering the same person twice; fixed partners fails by two pairs meeting
 * again before everyone has met; singles fails by two people doing the same.
 * The word "partner" never appears in the singles reading, because a singles
 * night has none — not even a clean one to report.
 */
function verdictOf(score: ScorerResult): {
  failed: boolean;
  verdict: string;
  /** A clause only rotating has; see below. */
  opponents: string | null;
} {
  if (score.format === "rotating") {
    const repeats = score.repeatedPartnerPairs;
    return {
      failed: repeats > 0,
      verdict:
        repeats > 0
          ? `${repeats} repeat partnerships, ringed below`
          : "no repeat partners",
      // Only rotating has an opponent count worth reporting on its own: in the
      // other two, facing the same side again is the headline failure above, so
      // a second clause would say it twice.
      opponents:
        score.maxOpponentCount <= FREE_OPPONENT_MEETINGS
          ? "nobody faces the same person more than twice"
          : `some players face each other ${score.maxOpponentCount} times`,
    };
  }

  const rematches = score.repeatedMeetings;
  return {
    failed: rematches > 0,
    verdict:
      rematches > 0
        ? `${rematches} rematch${rematches === 1 ? "" : "es"}, ringed below`
        : score.format === "singles"
          ? "nobody plays the same person twice"
          : "every pair faces a new pair each round",
    opponents: null,
  };
}

/**
 * The summary line is a readout of the Scorer against the Schedule that was
 * actually produced, never a claim derived from the Config. Whether the Byes
 * rotate evenly is the Scorer's verdict too, not a second rule worked out
 * here from the roster size.
 *
 * Every clause reads off the Format's own reading, which is why the Scorer
 * returns a union and this switches on it rather than reinterpreting one shape
 * three ways. A fixed-partner board has every pair on it partnering every round
 * by construction and a singles board has no partnerships at all; reporting
 * either as repeat partnerships — or as none — would be a true count of a
 * thing nobody got wrong, in the single sentence on the board most likely to be
 * read as a verdict.
 */
function summarise(
  score: ScorerResult,
  schedule: Schedule,
): { verdict: string; failed: boolean; rest: string } {
  const rounds = schedule.rounds.length;
  const sitting = schedule.rounds[0]?.byes.length ?? 0;
  // A Bye belongs to a Pairing in fixed partners, so it is counted in pairs:
  // both members of a sitting team sit, and "4 players sit out" would have the
  // organizer looking for four names to shuffle rather than two pairs. In
  // singles the unit that sits is a Player again.
  const idle = score.format === "fixed" ? sitting / 2 : sitting;
  const unit = score.format === "fixed" ? "pair" : "player";
  const sit = `${idle} ${unit}${idle === 1 ? " sits" : "s sit"}`;

  let byes: string;
  if (sitting === 0) {
    byes = "nobody sits out";
  } else if (score.byesRotateEvenly) {
    byes = `${sit} out each round, rotating evenly`;
  } else {
    byes = `${sit} out each round, but some sit out ${score.byeSpread} more time${score.byeSpread === 1 ? "" : "s"} than others`;
  }

  const { failed, verdict, opponents } = verdictOf(score);

  return {
    failed,
    verdict,
    rest: [
      `${rounds} ${rounds === 1 ? "round" : "rounds"}`,
      coverage(score),
      byes,
      opponents,
    ]
      .filter((clause) => clause !== null)
      .join(" · "),
  };
}

export function ScheduleGrid({
  roster,
  schedule,
  score,
  headingId = "mm-schedule-heading",
  headingHidden = false,
  selected = null,
  onSelect,
}: {
  roster: Roster;
  schedule: Schedule;
  score: ScorerResult;
  /** Overridden by the zero state, which shows a second grid of its own. */
  headingId?: string;
  /**
   * The zero state captions its specimen itself, so the field's own rail comes
   * off rather than sitting under a second one saying the same thing.
   */
  headingHidden?: boolean;
  /** The Roster index whose evening is being read, if any. */
  selected?: PlayerIndex | null;
  /**
   * Omitted on a board nobody is meant to find themselves on. Without it the
   * names render as text and there is no find-me at all, which is what keeps
   * the zero state's specimen out of the way rather than an `inert` somebody
   * has to remember.
   */
  onSelect?: (player: PlayerIndex) => void;
}) {
  const field = useRef<HTMLElement>(null);
  const courts = schedule.rounds[0]?.games.length ?? 0;
  const anyByes = schedule.rounds.some((round) => round.byes.length > 0);
  const summary = summarise(score, schedule);
  // An index this Roster does not have is nobody, checked here as well as at
  // the caller so that the grid is total for whatever it is handed: a board
  // and a selection are two props and nothing makes them arrive together.
  const picked =
    selected !== null && selected >= 0 && selected < roster.length
      ? selected
      : null;
  // One reading of the Schedule for both the sentence and the dimming, so the
  // board cannot end up holding back a cell the line says you are in.
  const evening = onSelect && picked !== null ? itinerary(schedule, picked) : null;

  /**
   * Putting the board back leaves the button that did it with nothing to say,
   * so it unmounts — and an unmounted control takes the keyboard's place in
   * the document with it, dropping focus to `body` and putting every name on
   * the board between the reader and where they were. So focus goes back to
   * their own name first, which is both where they were and the thing that
   * would select them again. The node survives the re-render; only its mark
   * comes off, so focusing it before React commits is enough.
   */
  const clearAndReturn = () => {
    if (picked === null) return;
    const mark = field.current?.querySelector<HTMLElement>(".mm-name[data-me]");
    onSelect?.(picked);
    mark?.focus();
  };

  return (
    <section
      ref={field}
      aria-labelledby={headingHidden ? undefined : headingId}
    >
      {headingHidden ? null : (
        <h2 id={headingId} className="mm-legend mm-rail">
          The board
        </h2>
      )}
      <p className="mm-summary">
        <b data-fail={summary.failed ? "true" : undefined}>{summary.verdict}</b>
        {" · "}
        {summary.rest}
      </p>

      {onSelect ? (
        <FoundLine
          roster={roster}
          selected={picked}
          evening={evening}
          onClear={clearAndReturn}
        />
      ) : null}

      <div className="mm-scroll mt-4">
        <table className="mm-grid">
          <caption className="sr-only">
            Every round of the rotation, with one column per court.
            {onSelect
              ? " Choose a name to read just that player's evening; choose it again to show everyone."
              : null}
          </caption>
          <thead>
            <tr>
              <th scope="col">Rd</th>
              {Array.from({ length: courts }, (_, court) => (
                <th key={court} scope="col">
                  Court {court + 1}
                </th>
              ))}
              {anyByes ? <th scope="col">Off</th> : null}
            </tr>
          </thead>
          <tbody>
            {schedule.rounds.map((round, index) => {
              // What the selected Player is doing this round, which is the
              // whole of what decides where the board is held back.
              const here = evening?.[index] ?? null;

              return (
                // `--row` is what staggers the plates back onto the board after
                // a wipe; the animation itself is entirely in CSS.
                <tr key={index} style={{ "--row": index } as CSSProperties}>
                  <th scope="row">{index + 1}</th>
                  {round.games.map((game) => (
                    <td
                      key={game.court}
                      data-court={`Court ${game.court + 1}`}
                      data-dim={
                        here && !(here.kind === "game" && here.court === game.court)
                          ? "true"
                          : undefined
                      }
                    >
                      <GameCell
                        roster={roster}
                        score={score}
                        game={game}
                        selected={picked}
                        onSelect={onSelect}
                      />
                    </td>
                  ))}
                  {anyByes ? (
                    <td
                      className="mm-byes"
                      data-court="Sitting out"
                      data-dim={here && here.kind !== "bye" ? "true" : undefined}
                    >
                      {round.byes.map((player, position) => (
                        <Fragment key={player}>
                          {position > 0 ? (
                            <span className="mm-join" aria-hidden="true">
                              {", "}
                            </span>
                          ) : null}
                          <PlayerName
                            roster={roster}
                            index={player}
                            selected={picked}
                            onSelect={onSelect}
                          />
                        </Fragment>
                      ))}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
