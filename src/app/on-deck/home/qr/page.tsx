import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { clubJoinQr } from "@/lib/on-deck/qr";
import { onDeckAbsoluteUrl } from "@/lib/on-deck/request-origin";
import { ClubQrSign } from "@/components/on-deck/club-qr-sign";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import {
  BackToTonight,
  BoardHead,
  Stage,
  StageHeading,
} from "@/components/on-deck/back-office";
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
 * The Club QR sign (issue #463), which is both the sheet that goes on the wall
 * and the on-screen stand-in for the night it isn't there yet. Nothing here is
 * per-Session — the link the code carries always resolves to whatever Session
 * is running, and regenerating it per night would defeat the point of a sign
 * printed once.
 *
 * The page around the sheet joined the board with the rest of the back office
 * (#515); the sheet itself did not, and must not. `.od-sign` carries its own
 * ink precisely so it never rides a theme token, because it is the one On Deck
 * surface that ends up as toner on paper. What that leaves is the right
 * picture anyway: a white sheet held up against a dark wall, which is what the
 * Organizer is about to do with it.
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
    <ArenaShell>
      <section className="w-full flex-1 px-5 py-12 sm:px-6 sm:py-16">
        {/* Named so the print stylesheet can drop the reading width in one
            rule — on paper the sheet takes the whole page. */}
        <div className="od-sign-slot mx-auto w-full max-w-xl">
          <div className="od-sign-controls">
            <BoardHead name="The club sign" spec={[club.name]} />

            <p className="od-bo-note mt-6">
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
          <div className="od-sign-controls">
            <Stage tone="flat">
              <StageHeading>Just the code</StageHeading>
              <p className="od-bo-note">
                For a print shop, or to send to someone. Same code as the sheet
                above, and these two links open without a login, so you can pass
                them on.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href={svgPath} className="od-key od-key--ghost">
                  SVG, for print
                </a>
                <a href={pngPath} className="od-key od-key--ghost">
                  PNG, to send
                </a>
              </div>
              <p className="break-all font-mono text-xs text-arena-faint">
                {svgUrl}
              </p>
            </Stage>
          </div>

          <div className="od-sign-controls">
            <BackToTonight />
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
