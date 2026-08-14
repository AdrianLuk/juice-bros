import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { verifySession } from "@/lib/booking-buddy/dal";

export const metadata: Metadata = pageMetadata({
  title: "Booking Buddy",
  description:
    "Plan pickleball with your friends — post open time, see who's in, and keep your court bookings in one place.",
  path: "/booking-buddy",
});

export default async function BookingBuddyPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  const session = await verifySession();

  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="Booking Buddy"
        title="Your games"
        description="Post open time, see who's in, and keep your court bookings in one place."
      />

      <p className="mt-8 text-sm text-muted-foreground">
        {session.email ? `Signed in as ${session.email}.` : "Signed in."}
      </p>
    </div>
  );
}
