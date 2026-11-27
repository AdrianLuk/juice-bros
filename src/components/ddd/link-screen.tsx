import Link from "next/link";
import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { LiveRound } from "@/components/ddd/live-round";
import { QueryProvider } from "@/components/ddd/query-provider";
import { RoundOne } from "@/components/ddd/round-one";
import { readLinkEvent } from "@/lib/ddd/events";
import { resultsPath } from "@/lib/ddd/routes";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * What the Score Link and the Public Link open: the DDD header with the
 * round, then the courts and the tabs live (#715 to #717) and the 4 Teams
 * (#712). The Score Link enters finals; the Public Link only reads. A token
 * for the other link, or none, is a 404. On a TV the Public Link fits one
 * screen (`.ddd-public` in ddd.css).
 */
export async function LinkScreen({ token, link }: { token: string; link: "score" | "public" }) {
  const event = await readLinkEvent(await createClient(), token);
  if (!event || event.link !== link) notFound();
  const reader = { kind: link, token };

  return (
    <QueryProvider>
      <DddHead event={event}>
        <LiveRound reader={reader} initial={event} />
        {link === "public" ? (
          <Link href={resultsPath(token)} className="ddd-quiet ddd-on-green">
            Final places and Punishments
          </Link>
        ) : null}
      </DddHead>
      <main className={`ddd-main ddd-${link}`}>
        <div className="ddd-col ddd-stack-lg">
          <RoundOne reader={reader} initial={event} showRoster showDoubles />
          <div className="ddd-slip ddd-notice ddd-link-about">
            <p className="ddd-slip-head">{link === "score" ? "Score Link" : "Public Link"}</p>
            <p>
              {link === "score"
                ? "Enter each final here as it finishes. Keep this link: it's the one for the group chat."
                : "Seeding and every court, updated as finals come in."}
            </p>
            <p className="ddd-note">Courts {event.courts.join(", ")}.</p>
          </div>
        </div>
      </main>
    </QueryProvider>
  );
}
