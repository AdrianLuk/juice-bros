"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { courtLabel } from "@/components/apps/match-mixer/lib/court-labels";
import { locate, poolName } from "@/components/apps/match-mixer/lib/engine/pools";
import type { PlayerIndex } from "@/components/apps/match-mixer/lib/engine/types";
import { gameKey, type GameAt } from "@/components/apps/match-mixer/lib/live/events";
import { describeGameRule, type GameRule, type GameScore } from "@/components/apps/match-mixer/lib/live/game-rule";
import {
  gameOn,
  playerAccess,
  rebuild,
  roundCount,
  runsTheNight,
  type GameAccess,
  type RebuiltMixer,
} from "@/components/apps/match-mixer/lib/live/rebuild";
import {
  boardIdentity,
  clear as clearSelection,
  load as loadSelection,
  save as saveSelection,
} from "@/components/apps/match-mixer/lib/persistence/selection-storage";
import { changeGameRule, clearScore, enterScore, finishMixer, startRound } from "@/lib/match-mixer/actions";
import type { LiveMixer, Outcome } from "@/lib/match-mixer/live-mixers";

import { GameRulePicker } from "./game-rule-picker";
import { QueryProvider } from "./query-provider";
import { ScheduleGrid, type Band, type BandPlayer } from "./schedule-grid";
import { ScoreSheet, type SheetGame } from "./score-sheet";
import { StandingsTables } from "./standings-tables";
import { liveMixerKey, useLiveMixer } from "./use-live-mixer";

/**
 * A Live Mixer's board, as its Organizer Link or Player Link opens it (#687,
 * #688). Redrawn from the stored Config exactly as an opened Share Link is
 * (ADR 0001, ADR 0006): the Schedule is never stored. Scores and Standings
 * come from the event log and stay current on every phone. Find-me works as
 * it does on the tool itself, and a Selection made here is the same Selection.
 *
 * The Organizer Link also scores any Game, starts the next Round, sets the
 * Game Rule and finishes the night. The Player Link scores its Selection's
 * own Games, up to the Current Round (#689). A signed-in superadmin runs the
 * night through either link, finished or not (#690). A finished Live Mixer
 * shows its final scores and Standings and takes no writes from anyone else.
 */
export function LiveBoard(props: {
  token: string;
  initial: LiveMixer;
  playerPath: string;
  /** The Organizer Link's own page only. */
  organizerPath?: string;
}) {
  return (
    <QueryProvider>
      <LiveSheet {...props} />
    </QueryProvider>
  );
}

function LiveSheet({
  token,
  initial,
  playerPath,
  organizerPath,
}: {
  token: string;
  initial: LiveMixer;
  playerPath: string;
  organizerPath?: string;
}) {
  const { mixer, reconnecting } = useLiveMixer(token, initial);
  const live = useMemo(() => rebuild(mixer.config, mixer.events), [mixer.config, mixer.events]);

  if (!live) {
    return (
      <div className="mm-sheet">
        <div className="mm-face mm-fixings">
          <h1 className="mm-title">Match Mixer</h1>
          <p className="mm-notice mt-6">
            This version of Match Mixer can&rsquo;t redraw this board. Ask the organizer to make it again and go live.
          </p>
        </div>
      </div>
    );
  }

  // The server checks the same rule again on every write.
  const runner = runsTheNight(mixer) ? { playerPath, organizerPath, superadmin: mixer.superadmin } : null;
  const night: Night = mixer.finishedAt === null ? "running" : mixer.superadmin ? "fixing" : "finished";
  return <LiveFace token={token} live={live} reconnecting={reconnecting} runner={runner} night={night} />;
}

/**
 * "fixing": finished, but open to the superadmin, who can still change
 * anything. "finished": final for everyone else.
 */
type Night = "running" | "finished" | "fixing";

/** Whoever runs the night on this screen: the Organizer Link, or a superadmin on either link. */
type Runner = { playerPath: string; organizerPath?: string; superadmin: boolean };

