import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getSession } from "@/lib/on-deck/sessions";
import { sessionPath } from "@/lib/on-deck/routes";
import { FLOOR_MODE_LABEL } from "@/lib/on-deck/session/types";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import { PlayerJoin } from "@/components/on-deck/player-join";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    ...pageMetadata({
      title: "On Deck session",
      description: "Tonight's live court rotation.",
      path: sessionPath(sessionId),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * The live view of one Session — the Player's surface. The substitution board
 * (direction seed 92ec9d54): a Player scanning in gets a two-tap setup, then
 * one verdict at board scale — where they stand and which court, if any.
 * Reachable with no account (a Player scans the Club QR, which redirects here).
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const loaded = await getSession(supabase, sessionId).catch(() => null);
  if (!loaded) {
    notFound();
  }

  const { config, status, state } = loaded;
  const startedAt = state.startedAt ? new Date(state.startedAt) : null;

  return (
    <ArenaShell>
      <section className="w-full px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-md">
          <header className="border-b border-arena-line-soft pb-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="od-display-tight text-4xl text-arena-fg sm:text-5xl">
                {config.venueName}
              </h1>
              <span
                className={`od-readout ${
                  status === "open" ? "text-arena-live" : "text-arena-faint"
                }`}
              >
                {status === "open" ? "Session running" : "Session closed"}
              </span>
            </div>
            <dl className="od-readout mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-arena-dim">
              <div className="flex gap-1.5">
                <dt>Courts</dt>
                <dd className="text-arena-dim">{config.courtCount}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Floor</dt>
                <dd className="text-arena-dim">
                  {FLOOR_MODE_LABEL[config.floorMode]}
                </dd>
              </div>
              {startedAt && (
                <div className="flex gap-1.5">
                  <dt>Started</dt>
                  <dd className="text-arena-dim">
                    {startedAt.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </header>

          {status === "open" ? (
            <PlayerJoin
              sessionId={config.sessionId}
              floorMode={config.floorMode}
            />
          ) : (
            <p className="od-display mt-8 text-xl text-arena-faint">
              This session has wrapped up. Thanks for playing.
            </p>
          )}
        </div>
      </section>
    </ArenaShell>
  );
}
