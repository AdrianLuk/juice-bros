import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { DashboardGreeting } from "@/components/booking-buddy/dashboard-greeting";
import { OwnerDashboardCalendar } from "@/components/booking-buddy/owner-dashboard-calendar";
import { UpcomingBookingsSidebar } from "@/components/booking-buddy/upcoming-bookings";
import { DashboardAvailabilitySidebar } from "@/components/booking-buddy/dashboard-availability-sidebar";
import { OnboardingModal } from "@/components/booking-buddy/onboarding-modal";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { BookingBuddyLanding } from "@/components/booking-buddy/landing/booking-buddy-landing";
import { Board, BoardRegion } from "@/components/booking-buddy/bb/board";
import { BoardCard } from "@/components/booking-buddy/bb/board-card";
import { GameCard } from "@/components/booking-buddy/bb/game-card";
import { StatusKey } from "@/components/booking-buddy/bb/status-key";
import { getOptionalSession, verifySession } from "@/lib/booking-buddy/dal";
import { getDashboardPageData } from "@/lib/booking-buddy/actions/dashboard";
import { listSlots, getSlotResponses } from "@/lib/booking-buddy/actions/slots";
import { upcomingBookings } from "@/lib/booking-buddy/calendar";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { getOwnInviteUrl } from "@/lib/booking-buddy/actions/invite-links";
import { proposeGameHref } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Booking Buddy: plan pickleball with your friends",
  description:
    "A free tool from the Juice Bros for friend groups: post an open time, see who's in, share availability, and keep your court bookings in one place.",
  path: "/booking-buddy",
});

export default async function BookingBuddyPage() {
  const session = await getOptionalSession();
  if (!session) {
    return <BookingBuddyLanding />;
  }
  await verifySession();

  const { orgs, bookings, availabilityWindows, hasSlot } =
    await getDashboardPageData();
  const now = new Date();
  const hasBooking = bookings.length > 0;

  const upcoming = upcomingBookings(bookings, now, bookings.length);
  const weekOutMs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const thisWeekCount = upcoming.filter(
    (booking) => new Date(booking.startsAt).getTime() < weekOutMs,
  ).length;
  const nextBookingDate =
    thisWeekCount === 0 && upcoming.length > 0
      ? (upcoming[0].when.split(" · ")[0] ?? null)
      : null;

  // The "This week" region: the caller's own upcoming games, soonest first,
  // with a penned RSVP tally each. Capped — a heavy board tips into the
  // sign-up sheet below.
  const { own: ownSlots } = await listSlots();
  const upcomingGames = ownSlots
    .filter(
      (s) => new Date(s.proposedStart).getTime() >= now.getTime() - 3_600_000,
    )
    .sort(
      (a, b) =>
        new Date(a.proposedStart).getTime() -
        new Date(b.proposedStart).getTime(),
    )
    .slice(0, 4);
  const gameTallies = await Promise.all(
    upcomingGames.map(async (s) => {
      const { responses } = await getSlotResponses(s.id);
      return {
        id: s.id,
        yes: responses.filter((r) => r.answer === "yes").length,
        maybe: responses.filter((r) => r.answer === "maybe").length,
        capacity: null as number | null,
      };
    }),
  );

  const onboardingCanShow = !hasBooking && !hasSlot;
  const gender = onboardingCanShow ? (await getOwnProfile()).gender : null;
  const inviteUrl = onboardingCanShow ? await getOwnInviteUrl() : null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <OnboardingModal
        orgs={orgs}
        gender={gender}
        inviteUrl={inviteUrl}
        hasBooking={hasBooking}
        hasSlot={hasSlot}
      />

      <section className="w-full px-4 pt-8 pb-10 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <DashboardGreeting
            thisWeekCount={thisWeekCount}
            nextBookingDate={nextBookingDate}
            hasAnyBooking={hasBooking}
          />

          {/* ── The board: this week, pinned up ──────────────────────────── */}
          <Board className="mt-8 flex flex-col gap-x-8 gap-y-9 rounded-lg p-4 sm:p-6 lg:flex-row lg:items-start">
            <BoardRegion
              label="This week"
              className="lg:w-[37.5rem] lg:shrink-0"
              contentClassName="bb-board-load"
            >
              <BoardCard
                as={Link}
                href={proposeGameHref({ date: nextMondayKey() })}
                pin="commit"
                pinLabel="Post a game — your move"
                interactive
                className="flex w-full flex-col items-center gap-1 border-2 border-dashed border-[color-mix(in_oklch,var(--brand-orange),transparent_45%)] bg-[repeating-linear-gradient(-45deg,var(--card),var(--card)_9px,var(--bb-kraft-deep)_9px,var(--bb-kraft-deep)_18px)] py-6 text-center no-underline shadow-none sm:w-[15.5rem]"
              >
                <span className="font-bb-sign text-[2rem] leading-none text-brand-orange">
                  +
                </span>
                <span className="font-bb-sign text-[0.8rem] tracking-widest text-foreground uppercase">
                  Pin a new game
                </span>
              </BoardCard>

              {upcomingGames.map((slot, i) => (
                <GameCard
                  key={slot.id}
                  slot={slot}
                  size={i === 0 ? "lead" : "regular"}
                  tally={gameTallies.find((t) => t.id === slot.id)}
                />
              ))}

              {upcomingGames.length === 0 && (
                <p className="max-w-xs self-center py-6 text-center text-sm text-muted-foreground">
                  No games on the board yet. Pin one and your friends can say
                  they&apos;re in.
                </p>
              )}
            </BoardRegion>

            <div className="relative w-full shrink-0 pt-6 lg:w-[20rem]">
              <span className="bb-tape absolute -top-3.5 left-3 text-xs leading-none">
                Your court + time
              </span>
              <div className="flex flex-col gap-7">
                <BoardCard
                  pin="info"
                  pinLabel="Your booked courts"
                  className="w-full"
                >
                  <UpcomingBookingsSidebar
                    bookings={bookings}
                    now={now}
                    orgs={orgs}
                  />
                </BoardCard>
                <BoardCard
                  pin="maybe"
                  pinLabel="Your availability"
                  className="w-full"
                >
                  <DashboardAvailabilitySidebar
                    windows={availabilityWindows}
                    now={now}
                  />
                </BoardCard>
              </div>
            </div>
          </Board>

          <StatusKey className="mt-7" />

          {/* ── The sign-up sheet: the week, ruled out ───────────────────── */}
          <div className="mt-10">
            <span className="bb-tape text-xs">The week, ruled out</span>
            <div className="bb-sheet mt-3 p-3 sm:p-5">
              <OwnerDashboardCalendar
                bookings={bookings}
                availabilityWindows={availabilityWindows}
                orgs={orgs}
              />
            </div>
          </div>

          <BbFooter />
        </div>
      </section>
    </div>
  );
}

function nextMondayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
