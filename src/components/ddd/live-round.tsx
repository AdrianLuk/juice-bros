"use client";

import { useQuery } from "@tanstack/react-query";

import { readLive, type LiveReader } from "@/lib/ddd/actions/live";
import { seedTeams } from "@/lib/ddd/dreambreakers";
import type { LinkEvent } from "@/lib/ddd/events";
import { doublesMatchups, roundOf } from "@/lib/ddd/matchups";

/**
 * The round in the DDD header on the links. It reads the same query as the
 * live screen under it, so it moves on with it: `RoundOne`'s `useDddLive`
 * owns the Realtime channel and the poll; this only watches the cache.
 */
export function LiveRound({ reader, initial }: { reader: LiveReader; initial: LinkEvent }) {
  const { data } = useQuery({ queryKey: ["ddd", "live", reader], queryFn: () => readLive(reader), initialData: initial });
  const event = data ?? initial;
  const seeds = seedTeams(
    event.teams.map((team) => team.id),
    event.dreambreakers,
    event.tieOrder,
  );
  const matchups = doublesMatchups(seeds, { spreads: event.spreads, games: event.games, calls: event.calls });
  return <p className="ddd-head-round">{roundOf(matchups)}</p>;
}
