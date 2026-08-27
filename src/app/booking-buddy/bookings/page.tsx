import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BookingBuddyNav } from "@/components/booking-buddy/bb-nav";
import {
  BookingRow,
  CreateBookingForm,
} from "@/components/booking-buddy/bookings";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SyncFromEmailSection } from "@/components/booking-buddy/sync-from-email";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getBookingsPageData } from "@/lib/booking-buddy/actions/bookings";
import { notEndedBefore } from "@/lib/booking-buddy/calendar";
import { getMailboxLink } from "@/lib/booking-buddy/actions/email-sync";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { isEmailSyncAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import { readEmailSyncAllowlist } from "@/lib/booking-buddy/env";
import { BOOKING_BUDDY_ROOT, ORGS_PATH, PRIVACY_PATH } from "@/lib/booking-buddy/routes";

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

  // Optimistic half of ADR-0009's addendum, same gating Settings already
  // does — an unapproved User never sees "Sync from Email" at all.
  // syncFromEmail/confirmImportCandidate/dismissImportCandidate each
  // re-check this authoritatively.
  const emailSyncAllowed = isEmailSyncAllowed(profile.username, session.email, readEmailSyncAllowlist());
  const mailboxLink = emailSyncAllowed ? await getMailboxLink() : null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-4">
            <div>
              <PageHeading
                eyebrow="Booking Buddy"
                title="Your bookings"
                description="Court reservations you've already made, typed in here so they're ready to share."
              />
            </div>

            <BookingBuddyNav current="bookings" />
          </div>

          {orgs.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">
              Bookings need somewhere to be.{" "}
              <Link href={ORGS_PATH} className="underline underline-offset-4">
                Add the place you play
              </Link>
              , then come back.
            </p>
          ) : (
            <div className="mt-10 flex flex-col gap-12">
              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Booked
                  {upcomingBookings.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {upcomingBookings.length}
                    </span>
                  )}
                </h2>

                {upcomingBookings.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                    Nothing upcoming. Log a booking below, or check History for past ones.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
                    {upcomingBookings.map((booking) => (
                      <BookingRow key={booking.id} booking={booking} orgs={orgs} />
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
                      <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
                        {pastBookings.map((booking) => (
                          <BookingRow key={booking.id} booking={booking} orgs={orgs} />
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </section>

              {emailSyncAllowed && (
                <section>
                  <h2 className="font-heading text-lg font-semibold tracking-tight">
                    Sync from Email
                  </h2>
                  <SyncFromEmailSection orgs={orgs} mailboxLinkConnected={mailboxLink !== null} />
                </section>
              )}

              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Log a booking
                </h2>
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

          <FooterNav>
            <FooterLink href={ORGS_PATH}>Facilities</FooterLink>
            <FooterLink href={PRIVACY_PATH}>Privacy</FooterLink>
            <FooterLink href={BOOKING_BUDDY_ROOT} back>
              Back to Booking Buddy
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
