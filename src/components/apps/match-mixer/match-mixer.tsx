"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  isSupportedRosterSize,
  MAX_ROUNDS,
  maxCourts,
  resolveNumbers,
  type ResolvedConfig,
} from "@/components/apps/match-mixer/lib/engine/config";
import {
  describeConfig,
  describeNumbers,
  describeUnsupportedRoster,
} from "@/components/apps/match-mixer/lib/engine/describe";
import {
  duplicateNames,
  parseRoster,
} from "@/components/apps/match-mixer/lib/engine/roster";
import { scoreSchedule } from "@/components/apps/match-mixer/lib/engine/scorer";
import { generateSchedule } from "@/components/apps/match-mixer/lib/engine/schedule";
import {
  load,
  save,
} from "@/components/apps/match-mixer/lib/persistence/config-storage";
import {
  decodeShareLink,
  encodeShareLink,
  SHARE_PARAM,
} from "@/components/apps/match-mixer/lib/persistence/share-link";
import {
  boardIdentity,
  clear as clearSelection,
  load as loadSelection,
  save as saveSelection,
} from "@/components/apps/match-mixer/lib/persistence/selection-storage";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type PlayerIndex,
  type Roster,
  type Schedule,
  type ScorerResult,
} from "@/components/apps/match-mixer/lib/engine/types";

import { ScheduleGrid } from "./schedule-grid";

/**
 * Match Mixer's only screen. Paste a Roster, set your courts, draw the
 * Schedule.
 *
 * The screen runs at two speeds. The consequence line is arithmetic over the
 * Config and updates on every keystroke, so the numbers always describe what is
 * in the box. The Schedule is a search that can take a third of a second on a
 * big Roster, so it runs when the organizer asks for it rather than while they
 * are still typing a name. What that costs is the chance of reading a stale
 * grid as a current one, which is what the button's label, the note under it
 * and the flag over the board are all spent preventing.
 *
 * Reseeding is the same button: pressing it with nothing changed writes a new
 * Seed, which is the whole of what a fresh draw is (ADR 0001). One control, so
 * the screen doesn't grow two ways to ask the same question.
 */

const EXAMPLE_NAMES = [
  "Ben Johns",
  "Anna Leigh Waters",
  "Federico Staksrud",
  "Catherine Parenteau",
  "JW Johnson",
  "Anna Bright",
  "Gabriel Tardio",
  "Jorja Johnson",
];

const EXAMPLE_ROSTER = EXAMPLE_NAMES.join("\n");

/**
 * Long enough that a typed name is one write rather than eight, short enough
 * that anything worth keeping is on disk before attention moves on.
 */
const SAVE_DEBOUNCE_MS = 400;

/**
 * The zero state's board: a real Schedule, generated the way any other
 * one is, so what it shows is what the tool actually does. Fixed Seed and
 * built once at module scope, because it must not differ between the server's
 * render and the browser's, and it never changes after that.
 */
const EXAMPLE = (() => {
  const roster = parseRoster(EXAMPLE_ROSTER);
  const config = { roster, courts: 2, rounds: 4, seed: 3 };
  const schedule = generateSchedule(config);
  return { roster, schedule, score: scoreSchedule(schedule, config) };
})();

/** What the Schedule on screen was drawn from, kept beside it. */
interface Draw {
  /**
   * The whole Config it came from, held rather than just its outputs. The
   * names matter because the engine works in positions, so a Schedule only
   * means anything beside the Roster it was generated against; the Seed
   * matters because it is what lets the same board be generated again after a
   * reload instead of stored (ADR 0001).
   */
  readonly config: ResolvedConfig;
  /** The Roster and numbers it came from, for telling current from stale. */
  readonly key: string;
  /** The numbers it was drawn from, for the flag over a stale board. */
  readonly numbers: string;
  readonly schedule: Schedule;
  readonly score: ScorerResult;
  /**
   * Whether this board came off a Share Link minted under an older Generator
   * Version. It sticks to this particular draw rather than to the screen, so
   * it clears the moment the board is actually redrawn — pressing the button
   * makes a current board, whatever it was opened from.
   */
  readonly outdated: boolean;
}

