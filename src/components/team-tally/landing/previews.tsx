"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { demoNight } from "@/lib/team-tally/demo/night";
import { demoWrites } from "@/lib/team-tally/demo/seam";
import { createDemoStore } from "@/lib/team-tally/demo/store";
import { liveRound, sideOf, type DocGame, type DocMatchup, type DocTeam, type TeamEventDoc } from "@/lib/team-tally/event-doc";
import { EditedBy, GameCard, KIND_LABEL } from "../game-card";
import { MatchupBug } from "../matchup-bug";
import { TvStage } from "../tv-stage";

/**
 * The landing's live previews (issue #636) that need the browser: each one is
 * a real screen's component on the demo night, so what a visitor sees and
 * does here is what the app does.
 */

function teamMap(teams: DocTeam[]): Map<string, DocTeam> {
  return new Map(teams.map((team) => [team.id, team]));
}

/**
 * The Score Link, working: Golden Set's Matchup as its bug, over the live
 * Round's two Games with their score boxes. A score saves into a night held in
 * the browser by the demo's own rules, so 13-9 gets the real refusal and a
 * saved Game says who entered it. Nothing leaves the page.
 */
export function ScoreLinkPreview({ date }: { date: string }) {
  const [opening] = useState(() => demoNight(date));
  const { myTeamId } = opening;
  const [store] = useState(() => createDemoStore(opening.event));
  const event = useSyncExternalStore(store.subscribe, store.get, store.get);
  const writes = useMemo(() => demoWrites({ kind: "team", teamId: myTeamId }, store.commit), [myTeamId, store]);
  const teams = useMemo(() => teamMap(event.teams), [event.teams]);

  const matchup = event.matchups.find((candidate) => candidate.stage === "opening" && sideOf(candidate, myTeamId))!;
  const round = liveRound(matchup);
  const games = round ? matchup.games.filter((game) => game.round === round) : [];

  return (
    <div className="grid gap-3">
      <MatchupBug matchup={matchup} teams={teams} />
      {round ? (
        <>
          <p className="tt-sect">
            Round {round} <span className="tt-live-mark">Live</span>
          </p>
          {games.map((game) => (
            <GameCard key={game.id} game={game} matchup={matchup} teams={teams} writes={writes} />
          ))}
        </>
      ) : (
        <p className="tt-body">All six Games are in. On the real Score Link, Matchup done comes next.</p>
      )}
    </div>
  );
}

/** The venue TV in a 16:9 bezel, cutting between its screens on its own. */
export function TvPreview({ event }: { event: TeamEventDoc }) {
  const teams = useMemo(() => teamMap(event.teams), [event.teams]);
  return (
    <div className="tt-demo-tv">
      <TvStage event={event} teams={teams} view="tv" framed />
    </div>
  );
}

/** A Matchup the Organizer has had a hand in: its FINAL bug, and the Game they changed. */
export function OrganizerPreview({
  matchup,
  game,
  teams,
}: {
  matchup: DocMatchup;
  game: DocGame;
  teams: DocTeam[];
}) {
  const byId = useMemo(() => teamMap(teams), [teams]);
  return (
    <div className="grid justify-items-start gap-3">
      <div className="w-full">
        <MatchupBug matchup={matchup} teams={byId} />
      </div>
      <p className="tt-land-edit">
        <span className="tt-meta text-[0.8125rem]">
          Round {game.round} · {KIND_LABEL[game.kind]}
        </span>
        <EditedBy game={game} matchup={matchup} teams={byId} />
      </p>
    </div>
  );
}
