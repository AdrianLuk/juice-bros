import type { ReactNode } from "react";
import Link from "next/link";

import { TEAM_TALLY_ROOT } from "@/lib/team-tally/routes";

/**
 * Team Tally's app bar: the mark on the left, linking home, and what this
 * screen is on the right ("Organizer", later "Team Ben · Score link"). A
 * full-width band of its own, so the page title below it starts clean.
 */
export function TtAppBar({ context }: { context?: ReactNode }) {
  return (
    <div className="tt-appbar">
      <div className="tt-wrap tt-appbar-inner">
        <Link href={TEAM_TALLY_ROOT} className="tt-mark">
          <span aria-hidden className="tt-mark-blocks" />
          Team Tally
        </Link>
        {context && <span className="tt-chip">{context}</span>}
      </div>
    </div>
  );
}

/**
 * The opening of a Team Tally page: the app bar, then the title, its
 * metadata, a standfirst and the page's actions, in that order.
 */
export function TtHead({
  title,
  meta,
  lead,
  actions,
  context = "Organizer",
}: {
  title: ReactNode;
  meta?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  context?: ReactNode;
}) {
  return (
    <>
      <TtAppBar context={context} />
      <header className="tt-wrap tt-head">
        <div className="grid gap-3">
          <h1 className="tt-title">{title}</h1>
          {meta && <p className="tt-meta m-0">{meta}</p>}
        </div>
        {lead && <p className="tt-lead">{lead}</p>}
        {actions && <div className="tt-actions">{actions}</div>}
      </header>
    </>
  );
}
