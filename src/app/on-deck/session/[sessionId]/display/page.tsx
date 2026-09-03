import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getSession } from "@/lib/on-deck/sessions";
import { rotationViewFrom } from "@/lib/on-deck/rotation";
import { displayPath } from "@/lib/on-deck/routes";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import { DisplayBoard } from "@/components/on-deck/display-board";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    ...pageMetadata({
      title: "On Deck display",
      description: "Tonight's courts, queue, and who's on deck.",
      path: displayPath(sessionId),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * The read-only Display (issue #253): a walk-up-and-read board for a cheap
 * tablet on the snack table. Courts and their occupants, the ordered Queue
 * with Wait Times, and the two On Deck Foursomes shown prominently, plus a
 * one-line explainer of how Group order works.
 *
 * No account, no token — it renders only what the venue's wall already shows
 * (display names; no Skill Level, no contact data) and carries no operational
 * buttons. A Session runs identically with no Display open. Updates ride the
 * same Realtime/poll sync as every other surface.
 */
export default async function DisplayPage({
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

  const view = rotationViewFrom(loaded);

  return (
    <ArenaShell>
      <section className="w-full px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-arena-line-soft pb-4">
            <h1 className="od-display text-2xl text-arena-dim sm:text-3xl">
              {view.venueName}
            </h1>
            <p
              className={`od-readout ${
                view.status === "open" ? "text-arena-live" : "text-arena-faint"
              }`}
            >
              {view.status === "open" ? "● Live" : "Session closed"}
            </p>
          </header>

          <div className="mt-7">
            <DisplayBoard sessionId={sessionId} initialView={view} />
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