function LiveFace({
  token,
  live,
  reconnecting,
  runner,
  night,
}: {
  token: string;
  live: RebuiltMixer;
  reconnecting: boolean;
  /** Null for a player. */
  runner: Runner | null;
  night: Night;
}) {
  const { draw } = live;
  const queryClient = useQueryClient();
  const reread = () => queryClient.invalidateQueries({ queryKey: liveMixerKey(token) });

  // Find-me, as `MatchMixer` does it: a Roster index held against the board
  // it was picked on, resolved to a band on the way in and back on the way out.
  const [found, setFound] = useState<{ board: string; player: PlayerIndex } | null>(null);
  const board = boardIdentity(draw.key, draw.config.seed);
  const size = draw.config.roster.length;
  const selected = found && found.board === board && found.player < size ? found.player : null;

  useEffect(() => {
    const player = loadSelection(board, size);
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store when the board changes */
    setFound(player === null ? null : { board, player });
  }, [board, size]);

  const selectPlayer = (player: PlayerIndex) => {
    const next = selected === player ? null : player;
    setFound(next === null ? null : { board, player: next });
    if (next === null) clearSelection(board);
    else saveSelection(board, next);
  };

  const bands: readonly Band[] = draw.pools.map((pool) => ({
    label: draw.pools.length > 1 ? poolName(pool.label) : null,
    roster: pool.roster,
    schedule: pool.schedule,
    score: pool.score,
  }));
  const located = selected !== null ? locate(draw.pools, selected) : null;
  const bandSelected: BandPlayer | null = located ? { band: located.pool, player: located.index } : null;
  const selectInBand = ({ band, player }: BandPlayer) => {
    const member = draw.pools[band]?.members[player];
    if (member !== undefined) selectPlayer(member);
  };

  // Which Games this link scores (#689): any on the Organizer Link; on the
  // Player Link, the Selection's own, up to the Current Round; none once the
  // night has finished (#690). The server checks the same again.
  const rounds = roundCount(draw);
  // `over`: the night has finished. `finished`: and this screen can't change it.
  const over = night !== "running";
  const finished = night === "finished";
  const access = (at: GameAt): GameAccess =>
    finished
      ? "not-yours"
      : runner
        ? "scores"
        : selected === null
          ? "not-yours"
          : playerAccess(draw, live.currentRound, selected, at);
  const canScore = !finished && (runner !== null || selected !== null);

  // The keypad sheet, open on one Game at a time, and only while this link can score it.
  const [scoring, setScoring] = useState<GameAt | null>(null);
  const sheet = scoring && access(scoring) === "scores" ? sheetFor(live, scoring) : null;
  const afterWrite = async (outcome: Awaited<ReturnType<typeof enterScore>>) => {
    if (outcome.ok) await reread();
    return outcome;
  };
  const selection = runner ? null : selected;

  return (
    <div className="mm-sheet">
      <div className="mm-face mm-fixings">
        <header className="mm-head">
          <div className="mm-headline">
            <h1 className="mm-title">Match Mixer</h1>
            <p className="mm-meta">
              {over ? "Finished" : "Live"} · {draw.numbers}
            </p>
          </div>
          <p className="mm-lede">
            {night === "fixing"
              ? "This Live Mixer has finished. Everyone else sees these scores and Standings as final."
              : finished
                ? "This Live Mixer has finished. The scores and Standings below are final."
                : runner
                  ? "This board is live. Paste the Player Link into the group chat, then tap Score under a Game when it ends. Standings update on every phone."
                  : "Tonight’s board, live from the organizer. Tap your name to see your evening and score your own Games. Standings update on every phone."}
          </p>
        </header>

        <div className="mm-cols">
          <div className="mm-controls">
            {runner?.superadmin ? (
              <p className="mm-note mb-6" role="note">
                {night === "fixing"
                  ? "You’re the superadmin, so you can still change anything on this finished night."
                  : "You’re the superadmin, so you can run this night from any link."}
              </p>
            ) : null}
            {runner ? (
              <>
                {finished ? null : (
                  <>
                    <RoundControl token={token} current={live.currentRound} rounds={rounds} onSaved={reread} />
                    <RuleControl token={token} rule={live.rule} onSaved={reread} />
                  </>
                )}
                <CopyLink
                  id="mm-player-link"
                  label="Player Link"
                  path={runner.playerPath}
                  note={
                    finished
                      ? "Anyone with it sees the board and the final Standings."
                      : "For the group chat. Anyone with it sees the board and the Standings, and can score their own Games."
                  }
                />
                {runner.organizerPath ? (
                  <CopyLink
                    id="mm-organizer-link"
                    label="Organizer Link"
                    path={runner.organizerPath}
                    note="Yours alone. Whoever holds it runs the night."
                  />
                ) : null}
                {over ? null : <FinishControl token={token} onSaved={reread} />}
              </>
            ) : (
              <>
                <p className="mm-legend">Your Games</p>
                <p className="mm-note mt-1" role="status">
                  {finished
                    ? "The night has finished. Tap your name to see how your evening went."
                    : selected === null
                      ? "Tap your name on the board first. Then you can score your own Games."
                      : `Tap Score under one of your Games when it ends, up to Round ${roundOn(live.currentRound, rounds)}. Tap your name again to see everyone.`}
                </p>
                <p className="mm-legend mt-6">Game Rule</p>
                <p className="mm-note mt-1">{describeGameRule(live.rule)}</p>
              </>
            )}
          </div>

          <div className="min-w-0">
            {reconnecting ? (
              <p className="mm-notice mb-4" role="status">
                Lost the connection to Match Mixer, so scores here may be behind. This page catches up on its own.
              </p>
            ) : null}
            {draw.outdated ? (
              <p className="mm-notice mb-4">
                Match Mixer has changed how boards are drawn since this one went live, so the board below may not
                match the one the organizer drew.
              </p>
            ) : null}
            <div className="mm-draw">
              <ScheduleGrid
                bands={bands}
                selected={bandSelected}
                onSelect={selectInBand}
                scoring={{ scores: live.scores, onScore: canScore ? setScoring : undefined, access }}
                courtLabels={draw.config.courtLabels}
              />
            </div>
            <StandingsTables
              standings={live.standings}
              pairs={draw.pools[0]?.score.format === "fixed"}
              final={over}
            />
          </div>
        </div>
      </div>

      {scoring && sheet ? (
        <ScoreSheet
          key={gameKey(scoring.round, scoring.court)}
          game={sheet}
          rule={live.rule}
          onSave={async (score: GameScore) => afterWrite(await enterScore(token, scoring, score, selection))}
          onClear={async () => afterWrite(await clearScore(token, scoring, selection))}
          onClose={() => setScoring(null)}
        />
      ) : null}

      <div className="mm-tray" aria-hidden>
        <span className="mm-pen" data-ink="black" data-tray-extra />
        <span className="mm-pen" data-ink="red" />
        <span className="mm-magnet" />
        <span className="mm-magnet" data-tray-extra />
        <span className="mm-tray-mark">Juice Bros Pickleball</span>
      </div>
    </div>
  );
}