/** Draws the board for a Config, whether it was just asked for or restored. */
function drawFrom(config: ResolvedConfig, outdated = false): Draw {
  const { roster, courts, rounds } = config;
  const schedule = generateSchedule(config);
  return {
    config,
    key: drawKey(roster, courts, rounds),
    numbers: describeNumbers({ players: roster.length, courts, rounds }),
    schedule,
    score: scoreSchedule(schedule, config),
    outdated,
  };
}

/**
 * Everything generation depends on. Ids are deliberately absent: the engine
 * sees names and numbers only, so typing a name back to what it was is not a
 * change and should not leave the board flagged as stale.
 */
function drawKey(roster: Roster, courts: number, rounds: number): string {
  // Joined on a newline because that is the one character `parseRoster` will
  // not leave inside a name. On a space, "Mary Ann / Bo" and "Mary / Ann Bo"
  // would key the same, and an edit between them would never flag the board.
  return `${courts}/${rounds}/${roster.map((player) => player.name).join("\n")}`;
}

/**
 * The signature of the screen, for telling whether it is still the board a
 * link put there. Over exactly what a save would write — the Roster including
 * identity, the two field choices as choices, and the Seed of the board on
 * screen — so anything a save would record as different reads as different
 * here too.
 *
 * Not `drawKey`, which is deliberately blind to ids and to unmade choices
 * because its question is whether the board is stale. This one's question is
 * whether the reader has touched anything at all.
 */
function borrowKey(
  roster: Roster,
  courts: number | null,
  rounds: number | null,
  seed: number | undefined,
): string {
  const entries = roster.map((player) => `${player.id}=${player.name}`);
  return [seed ?? "", courts ?? "", rounds ?? "", ...entries].join("\n");
}

/**
 * A cleared Roster, held only in memory. The text and the parsed entries both,
 * so that putting it back restores the ids as well as the names and a Player
 * comes back as the same Player.
 */
interface ClearedRoster {
  readonly text: string;
  readonly roster: Roster;
}

/**
 * Whose evening is being read, and off which board. Kept as one value rather
 * than a bare index so the pair can be checked against the board on screen in
 * the same render it changes, instead of a frame later.
 */
interface Found {
  readonly board: string;
  readonly player: PlayerIndex;
}

/** "12 names", "1 name" — what pressing the button puts back. */
function countNames(count: number): string {
  return `${count} ${count === 1 ? "name" : "names"}`;
}

/** Never the Seed just used, so pressing again always redraws. */
function nextSeed(previous: number | undefined): number {
  const roll = () => 1 + Math.floor(Math.random() * 0x7ffffffe);
  let seed = roll();
  while (seed === previous) seed = roll();
  return seed;
}

