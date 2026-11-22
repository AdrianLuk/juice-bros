import Link from "next/link";
import type { ReactNode } from "react";

import { formatDddDate, type DddHeader } from "@/lib/ddd/events";

/**
 * The DDD header every DDD screen opens with (spec #709, D23): its name in
 * Anton on the green, then the date, the play venue and the dine & drink
 * venue. `back` is a link above it for the Organizer's pages.
 */
export function DddHead({ event, back, children }: { event: DddHeader; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="ddd-head">
      <div className="ddd-col">
        {back ? (
          <Link href={back.href} className="ddd-back">
            {back.label}
          </Link>
        ) : null}
        <h1 className="ddd-title">{event.name}</h1>
        <dl className="ddd-facts">
          <div>
            <dt>Date</dt>
            <dd>{formatDddDate(event.date)}</dd>
          </div>
          <div>
            <dt>Play</dt>
            <dd>{event.playVenue}</dd>
          </div>
          <div>
            <dt>Dine &amp; drink</dt>
            <dd>{event.dineVenue}</dd>
          </div>
        </dl>
        {children}
      </div>
    </header>
  );
}

/** The plain header for screens with no DDD yet: sign-in, invites, the list. The app's name is the tab title, not a kicker. */
export function DddBar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="ddd-head">
      <div className="ddd-col">
        <h1 className="ddd-title">{title}</h1>
        {children}
      </div>
    </header>
  );
}
