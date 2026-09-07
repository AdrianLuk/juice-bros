import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { clubJoinQr } from "@/lib/on-deck/qr";
import { ON_DECK_HOME_PATH, ON_DECK_QR_DISPLAY_PATH } from "@/lib/on-deck/routes";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "On Deck club QR",
    description: "The Club QR, full screen, for a night without the printed sign.",
    path: ON_DECK_QR_DISPLAY_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * The on-screen stand-in for the printed Club QR sign: the same stable link
 * (`clubQrPath`), rendered full-screen so an Organizer can hold a phone or
 * laptop up for Players to scan when the sign isn't on the wall. Nothing
 * here is per-Session — regenerating it on every visit would defeat the
 * point of a link that's supposed to never change.
 */
export default async function OnDeckQrDisplayPage() {
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);

  if (!club) {
    redirect(ON_DECK_HOME_PATH);
  }

  const { url, svg } = await clubJoinQr(club.id);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-sm text-center">
          <PageHeading eyebrow={club.name} title="Scan to join" />
          <p className="mt-3 text-sm text-muted-foreground">
            Same link as the printed sign. It always points at whatever
            session is running, so this works whether or not you&apos;ve
            started one yet.
          </p>

          <div
            role="img"
            aria-label="Club QR code"
            className="mx-auto mt-8 w-full max-w-xs rounded-2xl border bg-white p-6 shadow-sm [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />

          <p className="mt-4 break-all font-mono text-xs text-muted-foreground">
            {url}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            Turn your screen brightness up if players are scanning it off
            this device.
          </p>

          <Link
            href={ON_DECK_HOME_PATH}
            className="mt-8 inline-block text-sm underline underline-offset-4"
          >
            Back to Tonight
          </Link>
        </div>
      </section>
    </div>
  );
}
