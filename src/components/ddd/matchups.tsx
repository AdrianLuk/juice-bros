"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import type { LiveReader, LiveWriter } from "@/lib/ddd/actions/live";
import { moveGame, swapCourtTurns } from "@/lib/ddd/actions/courts";
import { callMatchup, clearCall, clearGame, saveGame } from "@/lib/ddd/actions/matchups";
import { placeMatchup, type PlacedGame } from "@/lib/ddd/courts";
import { seedTeams, STATUS_LABEL } from "@/lib/ddd/dreambreakers";
import { PLACES, type LinkEvent } from "@/lib/ddd/events";
import { GAME_LABEL, readLineup } from "@/lib/ddd/lineup";
import {
  doublesMatchups,
  finalPlaces,
  MAX_REASON,
  shotLines,
  shotTotals,
  tally,
  type Matchup,
  type ShotLine,
  type MatchupGame,
  type MatchupKey,
} from "@/lib/ddd/matchups";
import { spreadsPath } from "@/lib/ddd/routes";
import { pairOf } from "@/lib/ddd/spreads";
import { useDddLive } from "./use-ddd-live";
import { useWrite } from "./use-write";

type Team = LinkEvent["teams"][number];

// What a Matchup is for, under its Teams. The round is the band heading above it.
const MATCHUP_NOTE: Record<MatchupKey, string> = {
  "round2-1v4": "Seed 1 v Seed 4",
  "round2-2v3": "Seed 2 v Seed 3",
  "playoff-1st": "For 1st and 2nd",
  "playoff-3rd": "For 3rd and 4th",
};

export const shotWord = (n: number) => (n === 1 ? "shot" : "shots");

/** True once `value` differs from what it was when the row first drew, so only what lands live prints on. */
function useChangedSinceMount<T>(value: T): boolean {
  const [first] = useState(value);
  return value !== first;
}

/** A shot count that ticks when it moves (`ddd-tick`); the key replays it on every change. */
function Ticker({ n, className }: { n: number; className: string }) {
  const moved = useChangedSinceMount(n);
  return (
    <span key={n} className={moved ? `${className} ddd-tick` : className}>
      {n}
    </span>
  );
}

/** OPEN while a settled tab has shots to drink, PAID when it has none. */
export function Stamp({ shots }: { shots: number }) {
  return shots > 0 ? <span className="ddd-stamp ddd-stamp-open">Open</span> : <span className="ddd-stamp ddd-stamp-paid">Paid</span>;
}

/** The Organizer's own page (#716): one live read, then the doubles with the Organizer's powers. */
export function Matchups({ reader, initial }: { reader: LiveReader; initial: LinkEvent }) {
  const { event, refresh } = useDddLive(reader, initial);
  return (
    <div className="ddd-stack-lg">
      <Doubles event={event} writer={{ kind: "organizer" }} onSaved={refresh} />
    </div>
  );
}

/**
 * Round 2 and the Playoff (#716): every Team's shots, then each Matchup's
 * four Games against their Spreads. Nothing shows until the Seeding is
 * final. The Score Link and an Organizer enter finals; an Organizer also
 * clears them and makes the call on a 2-2.
 */
export function Doubles({ event, writer, onSaved }: { event: LinkEvent; writer: LiveWriter | null; onSaved: () => void }) {
  const teamIds = event.teams.map((team) => team.id);
  const seeds = seedTeams(teamIds, event.dreambreakers, event.tieOrder);
  const matchups = doublesMatchups(seeds, { spreads: event.spreads, games: event.games, calls: event.calls });
  if (matchups.length === 0) {
    return writer?.kind === "organizer" ? (
      <p className="ddd-slip ddd-notice">Round 2 starts once all six Dreambreakers are in and the Seeding is final.</p>
    ) : null;
  }

  const teamOf = (id: string) => event.teams.find((team) => team.id === id)!;
  const totals = shotTotals(teamIds, matchups);
  const places = finalPlaces(matchups);
  const order = places ?? seeds.map((seed) => seed.teamId);
  const rounds: [string, string, Matchup[]][] = [
    ["ddd-playoff", "Playoff", matchups.filter((m) => m.key === "playoff-1st" || m.key === "playoff-3rd")],
    ["ddd-round-2", "Round 2", matchups.filter((m) => m.key === "round2-1v4" || m.key === "round2-2v3")],
  ];

  return (
    <>
      {/* ddd-settled turns the ground deep green once the Playoff is final. */}
      <section className={`ddd-slip ddd-section ddd-standings${places ? " ddd-settled" : ""}`} aria-labelledby="ddd-standings">
        <h2 id="ddd-standings" className="ddd-slip-head">
          {places ? "Final places" : "Shots so far"}
        </h2>
        <ol className="ddd-seeds">
          {order.map((id, index) => (
            <TabRow
              key={id}
              team={teamOf(id)}
              note={places ? `${PLACES[index]} · ${event.punishments[index]}` : `Seed ${index + 1}`}
              place={places ? index + 1 : null}
              total={totals[id]}
              lines={shotLines(id, matchups)}
              teamOf={teamOf}
            />
          ))}
        </ol>
      </section>
      {rounds.map(([id, title, list]) =>
        list.length === 0 ? null : (
          <section key={id} className="ddd-stack ddd-round" aria-labelledby={id}>
            <h2 id={id} className="ddd-on-green ddd-band-head">
              {title}
            </h2>
            {list.map((m) => (
              <MatchupCard key={m.key} matchup={m} event={event} a={teamOf(m.a)} b={teamOf(m.b)} writer={writer} onSaved={onSaved} />
            ))}
          </section>
        ),
      )}
    </>
  );
}

