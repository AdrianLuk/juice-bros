import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { readLinkEvent } from "@/lib/ddd/events";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * What the Score Link and the Public Link open (issue #711): the DDD header
 * and its courts. The screens behind them arrive with #715 to #718. A token
 * for the other link, or none at all, is a 404.
 */
export async function LinkScreen({ token, link }: { token: string; link: "score" | "public" }) {
  const event = await readLinkEvent(await createClient(), token);
  if (!event || event.link !== link) notFound();

  return (
    <>
      <DddHead event={event} />
      <main className="ddd-main">
        <div className="ddd-col ddd-slip ddd-notice">
          <p className="ddd-slip-head">{link === "score" ? "Score Link" : "Public Link"}</p>
          <p>
            {link === "score"
              ? "Scores go in here on the day. Keep this link: it's the one for the group chat."
              : "The standings show here on the day."}
          </p>
          <p className="ddd-note">Courts {event.courts.join(", ")}.</p>
        </div>
      </main>
    </>
  );
}
