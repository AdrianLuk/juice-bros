import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getSession } from "@/lib/on-deck/sessions";
import { sessionPath } from "@/lib/on-deck/routes";
import { FLOOR_MODE_LABEL } from "@/lib/on-deck/session/types";

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
 * The live view of one Session. This ticket lands the shell — a folded
 * `SessionState` rendered read-only; the Queue, Courts, and On Deck foursomes
 * fill it in over later tickets. Reachable with no account (a Player scans the
 * Club QR, which redirects here).
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
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
            {status === "open" ? "Session running" : "Session closed"}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-semibold">
            {config.venueName}
          </h1>
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Courts</dt>
            <dd>{config.courtCount}</dd>
            <dt className="text-muted-foreground">Floor Mode</dt>
            <dd>{FLOOR_MODE_LABEL[config.floorMode]}</dd>
            {startedAt && (
              <>
                <dt className="text-muted-foreground">Started</dt>
                <dd>
                  {startedAt.toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </dd>
              </>
            )}
          </dl>
          <p className="mt-8 text-sm text-muted-foreground">
            The queue opens here soon. For now this confirms the session is
            live.
          </p>
        </div>
      </section>
    </div>
  );
}