/** A Team's tab in the standings: tap the shot total for the Games that ran it up. */
function TabRow({
  team,
  note,
  place,
  total,
  lines,
  teamOf,
}: {
  team: Team;
  note: string;
  place: number | null;
  total: number;
  lines: ShotLine[];
  teamOf: (id: string) => Team;
}) {
  const [open, setOpen] = useState(false);
  const listId = `ddd-tab-lines-${team.id}`;
  const totalText = (
    <>
      <Ticker n={total} className="ddd-tab-n" /> {shotWord(total)}
    </>
  );

  return (
    <li className="ddd-seed ddd-tab-row" aria-label={`Tab: ${team.name}`}>
      {place ? <span className="ddd-seed-n">{place}</span> : null}
      <div className="ddd-seed-body">
        <p className="ddd-seed-name">{team.name}</p>
        <p className="ddd-note">{note}</p>
      </div>
      <div className="ddd-tab-owed">
        {lines.length === 0 ? (
          <p className="ddd-tab-total">{totalText}</p>
        ) : (
          <button
            type="button"
            className="ddd-tab-total"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen(!open)}
          >
            {totalText}
          </button>
        )}
        {place ? <Stamp shots={total} /> : null}
      </div>
      {open && lines.length > 0 ? (
        <ol id={listId} className="ddd-tab-lines" aria-label={`${team.name}'s shots, Game by Game`}>
          {lines.map((line) => {
            const opponent = teamOf(line.opponent);
            return (
              <li key={`${line.key}-${line.game}`}>
                <p>
                  <span className="ddd-db-team">
                    {GAME_LABEL[line.game]} v {opponent.name}
                  </span>{" "}
                  <span className="ddd-shots">
                    {line.shots} {shotWord(line.shots)}
                  </span>
                </p>
                <p className="ddd-note">
                  {line.score[0]}-{line.score[1]} · Spread {line.spread.points.toFixed(1)} on{" "}
                  {pairOf(line.spread.ours ? team : opponent, line.game)}
                </p>
              </li>
            );
          })}
        </ol>
      ) : null}
    </li>
  );
}

/** A Team's saved Lineup, or null before it is in. */
function lineupOf(team: Team) {
  return readLineup(team.players, team.lineup);
}

function outcomeText(m: Matchup, a: Team, b: Team): { text: string; open: boolean } {
  const o = m.outcome;
  if (!o) {
    const { wins } = tally(m.games);
    return { text: `Spread winners so far: ${a.name} ${wins[0]}, ${b.name} ${wins[1]}.`, open: false };
  }
  const winner = o.winner === "a" ? a.name : b.name;
  const [high, low] = [Math.max(...o.wins), Math.min(...o.wins)];
  switch (o.rule) {
    case "spreadWins":
      return { text: `${winner} wins, ${high}-${low} on Spread winners.`, open: false };
    case "margin":
      return { text: `${winner} wins 2-2 on Spread margin, by ${Math.abs(o.margin).toFixed(1)}.`, open: false };
    case "points":
      return {
        text: `${winner} wins 2-2 on points, ${Math.max(...o.points)} to ${Math.min(...o.points)}. Spread margin was level.`,
        open: false,
      };
    case "organizer":
      return { text: `${winner} wins 2-2 on an Organizer's call: ${o.reason}`, open: false };
    case "unresolved":
      return { text: "2-2, level on Spread margin and on points. An Organizer makes the call.", open: true };
  }
}

