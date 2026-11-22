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
            <dd>
              <Venue name={event.playVenue} map={event.playVenueMap} />
            </dd>
          </div>
          <div>
            <dt>Dine &amp; drink</dt>
            <dd>
              <Venue name={event.dineVenue} map={event.dineVenueMap} />
            </dd>
          </div>
        </dl>
        {children}
      </div>
    </header>
  );
}

/** A venue's name, linked to its map when it has one (#734). Only http(s) links save, so the href is safe. */
function Venue({ name, map }: { name: string; map: string | null }) {
  if (!map) return name;
  return (
    <a href={map} target="_blank" rel="noopener noreferrer" className="ddd-venue-map">
      {name || "Open the map"}
    </a>
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
