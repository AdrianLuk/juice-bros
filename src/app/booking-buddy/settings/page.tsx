import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { UsernameForm } from "@/components/booking-buddy/username-form";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { BOOKING_BUDDY_ROOT } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Settings",
  description: "Change the username friends use to find you on Booking Buddy.",
  path: "/booking-buddy/settings",
});

export default async function SettingsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const profile = await getOwnProfile();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Settings"
            description="Your username was picked for you when you signed up. Change it to whatever you'd rather give out."
          />

          <div className="mt-10">
            <UsernameForm username={profile.username} />
          </div>

          <p className="mt-14 text-sm">
            <Link
              href={BOOKING_BUDDY_ROOT}
              className="underline underline-offset-4"
            >
              Back to Booking Buddy
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