function MatchupCard({
  matchup,
  event,
  a,
  b,
  writer,
  onSaved,
}: {
  matchup: Matchup;
  event: LinkEvent;
  a: Team;
  b: Team;
  writer: LiveWriter | null;
  onSaved: () => void;
}) {
  const { shots } = tally(matchup.games);
  const outcome = outcomeText(matchup, a, b);
  // The Spreads editor heads each pairing with its Teams in roster order.
  const [first, second] = event.teams.indexOf(a) < event.teams.indexOf(b) ? [a, b] : [b, a];
  const setSpread = writer?.kind === "organizer" ? `${spreadsPath(event.id)}#ddd-pairing-${first.id}-${second.id}` : null;
  const twoAll = matchup.outcome?.wins[0] === 2;
  const placed = placeMatchup(matchup, [lineupOf(a), lineupOf(b)], event.courtPlans, event.courts.length);
  const swap = useWrite(onSaved);

  return (
    <article className="ddd-slip ddd-matchup" aria-label={`Matchup: ${a.name} v ${b.name}`}>
      <div>
        <h3 className="ddd-team-name">
          {a.name} v {b.name}
        </h3>
        <p className="ddd-note">{MATCHUP_NOTE[matchup.key]}</p>
      </div>
      <p className={outcome.open ? "ddd-problem" : "ddd-matchup-outcome"}>{outcome.text}</p>
      <ol className="ddd-games">
        {placed.map((place) => (
          <GameRow
            key={place.game}
            game={matchup.games.find((game) => game.game === place.game)!}
            place={place}
            courts={event.courts}
            matchup={matchup}
            a={a}
            b={b}
            writer={writer}
            setSpread={setSpread}
            onSaved={onSaved}
          />
        ))}
      </ol>
      {writer?.kind === "organizer" && placed.some((place) => place.turn > 0) ? (
        <div className="ddd-actions">
          <button
            type="button"
            className="ddd-quiet"
            disabled={swap.pending}
            onClick={() => swap.run(() => swapCourtTurns(matchup.a, matchup.b))}
          >
            Swap which Games play first
          </button>
          <p role="alert" className="ddd-problem empty:hidden">
            {swap.problem}
          </p>
        </div>
      ) : null}
      <p className="ddd-matchup-total">
        <span>
          {a.name}: <Ticker n={shots[0]} className="ddd-shots" /> {shotWord(shots[0])}
        </span>
        <span>
          {b.name}: <Ticker n={shots[1]} className="ddd-shots" /> {shotWord(shots[1])}
        </span>
      </p>
      {writer?.kind === "organizer" && twoAll ? <CallForm matchup={matchup} a={a} b={b} onSaved={onSaved} /> : null}
    </article>
  );
}

