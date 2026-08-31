import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOpenSessionForClub } from "@/lib/on-deck/sessions";
import { clubQrPath, sessionPath } from "@/lib/on-deck/routes";

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
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <div className="mx-auto max-w-sm">
        <h1 className="font-heading text-2xl font-semibold">
          Nothing running right now
        </h1>
        <p className="mt-3 text-muted-foreground">
          There&apos;s no session open at the moment. Scan the sign again once
          play has started.
        </p>
      </div>
    </div>
  );
}
