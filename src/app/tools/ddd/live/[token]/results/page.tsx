import Link from "next/link";
import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { QueryProvider } from "@/components/ddd/query-provider";
import { Results } from "@/components/ddd/results";
import { readLinkEvent } from "@/lib/ddd/events";
import { publicLinkPath } from "@/lib/ddd/routes";
import { createClient } from "@/lib/ddd/supabase/server";

/** The results on the Public Link (#718): Final places, Punishments and shots, for the TV at dinner. */
export default async function ResultsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const event = await readLinkEvent(await createClient(), token);
  if (!event || event.link !== "public") notFound();

  return (
    <>
      <DddHead event={event} />
      <main className="ddd-main">
        <QueryProvider>
          <Results reader={{ kind: "public", token }} initial={event} />
        </QueryProvider>
        <p className="ddd-results-back">
          <Link href={publicLinkPath(token)} className="ddd-quiet ddd-on-green">
            Courts and Matchups
          </Link>
        </p>
      </main>
    </>
  );
}
