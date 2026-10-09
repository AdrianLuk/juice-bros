"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { demoWrites } from "@/lib/team-tally/demo/seam";
import { createDemoStore } from "@/lib/team-tally/demo/store";
import { sideOf, type DocGame, type DocMatchup, type DocTeam, type TeamEventDoc } from "@/lib/team-tally/event-doc";
import { EditedBy, KIND_LABEL } from "../game-card";
import { MatchupBug } from "../matchup-bug";
import { MatchupRounds } from "../matchup-rounds";
import { PublicScreen } from "../public-screen";
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
 * The Score Link, working: Golden Set's Matchup as its bug, over its Rounds
 * as the real Score Link sets them (`MatchupRounds`): the live Round open,
 * one Game already entered (with who entered it) and one with its score
 * boxes waiting, the others folded. A score saves into a night held in the browser by
 * the demo's own rules, so 13-9 gets the real refusal and a saved Game says
 * who entered it. Nothing leaves the page.
 */
export function ScoreLinkPreview({ event: start, myTeamId }: { event: TeamEventDoc; myTeamId: string }) {
  const [store] = useState(() => createDemoStore(start));
  const event = useSyncExternalStore(store.subscribe, store.get, store.get);
  const writes = useMemo(() => demoWrites({ kind: "team", teamId: myTeamId }, store.commit), [myTeamId, store]);
  const teams = useMemo(() => teamMap(event.teams), [event.teams]);

  const matchup = event.matchups.find((candidate) => candidate.stage === "opening" && sideOf(candidate, myTeamId))!;

  return (
    <div className="grid gap-3">
      <MatchupBug matchup={matchup} teams={teams} />
      <MatchupRounds matchup={matchup} teams={teams} writes={writes} />
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

/**
 * The Public Link as a phone opens it, in a handset. It opens scrolled to the
 * Matchups, past the standings the previews above already show, with the
 * first Matchup's Games open, so what is on screen is the Games and who
 * entered them. The visitor can
 * scroll it either way.
 */
export function PhonePreview({ event }: { event: TeamEventDoc }) {
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = frame.current;
    const matchups = element?.querySelector<HTMLElement>('section[aria-label="Matchups"]');
    if (!element || !matchups) return;
    // Open the first Matchup's Games, so who entered each one is on screen.
    const games = matchups.querySelector<HTMLDetailsElement>("details");
    if (games) games.open = true;
    const offset = matchups.getBoundingClientRect().top - element.getBoundingClientRect().top;
    element.scrollTop = Math.max(0, offset - 12);
  }, []);

  return (
    <div
      ref={frame}
      className="tt-demo-phone tt-land-phone"
      role="region"
      aria-label="The Public Link on a phone"
      tabIndex={0}
    >
      <PublicScreen live={{ view: { event } }} view="scroll" />
    </div>
  );
}
