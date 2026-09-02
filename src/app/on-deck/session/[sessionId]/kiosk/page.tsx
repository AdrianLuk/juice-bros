import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { loadKioskSession } from "@/lib/on-deck/kiosk";
import { rotationViewFrom } from "@/lib/on-deck/rotation";
import { kioskPath } from "@/lib/on-deck/routes";
import { KioskBoard } from "@/components/on-deck/kiosk-board";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    ...pageMetadata({
      title: "On Deck kiosk",
      description: "Tonight's courts, queue, and the buttons a turnover needs.",
      path: kioskPath(sessionId),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * The courtside Kiosk (issue #259): the read-only Display's board plus the
 * buttons a Game turnover needs — Court done, a player short, add me — for a
 * tablet stood by the courts. Any Player standing there can tap; every tap is a
 * `kiosk` Operator action (ADR 0005 — the app never requires a Volunteer).
 *
 * No account and no token: the Session id is its own credential, the same as
 * the Display. `loadKioskSession` gates on Floor Mode — under `volunteer-run`
 * the Kiosk URL 404s; it works under `self-serve` and `hybrid`.
 */
export default async function KioskPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const loaded = await loadKioskSession(sessionId);
  if (!loaded) {
    notFound();
  }

  const view = rotationViewFrom(loaded);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
            Kiosk
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
            {view.venueName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Finished your game? Tap your court done. Someone short? Flag it and
            we&apos;ll pull the next player in.
          </p>

          <div className="mt-8">
            <KioskBoard sessionId={sessionId} initialView={view} />
          </div>
        </div>
      </section>
    </div>
  );
}
