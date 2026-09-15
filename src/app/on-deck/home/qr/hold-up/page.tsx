import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { clubJoinQr } from "@/lib/on-deck/qr";
import { buildJoinMessage } from "@/lib/on-deck/join-message";
import { ClubQrHoldUp } from "@/components/on-deck/club-qr-hold-up";
import { ON_DECK_HOME_PATH, ON_DECK_QR_HOLD_UP_PATH } from "@/lib/on-deck/routes";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Hold up the club QR",
    description: "The Club QR, full screen, ready to hold up at the door.",
    path: ON_DECK_QR_HOLD_UP_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * The Club QR full-bleed (issue #517) — nothing on the screen but the code
 * and a control to copy the join link with its group-chat message already
 * written. Same stable link `ClubQrSign` draws at paper proportions; this is
 * the shape for carrying to the door instead of printing.
 */
export default async function OnDeckQrHoldUpPage() {
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);

  if (!club) {
    redirect(ON_DECK_HOME_PATH);
  }

  const { url, svg } = await clubJoinQr(club.id);
  const message = buildJoinMessage(club.name, url);

  return (
    <ClubQrHoldUp clubName={club.name} url={url} svg={svg} message={message} />
  );
}
