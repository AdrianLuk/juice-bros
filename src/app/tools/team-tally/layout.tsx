import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./team-tally.css";

const SHARE_TITLE = "Team Tally, powered by Juice Bros Pickleball";
const SHARE_DESCRIPTION =
  "Live scores and standings for this team night. Captains score from their phones and the board updates as each game ends.";

/**
 * What a Score Link or the Public Link shows when pasted into a group chat:
 * Team Tally, not the podcast. No `images` here, so `opengraph-image.tsx`
 * beside this layout fills them in. Pages built with `pageMetadata` set their
 * own and keep the site's.
 */
export const metadata: Metadata = {
  openGraph: { type: "website", siteName: "Juice Bros Pickleball", title: SHARE_TITLE, description: SHARE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: SHARE_TITLE, description: SHARE_DESCRIPTION },
};

/**
 * Team Tally's surface: the broadcast package world (team-tally.css) on every
 * route under /tools/team-tally. `SiteShell` lists the route in
 * `DARK_EXCEPTIONS`, so the marketing site's Broadcast Dark never reaches it.
 */
export default function TeamTallyLayout({ children }: { children: ReactNode }) {
  return <div className="tt-surface flex w-full flex-1 flex-col">{children}</div>;
}
