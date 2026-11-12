"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { EMPTY, restore } from "@/components/apps/match-mixer/lib/board-editor";
import { locate, poolName } from "@/components/apps/match-mixer/lib/engine/pools";
import type { PlayerIndex } from "@/components/apps/match-mixer/lib/engine/types";
import {
  boardIdentity,
  clear as clearSelection,
  load as loadSelection,
  save as saveSelection,
} from "@/components/apps/match-mixer/lib/persistence/selection-storage";
import { decodeShareLink } from "@/components/apps/match-mixer/lib/persistence/share-link";

import { ScheduleGrid, type Band, type BandPlayer } from "./schedule-grid";

/**
 * A Live Mixer's board, as its Organizer Link or Player Link opens it (#687).
 * Redrawn from the stored Config exactly as an opened Share Link is (ADR
 * 0001, ADR 0006): the Schedule is never stored. Find-me works as it does on
 * the tool itself, and a Selection made here is the same Selection.
 */
export function LiveBoard({
  config,
  playerPath,
  organizerPath,
}: {
  config: string;
  /** Both present on the Organizer Link only. */
  playerPath?: string;
  organizerPath?: string;
}) {
  const draw = useMemo(() => {
    const shared = decodeShareLink(config);
    return shared ? restore(EMPTY, { from: "link", board: shared }).draw : null;
  }, [config]);

  // Find-me, as `MatchMixer` does it: a Roster index held against the board
  // it was picked on, resolved to a band on the way in and back on the way out.
  const [found, setFound] = useState<{ board: string; player: PlayerIndex } | null>(null);
  const board = draw ? boardIdentity(draw.key, draw.config.seed) : null;
  const size = draw?.config.roster.length ?? 0;
  const selected = found && found.board === board && found.player < size ? found.player : null;

  useEffect(() => {
    if (!board) return;
    const player = loadSelection(board, size);
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store when the board changes */
    setFound(player === null ? null : { board, player });
  }, [board, size]);

  if (!draw || !board) {
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
  const bandSelected: BandPlayer | null = located
    ? { band: located.pool, player: located.index }
    : null;
  const selectInBand = ({ band, player }: BandPlayer) => {
    const member = draw.pools[band]?.members[player];
    if (member !== undefined) selectPlayer(member);
  };

  const organizer = playerPath !== undefined && organizerPath !== undefined;

  return (
    <div className="mm-sheet">
      <div className="mm-face mm-fixings">
        <header className="mm-head">
          <div className="mm-headline">
            <h1 className="mm-title">Match Mixer</h1>
            <p className="mm-meta">Live · {draw.numbers}</p>
          </div>
          <p className="mm-lede">
            {organizer
              ? "This board is live. Paste the Player Link into the group chat so everyone can open it on their phone, and keep the Organizer Link for yourself."
              : "Tonight’s board, live from the organizer. Tap your name to see your evening."}
          </p>
        </header>

        <div className="mm-cols">
          <div className="mm-controls">
            {organizer ? (
              <>
                <CopyLink
                  id="mm-player-link"
                  label="Player Link"
                  path={playerPath}
                  note="For the group chat. Anyone with it can see the board."
                />
                <CopyLink
                  id="mm-organizer-link"
                  label="Organizer Link"
                  path={organizerPath}
                  note="Yours alone. Whoever holds it runs the night."
                />
              </>
            ) : (
              <p className="mm-note">
                The board updates from the organizer&rsquo;s link. Tap your name again to see everyone.
              </p>
            )}
          </div>

          <div className="min-w-0">
            {draw.outdated ? (
              <p className="mm-notice mb-4">
                Match Mixer has changed how boards are drawn since this one went live, so the board below may not
                match the one the organizer drew.
              </p>
            ) : null}
            <div className="mm-draw">
              <ScheduleGrid bands={bands} selected={bandSelected} onSelect={selectInBand} />
            </div>
          </div>
        </div>
      </div>

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
