import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./mic-drop.css";

/**
 * Mic Drop is unlisted (spec #666): kept out of search, and a Guest Link's
 * token never travels on as a referrer. The group-chat preview is the site
 * default.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Mic Drop's surface: the chart world (mic-drop.css) on every route under
 * /tools/mic-drop. `SiteShell` lists the route in `DARK_EXCEPTIONS`, so the
 * marketing site's Broadcast Dark never reaches it.
 */
export default function MicDropLayout({ children }: { children: ReactNode }) {
  return <div className="md-surface flex w-full flex-1 flex-col">{children}</div>;
}
