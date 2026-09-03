import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOpenSessionForClub } from "@/lib/on-deck/sessions";
import { clubQrPath, sessionPath } from "@/lib/on-deck/routes";
import { ArenaShell } from "@/components/on-deck/arena-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubId: string }>;
}): Promise<Metadata> {
  const { clubId } = await params;
  return {
    ...pageMetadata({
      title: "On Deck",
      description: "Scan in to tonight's pickleball social.",
      path: clubQrPath(clubId),
    }),
    // The QR sign is a fixed URL that redirects; nothing here to index.
    robots: { index: false, follow: false },
  };
}

/**
 * The stable per-Club path a printed QR sign points at. Resolves to the
 * currently-open Session, or a "nothing running right now" screen. Reachable
 * with no account — a Player scanning the sign (ADR 0005) reads as `anon`,
 * which RLS allows for an open Session.
 */
export default async function ClubQrPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const supabase = await createClient();

  const openSession = await getOpenSessionForClub(supabase, clubId).catch(
    () => null,
  );

  if (openSession) {
    redirect(sessionPath(openSession.config.sessionId));
  }

  return (
    <ArenaShell className="items-center justify-center px-6 py-24 text-center">
      <div className="od-panel mx-auto max-w-sm px-6 py-8">
        <p className="od-readout text-[0.72rem] text-arena-faint">On Deck</p>
        <h1 className="od-display-tight mt-2 text-3xl text-arena-fg">
          Nothing running right now
        </h1>
        <p className="mt-3 text-sm text-arena-faint">
          There&apos;s no session open at the moment. Scan the sign again once
          play has started.
        </p>
      </div>
    </ArenaShell>
  );
}
