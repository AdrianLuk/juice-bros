import type { ReactNode } from "react";

import "./team-tally.css";

/**
 * Team Tally's surface: the broadcast package world (team-tally.css) on every
 * route under /tools/team-tally. `SiteShell` lists the route in
 * `DARK_EXCEPTIONS`, so the marketing site's Broadcast Dark never reaches it.
 */
export default function TeamTallyLayout({ children }: { children: ReactNode }) {
  return <div className="tt-surface flex w-full flex-1 flex-col">{children}</div>;
}
