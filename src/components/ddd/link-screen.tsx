import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { QueryProvider } from "@/components/ddd/query-provider";
import { RoundOne } from "@/components/ddd/round-one";
import { SpreadsView } from "@/components/ddd/spreads-view";
import { readLinkEvent } from "@/lib/ddd/events";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * What the Score Link and the Public Link open: the DDD header, then Round 1
 * live (#715) and the 4 Teams (#712). The Score Link enters finals; the
 * Public Link only reads. A token for the other link, or none, is a 404.
 */
export async function LinkScreen({ token, link }: { token: string; link: "score" | "public" }) {
  const event = await readLinkEvent(await createClient(), token);
  if (!event || event.link !== link) notFound();

  return (
    <>
      <DddHead event={event} />
      <main className="ddd-main">
        <div className="ddd-col ddd-stack-lg">
          <div className="ddd-slip ddd-notice">
            <p className="ddd-slip-head">{link === "score" ? "Score Link" : "Public Link"}</p>
            <p>
              {link === "score"
                ? "Enter each final here as it finishes. Keep this link: it's the one for the group chat."
                : "Seeding and every court, updated as finals come in."}
            </p>
            <p className="ddd-note">Courts {event.courts.join(", ")}.</p>
          </div>
          <QueryProvider>
            <RoundOne reader={{ kind: link, token }} initial={event} showRoster showDoubles />
          </QueryProvider>
          <SpreadsView event={event} />
        </div>
      </main>
    </>
  );
}
