"use client";

import { useMemo } from "react";

import {
  markMatchupDone,
  orderTiedTeams,
  putTeamAhead,
  recordDreambreaker,
  reopenMatchup,
  saveGameScore,
  saveRoster,
  seedFlightsNow,
  swapFlightCourts,
  type LiveReader,
  type LiveWriter,
} from "@/lib/team-tally/actions/live";
import type {
  LiveSeam,
  LiveView,
  LiveWrites,
  OrganizerWrites,
  TeamWrites,
  WriteResult,
} from "@/lib/team-tally/live-seam";
import { useLiveEvent } from "./use-live-event";

/**
 * The real adapter for the live seam (issue #631): the read is `readLiveEvent`
 * kept current by Realtime and the poll behind it (`useLiveEvent`), and every
 * write is a Server Action in `actions/live.ts`, as the reader's credential (a
 * Score Link's token, or the signed-in Organizer). A write that lands re-reads
 * before it resolves, so the screen that saved it shows it at once.
 *
 * The demo night's adapter is `lib/team-tally/demo/seam.ts`; the screens can't
 * tell the two apart.
 */
export function useServerSeam(
  reader: Extract<LiveReader, { kind: "score" }>,
  initial: LiveView,
): LiveSeam<{ by: "team" } & TeamWrites>;
export function useServerSeam(
  reader: Extract<LiveReader, { kind: "organizer" }>,
  initial: LiveView,
): LiveSeam<{ by: "organizer" } & OrganizerWrites>;
export function useServerSeam(reader: Exclude<LiveReader, { kind: "public" }>, initial: LiveView): LiveSeam {
  const { view, refresh } = useLiveEvent(reader, initial);
  const readerKey = JSON.stringify(reader);
  const eventId = initial.event.id;

  const writes = useMemo<LiveWrites>(() => {
    const parsed = JSON.parse(readerKey) as LiveReader;
    const writer: LiveWriter = parsed.kind === "score" ? { kind: "score", token: parsed.token } : { kind: "organizer" };
    const thenRefresh = async (result: Promise<WriteResult>) => {
      const settled = await result;
      if (settled.ok) await refresh();
      return settled;
    };

    const team: TeamWrites = {
      saveGameScore: (gameId, red, blue) => thenRefresh(saveGameScore(writer, gameId, red, blue)),
      saveRoster: (teamId, roster) => thenRefresh(saveRoster(writer, teamId, roster)),
      markMatchupDone: (matchupId) => thenRefresh(markMatchupDone(writer, matchupId)),
      recordDreambreaker: (matchupId, winnerTeamId) => thenRefresh(recordDreambreaker(writer, matchupId, winnerTeamId)),
    };
    if (writer.kind === "score") return { by: "team", ...team };

    return {
      by: "organizer",
      ...team,
      reopenMatchup: (matchupId) => thenRefresh(reopenMatchup(matchupId)),
      seedFlightsNow: () => thenRefresh(seedFlightsNow(eventId)),
      swapFlightCourts: (flightId, otherFlightId) => thenRefresh(swapFlightCourts(flightId, otherFlightId)),
      putTeamAhead: (teamId) => thenRefresh(putTeamAhead(eventId, teamId)),
      orderTiedTeams: (teamIds) => thenRefresh(orderTiedTeams(eventId, teamIds)),
    };
  }, [readerKey, eventId, refresh]);

  return { view, writes };
}