/** The keypad sheet's view of one Game: its place on the board and both Sides' names. */
function sheetFor(live: RebuiltMixer, at: GameAt): SheetGame | null {
  const found = gameOn(live.draw, at);
  if (!found) return null;
  const { roster } = live.draw.pools[found.pool];
  const names = (side: readonly PlayerIndex[]) => side.map((player) => roster[player]?.name ?? "").join(" / ");
  return {
    title: `Round ${at.round + 1} · Court ${courtLabel(at.court, live.draw.config.courtLabels)}`,
    sides: [names(found.game.sides[0]), names(found.game.sides[1])],
    score: live.scores.get(gameKey(at.round, at.court)) ?? null,
  };
}

/** The Round on, as people count them, for a Current Round that a score in the last Round carries past the board. */
function roundOn(currentRound: number, rounds: number): number {
  return Math.min(currentRound, rounds - 1) + 1;
}

/**
 * A write from one of the Organizer Link's controls. One that never reached
 * Match Mixer may still have landed, so the problem says to look rather than
 * "it didn't change" (Mic Drop's #671). `landed` finishes "reload to see if …".
 */
async function reach(write: () => Promise<Outcome<null>>, landed: string): Promise<Outcome<null>> {
  try {
    return await write();
  } catch {
    return { ok: false, problem: `Couldn't reach Match Mixer. Check your signal, then reload to see if ${landed}.` };
  }
}

/**
 * The Organizer Link's one Round control (#689): "Start round N+1", never a
 * choice of Round, so a wrong tap costs at most one. Scores move the night on
 * without it; the tap lets players score the next Round before anyone has
 * finished this one.
 */
