import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { clubJoinQr } from "@/lib/on-deck/qr";
import { onDeckAbsoluteUrl } from "@/lib/on-deck/request-origin";
import { ClubQrSign } from "@/components/on-deck/club-qr-sign";
import {
  clubQrImagePath,
  ON_DECK_HOME_PATH,
  ON_DECK_QR_DISPLAY_PATH,
} from "@/lib/on-deck/routes";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "On Deck club QR",
    description: "The Club QR sign, ready to print or to hold up at the door.",
    path: ON_DECK_QR_DISPLAY_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * The Club QR sign (issue #463), which is both the sheet that goes on the
 * wall and the on-screen stand-in for the night it isn't there yet. Nothing
 * here is per-Session — the link the code carries always resolves to whatever
 * Session is running, and regenerating it per night would defeat the point of
 * a sign printed once.
 */
export default async function OnDeckQrDisplayPage() {
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);

  if (!club) {
    redirect(ON_DECK_HOME_PATH);
  }

  const { url, svg } = await clubJoinQr(club.id);
  const svgPath = clubQrImagePath(club.id, "svg");
  const pngPath = clubQrImagePath(club.id, "png");
  const svgUrl = await onDeckAbsoluteUrl(svgPath);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-12 sm:px-6 lg:px-8">
        {/* Named so the print stylesheet can drop the reading width in one
            rule — on paper the sheet takes the whole page. */}
        <div className="od-sign-slot mx-auto max-w-2xl">
          <div className="od-sign-controls">
            <PageHeading eyebrow={club.name} title="The club sign" />
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Print this once and put it on the wall. The link behind the code
              never changes, so it works every week whether or not a session is
              running yet. On a night without the printed sign, hold this screen
              up instead and turn the brightness up.
            </p>
          </div>

          <div className="od-sign-mount mt-8">
            <ClubQrSign
              clubName={club.name}
              venueName={club.venueName}
              url={url}
              svg={svg}
            />
          </div>

          {/* The code on its own, at a URL. The sheet above is behind an
              Organizer login and prints as a whole page, which is no help to
              a print shop wanting artwork or to a group chat wanting a
              picture. Both links below are open, like the link the code
              carries. */}
          <div className="od-sign-controls mt-10 rounded-2xl border bg-card p-5">
            <h2 className="text-sm font-semibold">Just the code</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              For a print shop, or to send to someone. Same code as the sheet
              above, and these two links open without a login, so you can pass
              them on.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={svgPath}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                SVG, for print
              </a>
              <a
                href={pngPath}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                PNG, to send
              </a>
            </div>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
              {svgUrl}
            </p>
          </div>

          <div className="od-sign-controls">
            <Link
              href={ON_DECK_HOME_PATH}
              className="mt-8 inline-block text-sm underline underline-offset-4"
            >
              Back to Tonight
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
