import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { loadKioskSession } from "@/lib/on-deck/kiosk";
import { rotationViewFrom } from "@/lib/on-deck/rotation";
import { kioskPath } from "@/lib/on-deck/routes";
import { ArenaShell } from "@/components/on-deck/arena-shell";
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
    <ArenaShell>
      <section className="w-full px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-arena-line-soft pb-4">
            <h1 className="od-display text-2xl text-arena-dim sm:text-3xl">
              {view.venueName}
            </h1>
            <p className="od-readout text-arena-dim">
              Courtside kiosk
            </p>
          </header>
          <p className="mt-3 text-sm text-arena-faint">
            Finished your game? Tap your court done. Someone short? Flag it and
            we&apos;ll pull the next player in.
          </p>

          <div className="mt-7">
            <KioskBoard sessionId={sessionId} initialView={view} />
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
