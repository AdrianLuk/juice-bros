import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getSession } from "@/lib/on-deck/sessions";
import { rotationViewFrom } from "@/lib/on-deck/rotation";
import { displayPath } from "@/lib/on-deck/routes";
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
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
            {view.status === "open" ? "Live" : "Session closed"}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
            {view.venueName}
          </h1>

          <div className="mt-8">
            <DisplayBoard sessionId={sessionId} initialView={view} />
          </div>
        </div>
      </section>
    </div>
  );
}