export function MatchMixer() {
  const [text, setText] = useState("");
  // The Roster is kept beside the text rather than derived from it, because
  // parsing has to see the previous entries to hand a corrected or reordered
  // line back its existing id.
  const [roster, setRoster] = useState<Roster>([]);
  // Null means "whatever this Roster suggests", so the fields keep following
  // the names being pasted until the organizer overrules them.
  const [courtsChoice, setCourtsChoice] = useState<number | null>(null);
  const [roundsChoice, setRoundsChoice] = useState<number | null>(null);
  const [draw, setDraw] = useState<Draw | null>(null);
  // Whether the saved Config has been read yet, which is only ever asked so
  // that saving cannot start before loading has finished. The screen itself
  // does not wait on it: the example board is server-rendered and stays until
  // there is something truer to put in its place.
  const [restored, setRestored] = useState(false);
  // What the box held before Clear emptied it, kept for as long as it stays
  // empty rather than for a few seconds: an organizer who looks up from the
  // court a minute later should still find the way back.
  const [cleared, setCleared] = useState<ClearedRoster | null>(null);
  // The board a link put on screen, as the signature of the screen showing it,
  // or null when nothing was borrowed. While the screen still matches, the
  // board belongs to somebody else and nothing is written: most people who
  // open a link are players rather than organizers, and some of them keep
  // their own club list in this same browser.
  //
  // Held as the signature rather than as a flag that every edit handler has to
  // remember to clear. There are six ways to edit this screen and a seventh
  // that forgot would quietly write a stranger's roster over the reader's own;
  // comparing what is on screen cannot be forgotten by a handler that does not
  // know it exists.
  const borrowed = useRef<string | null>(null);
  // Whose evening is being read off the board. A Roster index and never a
  // name, so two Players called Mike are two selections — and always carrying
  // the board it was picked on, for the reason `selection-storage` gives: an
  // index means nothing on its own.
  const [found, setFound] = useState<Found | null>(null);
  // Whether this tab has ever had a Roster in it, which decides whether its
  // empty box means anything. A tab left open on the zero state has nothing to
  // say about the save, and must not be the one that deletes it.
  const held = useRef(false);
  // The share parameter this screen was last seeded from, so a history move
  // that did not touch it is not mistaken for a different board.
  const seededFrom = useRef<string | null | undefined>(undefined);

  // Both the address bar and storage are read in an effect and never during
  // render: neither exists on the server, and rendering from them would
  // hydrate a different tree than the server sent.
  //
  // The parameter is read from `window.location` rather than through the
  // page's `searchParams` or `useSearchParams`. `/tools/match-mixer` is
  // statically rendered, and both of those give that up — the first by making
  // the whole route dynamic for a value only the browser needs, the second by
  // pushing this tree past the prerender and taking the server-rendered
  // example board with it.
  //
  // Re-read on `popstate`, because two links pasted into one chat are the same
  // route: a component seeded once on mount goes on showing the first board
  // when the reader comes back to the second. Booking Buddy has been bitten by
  // exactly this.
  useEffect(() => {
    const seed = () => {
      const param = new URLSearchParams(window.location.search).get(SHARE_PARAM);
      if (seededFrom.current !== undefined && seededFrom.current === param) {
        return;
      }
      seededFrom.current = param;

      setCleared(null);

      // A link beats storage, and beats it without reading it at all.
      const shared = decodeShareLink(param);
      if (shared) {
        const { roster: shown, courts, rounds } = shared.config;
        setText(shown.map((player) => player.name).join("\n"));
        setRoster(shown);
        setCourtsChoice(courts);
        setRoundsChoice(rounds);
        // Generated again from the values the link carried rather than sent as
        // a grid, which is what ADR 0001's determinism was for. `!current` is
        // never a decode failure (#494): an unrecognised or future version
        // still draws, it just carries the notice below.
        setDraw(drawFrom(shared.config, !shared.current));
        borrowed.current = borrowKey(shown, courts, rounds, shared.config.seed);
        setRestored(true);
        return;
      }

      // Written out even when there is nothing saved, because this also runs
      // on the way back off a link: leaving the borrowed board on screen while
      // calling it this browser's own is how it would end up in this
      // browser's storage.
      const saved = load();
      const edited = saved?.edited ?? { roster: [], courts: null, rounds: null };
      setText(edited.roster.map((player) => player.name).join("\n"));
      setRoster(edited.roster);
      setCourtsChoice(edited.courts);
      setRoundsChoice(edited.rounds);
      // The board is generated again rather than stored, so what comes back is
      // the same board down to the seat every name sat in.
      setDraw(saved?.drawn ? drawFrom(saved.drawn) : null);
      borrowed.current = null;
      setRestored(true);
    };

    seed();
    window.addEventListener("popstate", seed);
    return () => window.removeEventListener("popstate", seed);
  }, []);

  // Debounced because the Roster arrives a keystroke at a time and a write per
  // keystroke is work nobody asked for. The write is guarded against running
  // before the read above, which would save an empty screen over the roster it
  // is in the middle of restoring.
  useEffect(() => {
    if (!restored) return;
    // Somebody else's board is read, not kept. A player who opens a link and
    // happens to keep their own club list in this browser must find it exactly
    // where they left it, so nothing at all is written while the screen is
    // still the board the link put there. Changing anything — a name, a
    // number, a redraw — is how a reader says they are working on it now, and
    // it saves like any other visit from that point.
    if (borrowed.current !== null) {
      const onScreen = borrowKey(
        roster,
        courtsChoice,
        roundsChoice,
        draw?.config.seed,
      );
      if (borrowed.current === onScreen) return;
      borrowed.current = null;
    }
    // While the undo is standing, the save is what backs it. Writing the empty
    // box over it would make Clear irreversible the moment the tab went away,
    // which is the mistake the undo is there for.
    if (cleared) return;
    // A tab that has never held a Roster has nothing to say about the save,
    // and an empty one saying it would delete the Roster another tab is in the
    // middle of keeping.
    held.current ||= roster.length > 0 || draw !== null;
    if (!held.current) return;

    const edited = { roster, courts: courtsChoice, rounds: roundsChoice };
    const drawn = draw?.config ?? null;

    const timer = setTimeout(() => save(edited, drawn), SAVE_DEBOUNCE_MS);
    // A tab closed on the last name typed is exactly the visit worth keeping,
    // and it closes well inside the debounce. Both events, because between
    // them they cover a close, a navigation and a phone being pocketed. They
    // overlap, and one of them fires again on the way back in, neither of
    // which is worth guarding: the same bytes written twice cost nothing.
    const flush = () => {
      clearTimeout(timer);
      save(edited, drawn);
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [restored, cleared, roster, courtsChoice, roundsChoice, draw]);

  // Which board is on screen, for the find-me selection to be held against.
  // Never the Roster index alone: an index only means anything against one
  // particular board, so a selection that does not name this one is not a
  // selection at all.
  const board = draw ? boardIdentity(draw.key, draw.config.seed) : null;
  const drawnSize = draw?.config.roster.length ?? 0;

  // Resolved here rather than reconciled in an effect, so that a redraw is
  // nobody selected in the very same render the new board arrives in. An
  // effect would run a frame late, which is a frame of the previous board's
  // index read against the new board's Roster — a stranger's evening at best,
  // and an index off the end of a shorter Roster at worst.
  const selected =
    found && found.board === board && found.player < drawnSize
      ? found.player
      : null;

  // Storage is read in an effect and never during render: it does not exist on
  // the server, and reading it while rendering hydrates a different tree than
  // the server sent. Keyed on the board because that is what a selection
  // belongs to — a restored board brings its selection back with it.
  useEffect(() => {
    if (!board) return;
    const player = loadSelection(board, drawnSize);
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store when the board changes */
    setFound(player === null ? null : { board, player });
  }, [board, drawnSize]);

  /**
   * Tapping a name pulls that Player's evening out of the grid; tapping the
   * same name again puts the whole board back, which is the one action that
   * clears it and the reason the phone can be handed to the next person.
   *
   * Written through on the tap rather than debounced: this is one small value
   * and the moment it is worth keeping is the moment the phone goes back in a
   * pocket.
   */
  const selectPlayer = (player: PlayerIndex) => {
    if (!board) return;
    const next = selected === player ? null : player;
    setFound(next === null ? null : { board, player: next });
    if (next === null) clearSelection(board);
    else saveSelection(board, next);
  };

  const editRoster = (next: string) => {
    setText(next);
    setRoster((previous) => parseRoster(next, previous));
    // Typing gives up the cleared list. By then the board may have been drawn
    // from different names, and putting the old ones back beside it would be
    // offering to undo something that is no longer what happened.
    setCleared(null);
  };

  /**
   * Emptying the box is how an organizer says the list is finished with, and
   * on a phone doing it by hand is a long-press, a select-all and a delete. It
   * is one press here, and the press that undoes it is the same button.
   *
   * No confirmation: this is an edit to a text box, and a dialog in front of
   * every one of them would be heavier than the thing it guards and dismissed
   * unread by the time it mattered. What answers a mistake is the undo, and
   * for the undo to be worth more than a dialog it has to survive the tab —
   * which is why the save is left alone while it stands, and only overwritten
   * once the organizer types and the list is genuinely finished with.
   */
  const clearRoster = () => {
    setCleared({ text, roster });
    setText("");
    setRoster([]);
  };

  const restoreRoster = () => {
    if (!cleared) return;
    setText(cleared.text);
    setRoster(cleared.roster);
    setCleared(null);
  };

  const size = roster.length;
  const supported = isSupportedRosterSize(size);
  const courtCeiling = maxCourts(size);
  // The fields show what the engine will actually use, which is the same clamp
  // `generateSchedule` applies rather than a second opinion beside it. A null
  // choice is an untouched or emptied field, and means the default.
  const { courts, rounds } = useMemo(
    () =>
      resolveNumbers(
        size,
        courtsChoice ?? undefined,
        roundsChoice ?? undefined,
      ),
    [size, courtsChoice, roundsChoice],
  );

  const repeated = duplicateNames(roster);
  const shape = { players: size, courts, rounds };
  // The consequence line stays on the screen at every Roster size, including
  // the sizes with no Config to describe: a Roster on its way to eleven names
  // passes through them, and going quiet there is going quiet exactly when the
  // organizer is least sure what they have.
  const consequence = supported
    ? describeConfig(shape)
    : describeUnsupportedRoster(size);
  const key = drawKey(roster, courts, rounds);
  const stale = draw !== null && draw.key !== key;

  const generate = () => {
    setDraw(
      drawFrom({ roster, courts, rounds, seed: nextSeed(draw?.config.seed) }),
    );
  };

  return (
    // The board fills the frame — aluminium surround, enamel face, pen tray
    // along the bottom. There is deliberately no page around it and no
    // max-width: this is an object on a wall, not a document on a background.
    <div className="mm-sheet">
      <div className="mm-face mm-fixings">
        {/* The head runs the full width of the board rather than stacking in
            the left column: at desktop that column is 15.5rem, and a header
            confined to it leaves the top third of the enamel empty. Plate and
            particulars on the left, what this is on the right. */}
        <header className="mm-head">
          {/* Plate and particulars on one line, the way a board carries its
              title and its date. */}
          <div className="mm-headline">
            {/* The club plate: vinyl applied to the enamel, type knocked out
                of it. `h1` because it is the page's name, however it is
                made. */}
            <h1 className="mm-title">Match Mixer</h1>
            {/* The board's own particulars: what is on it, not what is
                currently in the roster box. When the two disagree the board is
                stale, and the flag over the field says so — this line staying
                with the draw is what makes that reading possible.

                The Seed that produced the draw is deliberately not here, and
                the link is why it stays away: it is load-bearing in the
                Config, but on the board it is an unexplained number the
                organizer can do nothing with. The reachable use for it turned
                out to be the link that carries it, not the number. */}
            <p className="mm-meta">
              Pickleball round robin
              {draw ? ` · ${draw.numbers}` : null}
            </p>
          </div>
          {/* The old standfirst ended "Nothing is sent anywhere", which a link
              carrying twelve names makes untrue in the way a reader would take
              it: a chat client fetches a pasted URL to build its preview, so
              posting one puts the names in a request log without anyone
              clicking it. What is still true is the part worth promising, and
              the share control says the rest where it is relevant. */}
          <p className="mm-lede">
            Paste the names you have tonight and get a doubles rotation where
            nobody partners the same person twice. Your list stays in this
            browser and waits here for next week. There is no account to make
            and no database behind this: nothing you type is kept on a server.
          </p>
        </header>

        <div className="mm-cols">
          {/* Named so the print stylesheet can take the whole column off the
              page in one rule — everything in it is an edit, and nothing you
              can edit belongs on paper. */}
          <div className="mm-controls">
            <div className="mm-field-head">
              <label className="mm-legend" htmlFor="mm-roster">
                Tonight
              </label>
              {/* One button rather than two swapped in and out, so pressing
                  Clear leaves the focus on the control that undoes it. */}
              {size > 0 || cleared ? (
                <button
                  type="button"
                  className="mm-quiet"
                  onClick={cleared ? restoreRoster : clearRoster}
                >
                  {cleared
                    ? `Put ${countNames(cleared.roster.length)} back`
                    : "Clear"}
                </button>
              ) : null}
            </div>
            <textarea
              id="mm-roster"
              className="mm-input h-48 w-full resize-y p-2.5 sm:h-64"
              value={text}
              onChange={(event) => editRoster(event.target.value)}
              placeholder={EXAMPLE_ROSTER}
              spellCheck={false}
              aria-describedby="mm-roster-note"
            />
            <p id="mm-roster-note" className="mm-note mt-2">
              One name per line, {MIN_ROSTER_SIZE} to {MAX_ROSTER_SIZE} players.
            </p>
            <DuplicateNotice names={repeated} />

            {supported ? (
              <div className="mm-fields mt-6">
                <NumberField
                  id="mm-courts"
                  label="Courts"
                  value={courts}
                  min={1}
                  max={courtCeiling}
                  onChange={setCourtsChoice}
                  note={
                    courtCeiling === 1
                      ? `${size} players fill one court.`
                      : `Up to ${courtCeiling} with ${size} players.`
                  }
                />
                <NumberField
                  id="mm-rounds"
                  label="Rounds"
                  value={rounds}
                  min={1}
                  max={MAX_ROUNDS}
                  onChange={setRoundsChoice}
                  note="How many you have court time for."
                />
              </div>
            ) : null}

            {/* The fast speed: pure arithmetic, so it can afford to keep up
                with the keystrokes the Schedule deliberately does not. Neither
                this nor the note under the button is announced live: both move
                on every keystroke, and a screen reader reading them per
                character is worse than silence. The note is tied to the button
                instead, so it is read when the button is reached. */}
            {size > 0 ? <p className="mm-note mt-6">{consequence}</p> : null}

            <button
              type="button"
              className="mm-button mt-3"
              onClick={generate}
              disabled={!supported}
              data-stale={stale ? "true" : undefined}
              aria-describedby="mm-action-note"
            >
              {!draw ? "Make the board" : stale ? "Redraw the board" : "Wipe & redraw"}
            </button>
            <p className="mm-note mt-2" id="mm-action-note">
              <ActionNote draw={draw} stale={stale} size={size} />
            </p>

            {/* Keyed on the Seed so a redraw starts a fresh confirmation: the
                board underneath it has changed, and "copied" left standing
                over a different board is the one thing this control must not
                say. */}
            {draw ? (
              <ShareBoard key={draw.config.seed} config={draw.config} />
            ) : null}
          </div>

          <div className="min-w-0">
            {draw ? (
              <>
                {/* Provenance, not staleness: this board was drawn just now,
                    with the current generator — it says the link that brought
                    it here predates a change that may have moved what that
                    link's numbers produce (#494). Plain text in the flow
                    rather than a badge, so a screen reader meets it too, and
                    it says so regardless of `stale`: editing further doesn't
                    make the mismatch any less true of the board still on
                    screen. */}
                {draw.outdated ? (
                  <p className="mm-notice mb-4">
                    This link was made before a change to how boards are
                    generated, so the board below may not match the one that
                    was shared. This is today&rsquo;s board for the same
                    names and numbers.
                  </p>
                ) : null}
                {/* What changed, not what it was drawn from: the head already
                    carries the board's own particulars, so repeating them here
                    would say the same thing twice and leave the organizer to
                    work out the difference themselves. */}
                {stale ? (
                  <p className="mm-flag">
                    Superseded · you now have{" "}
                    {describeNumbers({ players: size, courts, rounds })}
                  </p>
                ) : null}
                {/* Keyed on the Seed so a new draw remounts the field: that is
                    what starts the wipe and the settle, which are CSS
                    animations and run on mount. Nothing in this component
                    drives a frame of them. */}
                <div
                  key={draw.config.seed}
                  className="mm-draw"
                  data-stale={stale ? "true" : undefined}
                >
                  {stale ? null : <span className="mm-wipe" aria-hidden />}
                  <ScheduleGrid
                    roster={draw.config.roster}
                    schedule={draw.schedule}
                    score={draw.score}
                    selected={selected}
                    onSelect={selectPlayer}
                  />
                </div>
              </>
            ) : size > MAX_ROSTER_SIZE ? (
              <TooManyPlayers size={size} />
            ) : (
              <ExampleSheet supported={supported} />
            )}
          </div>
        </div>
      </div>

      {/* The tray. It carries no control and says nothing the screen needs —
          it is here because a board without one is a rectangle, and this is
          the edge that tells you which way up the object is. */}
      <div className="mm-tray" aria-hidden>
        {/* Red is the one kept on a narrow tray: it is the colour the repeat
            rings and the draw magnet are drawn in, so it is the marker that
            explains the board. */}
        <span className="mm-pen" data-ink="black" data-tray-extra />
        <span className="mm-pen" data-ink="red" />
        <span className="mm-magnet" />
        <span className="mm-magnet" data-tray-extra />
        <span className="mm-tray-mark">Juice Bros Pickleball</span>
      </div>
    </div>
  );
}

/**
 * What pressing the button will do to what is on screen. The label says the
 * action, this says the consequence, and while the button is disabled it says
 * that there is no action rather than restating the count: the consequence
 * line above already has that, and two places saying it is one place to go
 * stale.
 */
function ActionNote({
  draw,
  stale,
  size,
}: {
  draw: Draw | null;
  stale: boolean;
  size: number;
}) {
  if (size === 0) return <>Paste your names above, then make the board.</>;
  if (size < MIN_ROSTER_SIZE) return <>Nothing to draw until there are four.</>;
  if (size > MAX_ROSTER_SIZE)
    return <>Nothing to draw until the roster fits.</>;
  if (stale)
    return <>The board on screen is the previous draw, not this one.</>;
  if (draw) return <>Same names, same numbers, a different draw.</>;
  return <>Nothing is generated until you press it.</>;
}

/** How the copy went, which is the whole reason this control has a voice. */
type CopyOutcome = "waiting" | "copied" | "refused" | "byhand";

/**
 * Everything an outcome decides, in one place: what it says, what colour it
 * says it in, whether it clears itself, and whether the link goes on screen to
 * be copied by hand. Held as a table rather than three cascades, so a fifth
 * outcome is one row instead of an edit in three functions that must agree.
 *
 * `tone` is the board's existing pass/fail vocabulary — the same green and red
 * the summary line reads in — so an outcome needs no icon of its own.
 */
const COPY_OUTCOMES: Record<
  CopyOutcome,
  {
    tone?: "done" | "refused";
    note: ReactNode;
    /** Clears itself after a moment: a confirmed action, not a state. */
    passing?: boolean;
    /** Puts the link on screen, because the clipboard did not take it. */
    showLink?: boolean;
  }
> = {
  waiting: { note: null },
  copied: {
    tone: "done",
    note: "Copied. Paste it into the group chat.",
    passing: true,
  },
  refused: {
    tone: "refused",
    note: "This roster is too long to fit in a link. Shorten the names, or print the board and pin it up.",
  },
  byhand: {
    tone: "refused",
    note: "This browser kept the clipboard to itself. Copy it from here:",
    showLink: true,
  },
};

/**
 * Handing the board round.
 *
 * The link carries the Config and nothing else; the board is generated again
 * in whoever's browser opens it (ADR 0001). So this is a plate you take off
 * the board and pass over, not an upload — card stock rather than the red
 * magnet, which stays the one control on the screen that draws.
 *
 * It confirms. An organizer who copies, walks to the chat and pastes an empty
 * clipboard finds out from twelve confused replies, so silence is not an
 * option here even though the copy almost always works. When it does not —
 * an insecure origin, a browser that will not hand the page the clipboard —
 * the link is put on screen to be copied by hand rather than lost.
 */
function ShareBoard({ config }: { config: ResolvedConfig }) {
  const [outcome, setOutcome] = useState<CopyOutcome>("waiting");
  const [link, setLink] = useState<string | null>(null);
  const said = COPY_OUTCOMES[outcome];

  // The confirmation stands for a few seconds and then goes, because what it
  // is confirming is an action and not a state: a permanent "copied" would go
  // on saying it long after the organizer had pasted, edited and come back.
  // A refusal stays — it is a condition, and it is still true.
  useEffect(() => {
    if (!said.passing) return;
    const timer = setTimeout(() => setOutcome("waiting"), 5000);
    return () => clearTimeout(timer);
  }, [said]);

  const copy = async () => {
    const href = encodeShareLink(config, window.location.href);
    if (!href) {
      setLink(null);
      setOutcome("refused");
      return;
    }
    setLink(href);
    try {
      await navigator.clipboard.writeText(href);
      setOutcome("copied");
    } catch {
      setOutcome("byhand");
    }
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        className="mm-share"
        onClick={copy}
        aria-describedby="mm-share-note"
      >
        Copy the link to this board
      </button>
      <p className="mm-note mt-2" id="mm-share-note">
        The names travel inside the link, so whoever opens it reads them.
      </p>
      {/* Live rather than a label swap on the button, so the confirmation is
          announced without the label under the finger changing as it is
          pressed. Empty while there is nothing to say. */}
      <p className="mm-note mt-2" role="status" data-tone={said.tone}>
        {said.note}
      </p>
      {said.showLink && link ? (
        <input
          className="mm-input mt-2 w-full px-2 py-1 text-xs"
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Link to this board"
        />
      ) : null}
    </div>
  );
}

/**
 * Two players called Mike is a printing problem, not a scheduling one: the
 * engine tells them apart by id and the Schedule comes out the same. So this
 * says what will actually go wrong and gets out of the way.
 */
function DuplicateNotice({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  return (
    <p className="mm-notice mt-4">
      {names.length === 1
        ? `More than one player named ${names[0]}.`
        : `These names are on the list more than once: ${names.join(", ")}.`}{" "}
      The schedule still works. The board just won&rsquo;t tell them apart.
    </p>
  );
}

/**
 * The zero state: the board with somebody else's night still on it. A real
 * schedule, generated the way any other one is, says what this page produces
 * better than a sentence about it does — and leaves the field holding
 * something rather than nothing.
 *
 * Held back by moving the ink and flattening the plates against the enamel
 * rather than by opacity, so the hairlines stay hairlines; the dashed rule and
 * the caption say specimen.
 */
function ExampleSheet({ supported }: { supported: boolean }) {
  return (
    <section aria-labelledby="mm-example-caption">
      <p className="mm-legend mm-rail" id="mm-example-caption">
        Last week&rsquo;s board
      </p>
      <p className="mm-note">
        {supported
          ? "Eight names, two courts, four rounds. Yours takes its place as soon as you draw it."
          : "Eight names, two courts, four rounds. This is the shape of what you get."}
      </p>
      {/* The specimen stays out of the accessibility tree: a second full
          schedule read out in order is noise, and the caption above already
          says what it is. Its own rail is hidden with it, so the field runs
          straight on from the caption rather than carrying two. */}
      <div className="mm-example mt-4" aria-hidden="true" inert>
        <ScheduleGrid
          roster={EXAMPLE.roster}
          schedule={EXAMPLE.schedule}
          score={EXAMPLE.score}
          headingId="mm-example-heading"
          headingHidden
        />
      </div>
    </section>
  );
}

function TooManyPlayers({ size }: { size: number }) {
  return (
    <div className="mm-placeholder">
      <p className="mm-placeholder-head">{size} names: too many for one board</p>
      <p className="mm-note mt-2">
        Match Mixer schedules up to {MAX_ROSTER_SIZE} players. Above that the
        field stops fitting a board and the search stops being quick, and a
        night that size is better split into two rotations. Remove{" "}
        {size - MAX_ROSTER_SIZE}.
      </p>
    </div>
  );
}

/**
 * The field shows the value the engine will actually use, so a number the
 * Roster cannot support snaps back to the ceiling the moment it is typed
 * rather than generating something the Roster cannot seat.
 *
 * An emptied field is the one thing that cannot snap back, because backspacing
 * to nothing is how you start typing a different number. It is held as a draft
 * for as long as the field has focus, means "the default" while it is empty,
 * and gives way to the real value on blur.
 */
function NumberField({
  id,
  label,
  value,
  min,
  max,
  note,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  note: string;
  onChange: (next: number | null) => void;
}) {
  const [emptied, setEmptied] = useState(false);

  return (
    <div>
      <label className="mm-legend block" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="mm-input mm-number mt-1.5"
        value={emptied ? "" : value}
        min={min}
        max={max}
        onChange={(event) => {
          const raw = event.target.value;
          const next = Number.parseInt(raw, 10);
          setEmptied(raw === "");
          if (raw === "" || !Number.isNaN(next))
            onChange(raw === "" ? null : next);
        }}
        onBlur={() => setEmptied(false)}
        aria-describedby={`${id}-note`}
      />
      <p id={`${id}-note`} className="mm-note mt-2">
        {note}
      </p>
    </div>
  );
}