function GameRow({
  game,
  place,
  courts,
  matchup,
  a,
  b,
  writer,
  setSpread,
  onSaved,
}: {
  game: MatchupGame;
  place: PlacedGame;
  courts: string[];
  matchup: Matchup;
  a: Team;
  b: Team;
  writer: LiveWriter | null;
  setSpread: string | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, problem, run } = useWrite(onSaved);
  const label = GAME_LABEL[game.game];
  const pairs = [pairOf(a, game.game), pairOf(b, game.game)];
  const teams = [a, b];
  const side = (s: "a" | "b") => (s === "a" ? 0 : 1);
  // Only what is On now opens with a score form; a later Game can still be entered early, one tap in.
  const showForm = writer !== null && game.spread !== null && ((game.score === null && place.status === "now") || editing);
  const id = `${matchup.a}-${matchup.b}-${game.game}`;
  const justScored = useChangedSinceMount(game.result !== null);

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    const [scoreA, scoreB] = [Number(data.get("scoreA")), Number(data.get("scoreB"))];
    run(() => saveGame(writer!, matchup.a, matchup.b, game.game, scoreA, scoreB), () => setEditing(false));
  }

  return (
    <li className={`ddd-game ddd-db-${place.status}`} aria-label={label}>
      <p className="ddd-db-status">
        <span>{label}</span>
        <span>
          <span className="ddd-game-status">{STATUS_LABEL[place.status]}</span>{" "}
          <span className="ddd-db-court">Court {courts[place.court] ?? place.court + 1}</span>
        </span>
      </p>
      {writer?.kind === "organizer" && place.status !== "final" ? (
        <div className="ddd-field ddd-move">
          <label htmlFor={`${id}-court`}>Court</label>
          <select
            id={`${id}-court`}
            value={place.court}
            disabled={pending}
            onChange={(change) => run(() => moveGame(matchup.a, matchup.b, game.game, Number(change.target.value)))}
          >
            {courts.map((court, index) => (
              <option key={court} value={index}>
                Court {court}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="ddd-db-score">
        {[0, 1].map((i) => (
          <p key={i}>
            <span className="ddd-db-team">
              {pairs[i]}
              <span className="ddd-pair-team">{teams[i].name}</span>
            </span>
            <span className="ddd-db-points">{game.score ? game.score[i] : ""}</span>
          </p>
        ))}
      </div>
      {game.spread ? (
        <p className="ddd-note">
          Spread {game.spread.points.toFixed(1)} on {pairs[side(game.spread.lower)]}.
        </p>
      ) : (
        <p className="ddd-problem">
          Spread needed before this Game is scored.{" "}
          {setSpread ? (
            <Link href={setSpread} className="ddd-quiet">
              Set the Spread
            </Link>
          ) : null}
        </p>
      )}
      {game.result ? (
        // The line item this Game rings up: who beat the Spread, by how much, and the shots it costs whom.
        <p className={justScored ? "ddd-ledger ddd-print" : "ddd-ledger"}>
          <span className="ddd-ledger-who">
            Spread winner {pairs[side(game.result.spreadWinner)]}
            <span className="ddd-pair-team">{teams[side(game.result.spreadWinner)].name}</span>
          </span>
          <span className="ddd-ledger-by">by {Math.abs(game.result.margin).toFixed(1)}</span>
          <span className="ddd-shots">
            {game.result.shots} {shotWord(game.result.shots)} on {teams[side(game.result.shotsOn)].name}
          </span>
        </p>
      ) : null}

      {showForm ? (
        <form className="ddd-db-form" onSubmit={submit} aria-label={`Final score, ${label}`}>
          {[0, 1].map((i) => (
            <div key={i} className="ddd-field">
              <label htmlFor={`${id}-${i}`}>{teams[i].name} points</label>
              <input
                id={`${id}-${i}`}
                name={i === 0 ? "scoreA" : "scoreB"}
                type="number"
                inputMode="numeric"
                min={0}
                required
                defaultValue={game.score?.[i]}
              />
            </div>
          ))}
          <div className="ddd-actions">
            <button type="submit" className="ddd-btn" disabled={pending}>
              {pending ? "Saving…" : "Save final"}
            </button>
            {editing ? (
              <button type="button" className="ddd-quiet" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {writer && game.spread && !game.score && !showForm ? (
        <div className="ddd-actions">
          <button type="button" className="ddd-quiet" onClick={() => setEditing(true)}>
            Enter its final
          </button>
        </div>
      ) : null}

      {writer && game.score && !editing ? (
        <div className="ddd-actions">
          <button type="button" className="ddd-quiet" onClick={() => setEditing(true)}>
            Correct the score
          </button>
          {writer.kind === "organizer" ? (
            <button
              type="button"
              className="ddd-quiet"
              disabled={pending}
              onClick={() => run(() => clearGame(matchup.a, matchup.b, game.game))}
            >
              Clear it
            </button>
          ) : null}
        </div>
      ) : null}
      <p role="alert" className="ddd-problem empty:hidden">
        {problem}
      </p>
    </li>
  );
}

/** An Organizer's call on a 2-2: who won and why, or taking it back. */
function CallForm({ matchup, a, b, onSaved }: { matchup: Matchup; a: Team; b: Team; onSaved: () => void }) {
  const { pending, problem, run } = useWrite(onSaved);
  const called = matchup.outcome?.rule === "organizer";

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    run(() => callMatchup(matchup.a, matchup.b, String(data.get("winner")), String(data.get("reason") ?? "")));
  }

  return (
    <div className="ddd-call">
      {called ? (
        <div className="ddd-actions">
          <button type="button" className="ddd-quiet" disabled={pending} onClick={() => run(() => clearCall(matchup.a, matchup.b))}>
            Take the call back
          </button>
        </div>
      ) : (
        <form className="ddd-stack" onSubmit={submit} aria-label="Organizer's call">
          <p className="ddd-note">A 2-2 can go either way. Pick the winner and say why: the reason shows on the Matchup.</p>
          <div className="ddd-field">
            <label htmlFor={`${matchup.key}-winner`}>Winner</label>
            <select id={`${matchup.key}-winner`} name="winner" defaultValue={matchup.outcome?.winner === "b" ? matchup.b : matchup.a}>
              <option value={matchup.a}>{a.name}</option>
              <option value={matchup.b}>{b.name}</option>
            </select>
          </div>
          <div className="ddd-field">
            <label htmlFor={`${matchup.key}-reason`}>Reason</label>
            <input id={`${matchup.key}-reason`} name="reason" maxLength={MAX_REASON} autoComplete="off" />
          </div>
          <div className="ddd-actions">
            <button type="submit" className="ddd-btn" disabled={pending}>
              {pending ? "Saving…" : "Save the call"}
            </button>
          </div>
        </form>
      )}
      <p role="alert" className="ddd-problem empty:hidden">
        {problem}
      </p>
    </div>
  );
}
