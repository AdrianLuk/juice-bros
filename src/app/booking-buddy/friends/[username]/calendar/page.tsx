import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BookingBuddyNav } from "@/components/booking-buddy/bb-nav";
import { FriendDashboardCalendar } from "@/components/booking-buddy/friend-dashboard-calendar";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { verifySession } from "@/lib/booking-buddy/dal";
import { personLabel } from "@/lib/booking-buddy/connections";
import { getFriendCalendarPageData } from "@/lib/booking-buddy/actions/friend-calendar";
import { FRIENDS_PATH } from "@/lib/booking-buddy/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  return pageMetadata({
    title: `${username}'s calendar`,
    description: "See when a friend is free to play, at a glance.",
    path: `/booking-buddy/friends/${username}/calendar`,
  });
}

export default async function FriendCalendarPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const data = await getFriendCalendarPageData(username);

  // An unknown Username, a real User the caller has no Connection to, and
  // the caller's own Username all collapse to "not found" — see
  // `getFriendCalendarPageData`'s own comment for why the third belongs
  // here too. Never "no permission", which would confirm a real account
  // holds that handle.
  if (!data) {
    notFound();
  }

  const { friend, bookings, availabilityWindows } = data;
  const name = personLabel(friend);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-4">
            <div>
              <PageHeading
                eyebrow="Booking Buddy"
                title={`${name}'s calendar`}
                description="Busy and open time only — no Slots, and nothing before today."
              />
            </div>

            <BookingBuddyNav current="friends" />
          </div>

          <div className="mt-8">
            <FriendDashboardCalendar
              bookings={bookings}
              availabilityWindows={availabilityWindows}
            />
          </div>

          <FooterNav>
            <FooterLink href={FRIENDS_PATH} back>
              Back to friends
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