function RoundControl({
  token,
  current,
  rounds,
  onSaved,
}: {
  token: string;
  current: number;
  rounds: number;
  onSaved: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const shown = roundOn(current, rounds);
  const next = current + 1;

  const start = async () => {
    setPending(true);
    setProblem(null);
    const outcome = await reach(() => startRound(token, next), "the Round started");
    if (outcome.ok) await onSaved();
    else setProblem(outcome.problem);
    setPending(false);
  };

  return (
    <div className="mb-6">
      <p className="mm-legend">Round</p>
      <p className="mm-note mt-1">
        {next < rounds ? `Round ${shown} of ${rounds} is on.` : `Round ${shown} of ${rounds}, the last one, is on.`} Players
        can score their Games up to it, and a score in it starts the next.
      </p>
      {next < rounds ? (
        <button type="button" className="mm-share mt-2" onClick={start} disabled={pending}>
          {pending ? "Starting…" : `Start round ${next + 1}`}
        </button>
      ) : null}
      <p className="mm-note mt-1" role="status" data-tone={problem ? "refused" : undefined}>
        {problem}
      </p>
    </div>
  );
}

/**
 * The Organizer Link's "Finish Mixer" (#690), behind a second tap: finishing
 * makes every score final for everyone, and only the superadmin can undo a
 * mistake after it.
 */
function FinishControl({ token, onSaved }: { token: string; onSaved: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const finish = async () => {
    setPending(true);
    setProblem(null);
    const outcome = await reach(() => finishMixer(token), "the night finished");
    if (outcome.ok) await onSaved();
    else setProblem(outcome.problem);
    setPending(false);
    setConfirming(false);
  };

  return (
    <div className="mt-8">
      <p className="mm-legend">Finish</p>
      <p className="mm-note mt-1">
        Once the last Game is in, finish the night so the Standings are final. It finishes on its own 12 hours after
        going live.
      </p>
      {confirming ? (
        <div role="group" aria-labelledby="mm-finish-confirm">
          <p className="mm-note mt-2" id="mm-finish-confirm">
            Finish now? After this, nobody can change a score.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="mm-share" onClick={finish} disabled={pending}>
              {pending ? "Finishing…" : "Yes, finish the night"}
            </button>
            <button type="button" className="mm-share" onClick={() => setConfirming(false)} disabled={pending}>
              Keep playing
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="mm-share mt-2" onClick={() => setConfirming(true)}>
          Finish Mixer
        </button>
      )}
      <p className="mm-note mt-1" role="status" data-tone={problem ? "refused" : undefined}>
        {problem}
      </p>
    </div>
  );
}

/** The Organizer Link's Game Rule: saved the moment it changes, for scores from then on. */
function RuleControl({ token, rule, onSaved }: { token: string; rule: GameRule; onSaved: () => Promise<void> }) {
  const [pending, setPending] = useState<GameRule | null>(null);
  const [said, setSaid] = useState<{ tone: "done" | "refused"; text: string } | null>(null);

  const change = async (next: GameRule) => {
    setPending(next);
    setSaid(null);
    const outcome = await reach(() => changeGameRule(token, next), "the Game Rule changed");
    if (outcome.ok) await onSaved();
    setPending(null);
    setSaid(
      outcome.ok
        ? { tone: "done", text: `Saved. Scores from now on play ${describeGameRule(next).toLowerCase()}.` }
        : { tone: "refused", text: outcome.problem },
    );
  };

  return (
    <div className="mb-6">
      <GameRulePicker
        value={pending ?? rule}
        onChange={change}
        disabled={pending !== null}
        note="Change it any time. Scores already in stay as they are."
      />
      <p className="mm-note -mt-4" role="status" data-tone={said?.tone}>
        {said?.text}
      </p>
    </div>
  );
}

const noSubscription = () => () => {};

/** One link, on screen in full so it can be copied by hand when the clipboard refuses. */
function CopyLink({ id, label, path, note }: { id: string; label: string; path: string; note: string }) {
  // The origin only exists in the browser; the server renders the path alone.
  const origin = useSyncExternalStore(noSubscription, () => window.location.origin, () => "");
  const href = `${origin}${path}`;
  const [said, setSaid] = useState<"copied" | "byhand" | null>(null);

  useEffect(() => {
    if (said !== "copied") return;
    const timer = setTimeout(() => setSaid(null), 5000);
    return () => clearTimeout(timer);
  }, [said]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setSaid("copied");
    } catch {
      setSaid("byhand");
    }
  };

  return (
    <div className="mt-6 first:mt-0">
      <label className="mm-legend" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="mm-input mt-2 w-full px-2 py-1 text-xs"
        readOnly
        value={href}
        onFocus={(event) => event.currentTarget.select()}
        aria-describedby={`${id}-note`}
      />
      <button type="button" className="mm-share mt-2" onClick={copy}>
        Copy the {label}
      </button>
      <p className="mm-note mt-2" id={`${id}-note`}>
        {note}
      </p>
      <p className="mm-note mt-1" role="status" data-tone={said === "copied" ? "done" : said ? "refused" : undefined}>
        {said === "copied"
          ? "Copied."
          : said === "byhand"
            ? "This browser kept the clipboard to itself. Copy it from the box above."
            : null}
      </p>
    </div>
  );
}
