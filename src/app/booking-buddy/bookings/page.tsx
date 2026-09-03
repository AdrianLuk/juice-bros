import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import {
  BookingRow,
  CreateBookingForm,
} from "@/components/booking-buddy/bookings";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SyncBookingsSection } from "@/components/booking-buddy/sync-bookings";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getBookingsPageData } from "@/lib/booking-buddy/actions/bookings";
import { notEndedBefore } from "@/lib/booking-buddy/calendar";
import { getMailboxLink } from "@/lib/booking-buddy/actions/email-sync";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { isGmailConnectAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import { readEmailSyncAllowlist } from "@/lib/booking-buddy/env";
import { ORGS_PATH } from "@/lib/booking-buddy/routes";
export const metadata: Metadata = pageMetadata({
  title: "Your bookings",
  description:
    "Log the court reservations you've made, so your friends can be invited to them later.",
  path: "/booking-buddy/bookings",
});
export default async function BookingsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  const session = await verifySession();
  const [{ orgs, bookings }, profile] = await Promise.all([
    getBookingsPageData(),
    getOwnProfile(),
  ]);
  // `bookings` comes back soonest-first (see `getBookingsPageData`), so an
  // in-progress booking (started, not yet ended) still counts as "Booked" —
  // same "any overlap counts" reasoning `notEndedBefore` already uses for the
  // dashboard calendar (issue #61) — and everything else falls to History,
  // most recent first.
  const now = new Date();
  const upcomingBookings = notEndedBefore(bookings, now);
  const pastBookings = bookings
    .filter((booking) => !upcomingBookings.includes(booking))
    .reverse();
  // Optimistic half of ADR-0009's addendum — syncFromEmail and the confirm/
  // dismiss actions re-check authoritatively. The Gmail allowlist gates
  // *connecting* Gmail; an Outlook link has no allowlist (spec #280), so email
  // sync is available to a Gmail-allowlisted User (with or without a link yet,
  // to point them at Settings) or to anyone who already has a Mailbox Link.
  const gmailConnectAllowed = isGmailConnectAllowed(
    profile.username,
    session.email,
    readEmailSyncAllowlist(),
  );
  const mailboxLink = await getMailboxLink();
  const canSyncFromEmail = gmailConnectAllowed || mailboxLink !== null;
  // A Calendar Feed isn't allowlist-gated (ADR-0019) — feed sync is available
  // whenever the User has at least one feed-configured Facility. The unified
  // "Sync bookings" section (issue #336) shows if either source is available.
  const hasConfiguredFeed = orgs.some((org) => org.hasCalendarFeed);
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-2.5 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title="Your bookings"
            description="Court reservations you've already made, typed in here so they're ready to share."
          />
          <BbSectionNav />
          {orgs.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">
              Bookings need somewhere to be.{" "}
              <Link href={ORGS_PATH} className="underline underline-offset-4">
                Add the place you play
              </Link>
              , then come back.
            </p>
          ) : (
            <div className="bb-sheet mt-8 flex flex-col gap-11 p-3.5 sm:p-8">
              <section>
                <h2 className="flex items-center gap-2 bb-h text-[1.05rem]">
                  Booked
                  {upcomingBookings.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {upcomingBookings.length}
                    </span>
                  )}
                </h2>
                {upcomingBookings.length === 0 ? (
                  <p className="mt-4 bb-outline p-4 text-sm text-muted-foreground">
                    Nothing upcoming. Log a booking below, or check History for
                    past ones.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-5">
                    {upcomingBookings.map((booking) => (
                      <BookingRow
                        key={booking.id}
                        booking={booking}
                        orgs={orgs}
                        nowIso={now.toISOString()}
                      />
                    ))}
                  </ul>
                )}
                {pastBookings.length > 0 && (
                  <Collapsible className="mt-6">
                    <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                      <ChevronDownIcon className="size-4 transition-transform duration-200 group-data-panel-open:rotate-180" />
                      History
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-4 flex flex-col gap-5">
                        {pastBookings.map((booking) => (
                          <BookingRow
                            key={booking.id}
                            booking={booking}
                            orgs={orgs}
                          />
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </section>
              {(canSyncFromEmail || hasConfiguredFeed) && (
                <SyncBookingsSection
                  orgs={orgs}
                  canSyncFromEmail={canSyncFromEmail}
                  mailboxProvider={mailboxLink?.provider ?? null}
                  hasConfiguredFeed={hasConfiguredFeed}
                />
              )}
              <section>
                <h2 className="bb-h text-[1.05rem]">Log a booking</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Copy it off the facility&apos;s own booking screen. Booking
                  Buddy doesn&apos;t reserve courts, it remembers the ones you
                  reserved.
                </p>
                <div className="mt-4">
                  <CreateBookingForm orgs={orgs} />
                </div>
              </section>
            </div>
          )}
          <BbFooter />
        </div>
      </section>
    </div>
  );
}
