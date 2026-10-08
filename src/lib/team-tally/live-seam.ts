/**
 * The one seam Team Tally's live screens read and write through (issue #631).
 * The Score Link, the Public Link, the venue TV and the Organizer's board take
 * a `LiveSeam` instead of calling Server Actions themselves, so the same
 * screens run on two adapters:
 *
 * - the real one (`components/team-tally/server-seam.ts`): `readLiveEvent`
 *   kept current by Realtime, and the Server Actions in `actions/live.ts`;
 * - the demo night's (`demo/reduce.ts`): an in-memory reducer over a
 *   `TeamEventDoc`, folded in the browser, nothing saved.
 *
 * Every write resolves once the screen's view shows it, or with the reason it
 * was refused, in the database's own words. Types only, relative imports
 * only, so nothing here reaches a database.
 */

import type { TeamEventDoc } from "./event-doc.ts";
import type { Roster } from "./roster.ts";

export type WriteResult = { ok: true } | { ok: false; problem: string };

/** A running Team Event as a screen reads it, and on a Score Link, whose it is. */
export type LiveView = { event: TeamEventDoc; myTeamId?: string };

/** What a Score Link can do: its own Team's Games, roster, Dreambreaker and Matchup done. */
export type TeamWrites = {
  /** One Game's score, red side first. */
  saveGameScore(gameId: string, red: number, blue: number): Promise<WriteResult>;
  /** A Team's slots A, B and C. */
  saveRoster(teamId: string, roster: Roster): Promise<WriteResult>;
  markMatchupDone(matchupId: string): Promise<WriteResult>;
  /** Who won a tied Matchup's Dreambreaker; null clears it. */
  recordDreambreaker(matchupId: string, winnerTeamId: string | null): Promise<WriteResult>;
};

/** Everything a Score Link can do, plus the Organizer's own controls. */
export type OrganizerWrites = TeamWrites & {
  reopenMatchup(matchupId: string): Promise<WriteResult>;
  /** Places the Flights from the scores as they stand. */
  seedFlightsNow(): Promise<WriteResult>;
  swapFlightCourts(flightId: string, otherFlightId: string): Promise<WriteResult>;
  /** After Seeding: a Team level on every count across a Flight line goes ahead. */
  putTeamAhead(teamId: string): Promise<WriteResult>;
  /** Before Seeding: Teams level on every count, first ahead. */
  orderTiedTeams(teamIds: string[]): Promise<WriteResult>;
};

/** Who is writing decides what a screen offers: only the Organizer reopens. */
export type LiveWrites = ({ by: "team" } & TeamWrites) | ({ by: "organizer" } & OrganizerWrites);

export type LiveSeam<W extends LiveWrites = LiveWrites> = { view: LiveView; writes: W };
